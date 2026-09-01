import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { dashboardApi } from "@/features/dashboard/api";

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const overview = useQuery({ queryKey: ["overview"], queryFn: dashboardApi.overview });
  const o = overview.data;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">{t("nav.analytics")}</h1>
      {overview.isLoading && <p className="mt-6 text-sm text-muted">{t("common.loading")}</p>}

      {o && (
        <div className="mt-6 space-y-6">
          <Group title={t("analytics.hives")}>
            <Row label={t("dashboard.activeHives")} value={o.hives.live} />
            {Object.entries(o.hives.byStatus).map(([k, v]) => (
              <Row key={k} label={k} value={v} sub />
            ))}
          </Group>

          <Group title={t("analytics.activity")}>
            <Row label={t("analytics.inspections30")} value={o.inspections.last30d} />
            <Row label={t("analytics.inspections7")} value={o.inspections.last7d} />
            <Row label={t("dashboard.tasks")} value={o.tasks.overdue + o.tasks.dueToday} />
          </Group>

          <Group title={`${t("harvests.total")} · ${o.production.year}`}>
            <Row label="kg" value={o.production.totalKg} />
            {o.production.bestHive && (
              <Row
                label={t("harvests.bestHive")}
                value={`n°${o.production.bestHive.hiveNumber} (${o.production.bestHive.totalKg} kg)`}
              />
            )}
          </Group>

          <Group title={`${t("nav.finance")} · ${t("finance.month")}`}>
            <Row label={t("finance.revenue")} value={`${o.finance.month.revenue} DA`} />
            <Row label={t("finance.expense")} value={`${o.finance.month.expense} DA`} />
            <Row label={t("finance.profit")} value={`${o.finance.month.profit} DA`} />
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="label-mono">{title}</h2>
      <dl className="mt-2 divide-y divide-border">{children}</dl>
    </section>
  );
}

function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: boolean;
}) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${sub ? "text-muted" : ""}`}>
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
