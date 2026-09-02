import { config } from "../../config.js";
import { AppError } from "../../core/errors.js";
import type {
  AIProvider,
  ChatDelta,
  ChatMessage,
  ChatOptions,
  EphemeralToken,
  VisionAnalyzeInput,
} from "./AIProvider.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * L'API Gemini n'accepte qu'un sous-ensemble d'OpenAPI 3.0 pour les schémas de
 * `functionDeclarations[].parameters`. On retire récursivement les mots-clés
 * JSON-Schema non supportés (`additionalProperties`, `$schema`, `$ref`, …) qui
 * provoquent sinon un 400 "Unknown name".
 */
const GEMINI_SCHEMA_DROP = new Set([
  "additionalProperties",
  "$schema",
  "$ref",
  "$id",
  "definitions",
  "default",
  "const",
  "examples",
  "patternProperties",
]);
function sanitizeGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sanitizeGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (GEMINI_SCHEMA_DROP.has(k)) continue;
    out[k] = sanitizeGeminiSchema(v);
  }
  return out;
}

type GeminiPart =
  | { text: string }
  | {
      functionCall: { name: string; args: Record<string, unknown> };
      thoughtSignature?: string;
    }
  | { functionResponse: { name: string; response: Record<string, unknown> } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function toGeminiContents(messages: ChatMessage[]): {
  system?: string;
  contents: GeminiContent[];
} {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const contents: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls ?? []) {
        parts.push({
          functionCall: { name: tc.name, args: tc.args },
          ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
        });
      }
      contents.push({ role: "model", parts: parts.length ? parts : [{ text: "" }] });
      continue;
    }

    if (m.role === "tool") {
      let response: Record<string, unknown>;
      try {
        response = JSON.parse(m.content);
      } catch {
        response = { result: m.content };
      }
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: m.toolName ?? "tool", response } }],
      });
      continue;
    }

    contents.push({ role: "user", parts: [{ text: m.content }] });
  }

  return { system: system || undefined, contents };
}

/**
 * Fournisseur Gemini 2.5 (défaut). Utilise l'API REST generativeLanguage.
 * La clé n'est lue que côté serveur (§14).
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  #key = config.GEMINI_API_KEY ?? "";
  #model = config.GEMINI_MODEL;

  isReady(): boolean {
    return this.#key.length > 0;
  }

  #assertReady() {
    if (!this.isReady()) {
      throw new AppError(
        "ai_unavailable",
        "GEMINI_API_KEY non configurée — le module IA est indisponible.",
        { i18nKey: "error.ai_unavailable" },
      );
    }
  }

  async *chat(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): AsyncIterable<ChatDelta> {
    this.#assertReady();
    const model = opts.model ?? this.#model;
    const { system, contents } = toGeminiContents(messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        // Gemini 3.x « pense » par défaut, ce qui ajoute 20–40 s de latence sur
        // des tours simples. On borne le budget de réflexion pour le chat.
        thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 128 },
      },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (opts.tools?.length) {
      body.tools = [
        {
          functionDeclarations: opts.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: sanitizeGeminiSchema(t.parameters),
          })),
        },
      ];
    }

    const res = await fetch(
      `${BASE}/models/${model}:streamGenerateContent?alt=sse&key=${this.#key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: opts.signal,
      },
    );
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new AppError("ai_unavailable", `Gemini a répondu ${res.status}`, {
        details: detail.slice(0, 500),
      });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let tokensIn = 0;
    let tokensOut = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const json = line.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        let chunk: any;
        try {
          chunk = JSON.parse(json);
        } catch {
          continue;
        }
        const parts: GeminiPart[] =
          chunk?.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) {
          if ("text" in p && p.text) yield { type: "text", value: p.text };
          else if ("functionCall" in p && p.functionCall) {
            yield {
              type: "tool_call",
              id: `call_${Date.now()}_${p.functionCall.name}`,
              name: p.functionCall.name,
              args: p.functionCall.args ?? {},
              thoughtSignature: p.thoughtSignature,
            };
          }
        }
        if (chunk?.usageMetadata) {
          tokensIn = chunk.usageMetadata.promptTokenCount ?? tokensIn;
          tokensOut = chunk.usageMetadata.candidatesTokenCount ?? tokensOut;
        }
      }
    }
    yield { type: "usage", tokensIn, tokensOut };
  }

  async analyzeImage(input: VisionAnalyzeInput): Promise<Record<string, unknown>> {
    this.#assertReady();
    const res = await fetch(
      `${BASE}/models/${this.#model}:generateContent?key=${this.#key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: input.prompt },
                { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: input.responseSchema,
          },
        }),
      },
    );
    if (!res.ok) {
      throw new AppError("ai_unavailable", `Gemini vision a répondu ${res.status}`);
    }
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    try {
      return JSON.parse(text);
    } catch {
      throw new AppError("ai_unavailable", "Réponse vision non parsable");
    }
  }

  /**
   * Jeton éphémère pour l'API Gemini Live (§6/§14).
   * La clé privée reste côté serveur ; le navigateur se connecte au Live API
   * avec ce jeton à usage unique, courte durée, modèle verrouillé.
   */
  async createRealtimeToken(): Promise<EphemeralToken> {
    this.#assertReady();
    const model = config.GEMINI_LIVE_MODEL;
    const now = Date.now();
    const expireTime = new Date(now + 30 * 60_000).toISOString(); // session ≤ 30 min
    const newSessionExpireTime = new Date(now + 60_000).toISOString(); // connexion sous 1 min

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${this.#key}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            uses: 1,
            expireTime,
            newSessionExpireTime,
            liveConnectConstraints: {
              model: `models/${model}`,
              config: { responseModalities: ["AUDIO"] },
            },
          }),
        },
      );
    } catch (err) {
      throw new AppError("ai_unavailable", "Appel auth_tokens échoué (réseau)", {
        i18nKey: "error.voice_not_ready",
        details: err instanceof Error ? err.message : String(err),
      });
    }

    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      throw new AppError("ai_unavailable", `Émission du jeton voix impossible (${res.status})`, {
        i18nKey: "error.voice_not_ready",
        details: raw.slice(0, 500),
      });
    }
    let data: { name?: string };
    try {
      data = JSON.parse(raw) as { name?: string };
    } catch {
      throw new AppError("ai_unavailable", "Réponse auth_tokens non-JSON", {
        i18nKey: "error.voice_not_ready",
        details: raw.slice(0, 500),
      });
    }
    if (!data.name) {
      throw new AppError("ai_unavailable", "auth_tokens sans champ `name`", {
        i18nKey: "error.voice_not_ready",
        details: raw.slice(0, 500),
      });
    }
    return { token: data.name, expiresAt: expireTime, model };
  }
}
