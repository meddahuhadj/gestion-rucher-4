import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { FinanceSummary } from "@moumen/shared";
import { api } from "@/lib/api";
import { fmtMoney as dzd } from "@/lib/format";

type Preset = "week" | "month" | "year";
const PRESETS: Preset[] = ["week", "month", "year"];

export default function FinancePage() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>("month");

  const summary = useQuery({
    queryKey: ["finance", "summary", preset],
    queryFn: () =>
      api<FinanceSummary>("/finance/summary", { query: { preset } }),
  });

  const s = summary.data;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{t("nav.finance")}</h1>
        <div className="flex gap-1 text-sm">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`rounded-lg px-3 py-1.5 ${preset === p ? "bg-honey-wash text-honey-ink" : "text-muted"}`}
              onClick={() => setPreset(p)}
            >
              {t(`finance.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {summary.isLoading && <p className="mt-6 text-sm text-muted">{t("common.loading")}</p>}

      {s && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Tile label={t("finance.revenue")} value={dzd(s.totalRevenue)} tone="ok" />
            <Tile label={t("finance.expense")} value={dzd(s.totalExpense)} tone="attn" />
            <Tile
              label={t("finance.profit")}
              value={dzd(s.profit)}
              tone={s.profit >= 0 ? "ok" : "danger"}
            />
          </div>

          <section className="mt-6">
            <h2 className="label-mono">{t("finance.byCategory")}</h2>
            <ul className="mt-2 space-y-1">
              {s.expenseByCategory.length === 0 && (
                <li className="text-sm text-muted">—</li>
              )}
              {s.expenseByCategory.map((c) => (
                <li key={c.category} className="card flex justify-between p-3 text-sm">
                  <span>{t(`expenseCategory.${c.category}`, c.category)}</span>
                  <span className="tabular-nums">{dzd(c.total)}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="label-mono mt-4 text-muted">
            {s.from} → {s.to}
          </p>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "attn" | "danger";
}) {
  const c = tone === "ok" ? "text-ok" : tone === "attn" ? "text-attn" : "text-danger";
  return (
    <div className="card p-4">
      <div className="label-mono">{label}</div>
      <div className={`mt-1 font-display text-xl font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
