import { GoogleGenAI } from "@google/genai";
import type { ActionProposal, Locale } from "@moumen/shared";
import { api } from "@/lib/api";
import { decodeBase64, floatToPcm16Base64, pcm16ToAudioBuffer } from "./audio";

export type VoiceState = "connecting" | "listening" | "speaking" | "idle" | "error";

export type VoiceEvent =
  | { type: "state"; state: VoiceState }
  | { type: "transcript"; role: "user" | "assistant"; text: string; final: boolean }
  | { type: "tool"; name: string }
  | { type: "proposal"; proposal: ActionProposal }
  | { type: "error"; message: string };

export type VoiceController = { stop: () => Promise<void> };

type TokenResponse = {
  token: string;
  model: string;
  apiVersion: string;
  tools: { name: string; description: string; parameters: Record<string, unknown> }[];
};

const LANG_CODE: Record<Locale, string> = { ar: "ar-XA", fr: "fr-FR", en: "en-US" };
const LANG_NAME: Record<Locale, string> = { ar: "arabe", fr: "français", en: "anglais" };

function systemInstruction(locale: Locale, contextText: string): string {
  return `Tu es MOUMEN, le copilote vocal d'un apiculteur. Conversation naturelle, réponses brèves et concrètes.
Règles absolues :
- DATA-FIRST : ne réponds sur le rucher qu'à partir des données renvoyées par les outils (getX). Donnée absente → « Je ne possède pas cette information dans vos données. » N'invente rien.
- Prudence sanitaire : jamais de diagnostic affirmatif ; parle d'indices, d'estimations, de points « à vérifier ».
- Actions : tu ne peux PAS créer ni modifier de données par la voix. Si l'utilisateur demande une action, décris ce que tu proposes et dis que la confirmation se fait à l'écran.
- Réponds en ${LANG_NAME[locale]}.
Contexte courant : ${contextText || "aucun"}.`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function startVoiceSession(opts: {
  locale: Locale;
  contextText: string;
  onEvent: (e: VoiceEvent) => void;
}): Promise<VoiceController> {
  const { locale, contextText, onEvent } = opts;
  onEvent({ type: "state", state: "connecting" });

  let mediaStream: MediaStream | null = null;
  let ctxIn: AudioContext | null = null;
  let ctxOut: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let nextStartTime = 0;
  let session: any = null;
  let closed = false;

  const sources = new Set<AudioBufferSourceNode>();
  const transcript: { role: "user" | "assistant" | "tool"; content: string; toolName?: string }[] = [];
  let userBuf = "";
  let aiBuf = "";
  const startedAt = new Date().toISOString();

  // persiste le transcript complet en fin de session (§6)
  async function flushTranscript() {
    if (!transcript.length) return;
    await api("/ai/voice/session", {
      method: "POST",
      body: {
        locale,
        startedAt,
        endedAt: new Date().toISOString(),
        messages: transcript,
        durationS: Math.round((Date.now() - new Date(startedAt).getTime()) / 1000),
      },
    }).catch(() => undefined);
  }

  const stopPlayback = () => {
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* déjà arrêtée */
      }
    });
    sources.clear();
    nextStartTime = 0;
  };

  const roomCleanup = () => {
    try {
      processor?.disconnect();
    } catch {
      /* noop */
    }
    processor = null;
    stopPlayback();
    mediaStream?.getTracks().forEach((tk) => tk.stop());
    mediaStream = null;
    void ctxIn?.close().catch(() => undefined);
    void ctxOut?.close().catch(() => undefined);
    ctxIn = null;
    ctxOut = null;
    try {
      session?.close();
    } catch {
      /* noop */
    }
    session = null;
  };

  const stop = async () => {
    if (closed) return;
    closed = true;
    roomCleanup();
    onEvent({ type: "state", state: "idle" });
    await flushTranscript().catch(() => undefined);
  };

  // fait tomber la session, puis relance une nouvelle connexion live avec backoff.
  const reconnect = (reason: string) => {
    if (closed) return;
    onEvent({ type: "error", message: reason });
    roomCleanup();
    void (async () => {
      for (let attempt = 0; attempt < 3 && !closed; attempt++) {
        await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
        if (closed) return;
        onEvent({ type: "state", state: "connecting" });
        try {
          session = await connectLive();
          return;
        } catch {
          /* retente */
        }
      }
      onEvent({ type: "state", state: "error" });
    })();
  };

  async function connectLive() {
    const tok = await api<TokenResponse>("/ai/voice/token", { method: "POST" });
    const ai = new GoogleGenAI({
      apiKey: tok.token,
      httpOptions: { apiVersion: tok.apiVersion || "v1alpha" },
    });

    const connectParams: any = {
      model: tok.model,
      config: {
        responseModalities: ["AUDIO"],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: { languageCode: LANG_CODE[locale] },
        systemInstruction: systemInstruction(locale, contextText),
        tools: tok.tools.length ? [{ functionDeclarations: tok.tools }] : undefined,
      },
      callbacks: {
        onopen: async () => {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            ctxIn = new AudioContext({ sampleRate: 16000 });
            ctxOut = new AudioContext({ sampleRate: 24000 });
            const src = ctxIn.createMediaStreamSource(mediaStream);
            processor = ctxIn.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              if (closed || !session) return;
              const input = e.inputBuffer.getChannelData(0);
              session.sendRealtimeInput({ media: floatToPcm16Base64(new Float32Array(input)) });
            };
            src.connect(processor);
            processor.connect(ctxIn.destination);
            onEvent({ type: "state", state: "listening" });
          } catch {
            onEvent({ type: "error", message: "micro" });
            onEvent({ type: "state", state: "error" });
          }
        },
        onmessage: async (message: any) => {
          const sc = message.serverContent;

          if (sc?.inputTranscription?.text) {
            userBuf += sc.inputTranscription.text;
            onEvent({ type: "transcript", role: "user", text: userBuf, final: false });
          }
          if (sc?.outputTranscription?.text) {
            aiBuf += sc.outputTranscription.text;
            onEvent({ type: "transcript", role: "assistant", text: aiBuf, final: false });
          }
          if (sc?.turnComplete) {
            if (userBuf.trim()) {
              transcript.push({ role: "user", content: userBuf.trim() });
              onEvent({ type: "transcript", role: "user", text: userBuf.trim(), final: true });
            }
            if (aiBuf.trim()) {
              transcript.push({ role: "assistant", content: aiBuf.trim() });
              onEvent({ type: "transcript", role: "assistant", text: aiBuf.trim(), final: true });
            }
            userBuf = "";
            aiBuf = "";
            onEvent({ type: "state", state: "listening" });
          }

          const parts: any[] = sc?.modelTurn?.parts ?? [];
          for (const p of parts) {
            const b64: string | undefined = p?.inlineData?.data;
            if (!b64 || !ctxOut) continue;
            onEvent({ type: "state", state: "speaking" });
            const buffer = await pcm16ToAudioBuffer(decodeBase64(b64), ctxOut);
            const node = ctxOut.createBufferSource();
            node.buffer = buffer;
            node.connect(ctxOut.destination);
            nextStartTime = Math.max(nextStartTime, ctxOut.currentTime);
            node.start(nextStartTime);
            nextStartTime += buffer.duration;
            sources.add(node);
            node.addEventListener("ended", () => sources.delete(node));
          }

          if (sc?.interrupted) {
            stopPlayback();
            onEvent({ type: "state", state: "listening" });
          }

          const calls: any[] = message.toolCall?.functionCalls ?? [];
          if (calls.length && session) {
            const responses: any[] = [];
            for (const fc of calls) {
              onEvent({ type: "tool", name: fc.name });
              let response: Record<string, unknown>;
              try {
                const r = await api<{
                  ok: boolean;
                  data?: unknown;
                  pendingConfirmation?: boolean;
                  proposal?: ActionProposal;
                  error?: string;
                }>("/ai/tools/run", { method: "POST", body: { tool: fc.name, args: fc.args ?? {} } });
                transcript.push({ role: "tool", content: "", toolName: fc.name });
                if (r.pendingConfirmation && r.proposal) {
                  onEvent({ type: "proposal", proposal: r.proposal });
                  response = { result: "Action proposée ; confirmation à l'écran." };
                } else if (r.ok) {
                  response = { result: r.data };
                } else {
                  response = { error: r.error ?? "échec de l'outil" };
                }
              } catch (err) {
                response = { error: err instanceof Error ? err.message : String(err) };
              }
              responses.push({ id: fc.id, name: fc.name, response });
            }
            session.sendToolResponse({ functionResponses: responses });
          }
        },
        onerror: () => {
          if (!closed) reconnect("connexion");
        },
        onclose: () => {
          if (!closed) reconnect("connexion");
        },
      },
    };

    const s = await ai.live.connect(connectParams);
    return s;
  }

  session = await connectLive();
  return { stop };
}
