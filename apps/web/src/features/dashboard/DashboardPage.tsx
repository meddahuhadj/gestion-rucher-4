import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { Severity } from "@moumen/shared";
import { dashboardApi } from "./api";
import { fmtDate, fmtMoney } from "@/lib/format";

const SEV_DOT: Record<Severity, string> = {
  normal: "bg-ok",
  watch: "bg-warn",
  attention: "bg-attn",
  urgent: "bg-danger",
};

function StatTile({
  label,
  value,
  tone = "ink",
  onClick,
}: {
  label: string;
  value: string | number;
  tone?: "ink" | "attn" | "ok";
  onClick?: () => void;
}) {
  const c = tone === "attn" ? "text-attn" : tone === "ok" ? "text-ok" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className="card p-4 text-start transition-colors enabled:hover:border-honey disabled:cursor-default"
      disabled={!onClick}
    >
      <div className="label-mono">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold tabular-nums ${c}`}>{value}</div>
    </button>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const overview = useQuery({ queryKey: ["overview"], queryFn: dashboardApi.overview });
  const alerts = useQuery({ queryKey: ["alerts", "unread"], queryFn: dashboardApi.alerts });

  // recalcule les alertes au chargement du tableau de bord (en attendant un cron)
  useEffect(() => {
    dashboardApi
      .scan()
      .then(() => {
        void qc.invalidateQueries({ queryKey: ["alerts", "unread"] });
        void qc.invalidateQueries({ queryKey: ["overview"] });
      })
      .catch(() => {});
  }, [qc]);

  const o = overview.data;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">{t("dashboard.greeting")}</h1>
      <p className="label-mono mt-1">
        {fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={t("dashboard.activeHives")}
          value={o?.hives.live ?? "…"}
          onClick={() => navigate("/hives")}
        />
        <StatTile
          label={t("dashboard.alerts")}
          value={o?.alerts.total ?? 0}
          tone={o && o.alerts.total > 0 ? "attn" : "ink"}
        />
        <StatTile
          label={t("dashboard.inspectionsToday")}
          value={o?.inspections.last7d ?? 0}
          onClick={() => navigate("/inspections")}
        />
        <StatTile
          label={t("dashboard.tasks")}
          value={o ? o.tasks.overdue + o.tasks.dueToday : 0}
          tone={o && o.tasks.overdue > 0 ? "attn" : "ink"}
          onClick={() => navigate("/tasks")}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile
          label={`${t("harvests.total")} ${o?.production.year ?? ""}`}
          value={o ? `${o.production.totalKg} kg` : "…"}
          onClick={() => navigate("/harvests")}
        />
        <StatTile
          label={t("finance.profit")}
          value={o ? fmtMoney(o.finance.month.profit) : "…"}
          tone={o && o.finance.month.profit < 0 ? "attn" : "ok"}
          onClick={() => navigate("/finance")}
        />
        <StatTile
          label={t("dashboard.upcomingTasks")}
          value={o?.tasks.upcoming ?? 0}
          onClick={() => navigate("/calendar")}
        />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="label-mono">{t("dashboard.insightsTitle")}</h2>
        {alerts.data && alerts.data.length === 0 && (
          <p className="mt-2 text-sm text-ink-soft">{t("dashboard.insightsEmpty")}</p>
        )}
        <ul className="mt-3 space-y-2">
          {alerts.data?.slice(0, 6).map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${SEV_DOT[a.severity]}`} />
              <button
                className="flex-1 text-start hover:underline"
                onClick={() => a.hiveId && navigate(`/hives/${a.hiveId}`)}
              >
                {a.title}
              </button>
              <button
                className="label-mono text-muted hover:text-ink"
                onClick={async () => {
                  await dashboardApi.markRead(a.id);
                  void qc.invalidateQueries({ queryKey: ["alerts", "unread"] });
                  void qc.invalidateQueries({ queryKey: ["overview"] });
                }}
              >
                ✓
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button className="btn-primary mt-6 w-full md:w-auto" onClick={() => navigate("/moumen")}>
        🎙️ {t("dashboard.talkToMoumen")}
      </button>
    </div>
  );
}
