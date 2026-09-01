import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActionProposal } from "@moumen/shared";
import { useSessionStore } from "@/store/session";
import { snapshot } from "@/store/appContext";
import { streamChat, confirmAction } from "./api";
import { VoicePanel } from "./VoicePanel";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools?: string[];
  proposal?: ActionProposal;
  proposalState?: "pending" | "confirmed" | "cancelled" | "error";
};

const uid = () => Math.random().toString(36).slice(2);

export default function MoumenPage() {
  const { t } = useTranslation();
  const locale = useSessionStore((s) => s.locale);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<string | null>(null);

  const patch = (id: string, fn: (m: Msg) => Msg) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: Msg = { id: uid(), role: "user", text };
    const aiMsg: Msg = { id: uid(), role: "assistant", text: "", tools: [] };
    setMessages((p) => [...p, userMsg, aiMsg]);

    try {
      for await (const d of streamChat({
        message: text,
        channel: "chat",
        locale,
        sessionId: sessionRef.current,
        context: snapshot(),
      })) {
        if (d.type === "text") patch(aiMsg.id, (m) => ({ ...m, text: m.text + d.value }));
        else if (d.type === "tool_call")
          patch(aiMsg.id, (m) => ({ ...m, tools: [...(m.tools ?? []), d.tool] }));
        else if (d.type === "action_proposal")
          patch(aiMsg.id, (m) => ({ ...m, proposal: d.proposal, proposalState: "pending" }));
        else if (d.type === "done") sessionRef.current = d.sessionId;
        else if (d.type === "error")
          patch(aiMsg.id, (m) => ({ ...m, text: `${m.text}\n⚠️ ${d.message}` }));
      }
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-2xl flex-col p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">🧠 {t("moumen.title")}</h1>

      <div className="mt-4">
        <VoicePanel />
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
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
