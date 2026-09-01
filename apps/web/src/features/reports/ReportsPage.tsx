import { useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadReport, REPORT_KINDS, type ReportKind } from "./api";

const KIND_ICON: Record<ReportKind, string> = {
  hives: "🐝",
  inspections: "🔍",
  harvests: "🍯",
  expenses: "💸",
  revenues: "💰",
  tasks: "✅",
  treatments: "💊",
  queens: "👑",
};

export default function ReportsPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sep, setSep] = useState<"," | ";">(",");
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: ReportKind) {
    setError(null);
    setBusy(kind);
    try {
      await downloadReport(kind, {
        from: from || undefined,
        to: to || undefined,
        sep,
      });
    } catch {
      setError(t("error.internal"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">{t("nav.reports")}</h1>
      <p className="mt-1 text-sm text-muted">{t("reports.intro")}</p>

      <div className="card mt-4 grid gap-3 p-4 sm:grid-cols-3">
        <label className="block">
          <span className="label-mono">{t("reports.from")}</span>
          <input
            type="date"
            className="input mt-1"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label-mono">{t("reports.to")}</span>
          <input
            type="date"
            className="input mt-1"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label-mono">{t("reports.separator")}</span>
          <select
            className="input mt-1"
            value={sep}
            onChange={(e) => setSep(e.target.value as "," | ";")}
          >
            <option value=",">{t("reports.sepComma")}</option>
            <option value=";">{t("reports.sepSemicolon")}</option>
          </select>
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {REPORT_KINDS.map((kind) => (
          <li key={kind}>
            <button
              className="card flex w-full items-center justify-between p-4 text-left transition-colors hover:border-honey disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => void run(kind)}
            >
              <span className="font-display text-lg font-semibold">
                {KIND_ICON[kind]} {t(`reports.kind.${kind}`)}
              </span>
              <span className="label-mono">
                {busy === kind ? t("common.loading") : `${t("reports.download")} ↓`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
