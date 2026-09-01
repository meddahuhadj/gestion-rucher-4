import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActionProposal } from "@moumen/shared";
import { useSessionStore } from "@/store/session";
import { snapshot } from "@/store/appContext";
import {
  startVoiceSession,
  type VoiceController,
  type VoiceEvent,
  type VoiceState,
} from "@/services/voice/liveSession";
import { confirmAction } from "./api";

type Line = { role: "user" | "assistant"; text: string; final: boolean };

const ORB: Record<VoiceState, string> = {
  idle: "bg-border",
  connecting: "bg-warn animate-pulse",
  listening: "bg-propolis",
  speaking: "bg-honey animate-pulse",
  error: "bg-danger",
};

export function VoicePanel() {
  const { t } = useTranslation();
  const locale = useSessionStore((s) => s.locale);
  const [state, setState] = useState<VoiceState>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [err, setErr] = useState("");
  const ctrl = useRef<VoiceController | null>(null);

  useEffect(() => () => void ctrl.current?.stop(), []);

  function onEvent(e: VoiceEvent) {
    if (e.type === "state") setState(e.state);
    else if (e.type === "tool") setTools((p) => [...p.slice(-2), e.name]);
    else if (e.type === "proposal") setProposals((p) => [...p, e.proposal]);
    else if (e.type === "error") setErr(e.message);
    else if (e.type === "transcript") {
      setLines((prev) => {
        let idx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i]!.role === e.role && !prev[i]!.final) {
            idx = i;
            break;
          }
        }
        const line: Line = { role: e.role, text: e.text, final: e.final };
        if (idx === -1) return [...prev, line].slice(-12);
        const copy = prev.slice();
        copy[idx] = line;
        return copy.slice(-12);
      });
    }
  }

  async function toggle() {
    if (state === "idle" || state === "error") {
      setErr("");
      setLines([]);
      const ctxText = describeContext();
      try {
        ctrl.current = await startVoiceSession({ locale, contextText: ctxText, onEvent });
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    } else {
      await ctrl.current?.stop();
      ctrl.current = null;
    }
  }

  const active = state !== "idle" && state !== "error";

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${ORB[state]}`} />
        <span className="label-mono flex-1">{t(`voice.state.${state}`)}</span>
        <button className={active ? "btn-ghost" : "btn-primary"} onClick={toggle}>
          {active ? `⏹ ${t("voice.stop")}` : `🎙️ ${t("voice.start")}`}
        </button>
      </div>

      {err && <p className="mt-2 text-sm text-danger">{t(`voice.err.${err}`, t("error.ai_unavailable"))}</p>}

      {lines.length > 0 && (
        <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto text-sm">
          {lines.map((l, i) => (
            <p key={i} className={l.role === "user" ? "text-end" : ""}>
              <span
                className={`inline-block rounded-xl px-3 py-1.5 ${
                  l.role === "user" ? "bg-honey text-white" : "bg-surface-2"
                } ${l.final ? "" : "opacity-70"}`}
              >
                {l.text}
              </span>
            </p>
          ))}
        </div>
      )}

      {tools.length > 0 && (
        <p className="label-mono mt-2 text-muted">↳ {tools.join(" · ")}</p>
      )}

      {proposals.map((p) => (
        <div key={p.actionToken} className="card mt-2 border-warn/40 p-3 text-sm">
          <div className="label-mono text-warn">
            {p.level === 3 ? t("voice.sensitive") : t("common.confirm")}
          </div>
          <p className="mt-1">{p.summary}</p>
          <div className="mt-2 flex gap-2">
            <button
              className="btn-primary !py-1.5"
              onClick={async () => {
                await confirmAction(p.actionToken).catch(() => undefined);
                setProposals((list) => list.filter((x) => x.actionToken !== p.actionToken));
              }}
            >
              {t("common.confirm")}
            </button>
            <button
              className="btn-ghost !py-1.5"
              onClick={() =>
                setProposals((list) => list.filter((x) => x.actionToken !== p.actionToken))
              }
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function describeContext(): string {
  const s = snapshot();
  const bits: string[] = [];
  if (s.page) bits.push(`page ${s.page}`);
  if (s.currentHiveId) bits.push(`ruche active ${s.currentHiveId.slice(0, 8)}`);
  return bits.join(", ");
}
