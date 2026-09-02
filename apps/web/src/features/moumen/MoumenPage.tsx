import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActionProposal } from "@moumen/shared";
import { useSessionStore } from "@/store/session";
import { snapshot } from "@/store/appContext";
import { streamChat, confirmAction, loadHistory } from "./api";
import { VoicePanel } from "./VoicePanel";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools?: string[];
  proposal?: ActionProposal;
  proposalState?: "pending" | "confirmed" | "cancelled" | "error";
  pendingTool?: boolean;
  createdAt: string;
};

const uid = () => Math.random().toString(36).slice(2);
const nowIso = () => new Date().toISOString();

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const STORAGE_KEY = "moumen.sessionId";

export default function MoumenPage() {
  const { t } = useTranslation();
  const locale = useSessionStore((s) => s.locale);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // restaure la session précédente depuis le stockage local
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) sessionRef.current = saved;
  }, []);

  // charge l'historique persistant de la session (conversation continue)
  useEffect(() => {
    const sid = sessionRef.current;
    if (!sid) return;
    setHydrating(true);
    loadHistory(sid)
      .then((hist) => {
        const msgs: Msg[] = [];
        for (const h of hist) {
          const last = msgs[msgs.length - 1];
          if (h.role === "assistant" && last?.role === "assistant") {
            // fusionne l'assistant+outils adjacents en un seul message
            if (h.toolName) {
              last.tools = [...(last.tools ?? []), h.toolName];
            } else if (h.content) {
              last.text += last.text && !h.content.startsWith("(") ? "\n" : "";
              last.text += h.content;
            }
            continue;
          }
          if (h.role === "user") {
            msgs.push({ id: h.id, role: "user", text: h.content ?? "", createdAt: h.createdAt });
          } else if (h.role === "assistant") {
            msgs.push({
              id: h.id,
              role: "assistant",
              text: h.content ?? "",
              tools: h.toolName ? [h.toolName] : [],
              createdAt: h.createdAt,
            });
          } else if (h.role === "tool" && h.toolName) {
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant") last.tools = [...(last.tools ?? []), h.toolName];
          }
        }
        if (msgs.length) setMessages(msgs);
      })
      .catch(() => {
        /* serveur indisponible — on démarre une conversation neuve */
      })
      .finally(() => setHydrating(false));
  }, []);

  const patch = (id: string, fn: (m: Msg) => Msg) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: Msg = { id: uid(), role: "user", text, createdAt: nowIso() };
    const aiMsg: Msg = { id: uid(), role: "assistant", text: "", tools: [], createdAt: nowIso() };
    setMessages((p) => [...p, userMsg, aiMsg]);

    const request = () =>
      streamChat({
        message: text,
        channel: "chat",
        locale,
        sessionId: sessionRef.current,
        context: snapshot(),
      });

    // reconnexion auto : jusqu'à 2 tentatives si le flux s'arrête sans `done` ni `error`
    const MAX_ATTEMPTS = 2;
    let sessionEnded = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !sessionEnded; attempt++) {
      if (attempt > 0) patch(aiMsg.id, (m) => ({ ...m, text: m.text + "… (reconnexion)" }));
      try {
        for await (const d of request()) {
          if (d.type === "text") {
            patch(aiMsg.id, (m) => ({ ...m, text: m.text + d.value, pendingTool: false }));
          } else if (d.type === "tool_call") {
            patch(aiMsg.id, (m) => ({
              ...m,
              tools: [...(m.tools ?? []), d.tool],
              pendingTool: true,
            }));
          } else if (d.type === "action_proposal")
            patch(aiMsg.id, (m) => ({ ...m, proposal: d.proposal, proposalState: "pending", pendingTool: false }));
          else if (d.type === "done") {
            sessionEnded = true;
            sessionRef.current = d.sessionId;
            localStorage.setItem(STORAGE_KEY, d.sessionId);
          } else if (d.type === "error") {
            sessionEnded = true;
            patch(aiMsg.id, (m) => ({ ...m, text: `${m.text}\n⚠️ ${d.message}`, pendingTool: false }));
          }
        }
      } catch {
        if (attempt === MAX_ATTEMPTS - 1) {
          sessionEnded = true;
          patch(aiMsg.id, (m) => ({ ...m, text: `${m.text}\n⚠️ ${t("moumen.reconnectFailed")}`, pendingTool: false }));
        }
      }
    }
    patch(aiMsg.id, (m) => ({ ...m, pendingTool: false }));
    setBusy(false);
  }

  async function onConfirm(m: Msg) {
    if (!m.proposal) return;
    try {
      await confirmAction(m.proposal.actionToken);
      patch(m.id, (x) => ({ ...x, proposalState: "confirmed" }));
    } catch {
      patch(m.id, (x) => ({ ...x, proposalState: "error" }));
    }
  }

  // type="submit" envoie via le bouton : s'assure que l'IA peut être re-soumise
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-2xl flex-col p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">🧠 {t("moumen.title")}</h1>

      <div className="mt-4">
        <VoicePanel />
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {hydrating && (
          <p className="text-sm text-muted">{t("moumen.loadingHistory")}</p>
        )}
        {messages.length === 0 && !hydrating && (
          <p className="text-sm text-muted">{t("moumen.notWired")}</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-end" : ""}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-honey text-white"
                  : "card"
              }`}
            >
              {m.text || (m.role === "assistant" && !m.proposal ? "…" : "")}
              {m.tools && m.tools.length > 0 && (
                <div className="label-mono mt-1 opacity-70">↳ {m.tools.join(", ")}</div>
              )}
              {m.pendingTool && (
                <div className="label-mono mt-1 flex items-center gap-1 text-muted">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-propolis" />
                  {t("moumen.executing")}
                </div>
              )}
              <div className="label-mono mt-1 text-[10px] opacity-50">{fmtTime(m.createdAt)}</div>
            </div>

            {m.proposal && (
              <div className="card mt-2 border-warn/40 p-3 text-sm">
                <div className="label-mono text-warn">
                  Confirmation {m.proposal.level === 3 ? "· action sensible" : "requise"}
                </div>
                <p className="mt-1">{m.proposal.summary}</p>
                {m.proposalState === "pending" ? (
                  <div className="mt-2 flex gap-2">
                    <button className="btn-primary !py-1.5" onClick={() => onConfirm(m)}>
                      {t("common.confirm")}
                    </button>
                    <button
                      className="btn-ghost !py-1.5"
                      onClick={() => patch(m.id, (x) => ({ ...x, proposalState: "cancelled" }))}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 label-mono">
                    {m.proposalState === "confirmed"
                      ? "✅ exécuté"
                      : m.proposalState === "error"
                        ? "⚠️ échec"
                        : "annulé"}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
          placeholder={t("moumen.placeholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button className="btn-primary" disabled={busy || !input.trim()}>
          {t("moumen.send")}
        </button>
      </form>
    </div>
  );
}
