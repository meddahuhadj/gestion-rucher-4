import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Harvest, ProductionStats } from "@moumen/shared";
import { api } from "@/lib/api";
import { fmtWeight as kg } from "@/lib/format";

export default function HarvestsPage() {
  const { t } = useTranslation();

  const stats = useQuery({
    queryKey: ["harvests", "stats"],
    queryFn: () => api<ProductionStats>("/harvests/stats"),
  });
  const list = useQuery({
    queryKey: ["harvests", "list"],
    queryFn: () => api<{ data: Harvest[] }>("/harvests").then((r) => r.data),
  });

  const s = stats.data;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">{t("nav.harvests")}</h1>

      {s && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label={t("harvests.total")} value={kg(s.totalKg)} />
          <Tile label={t("harvests.avgPerHive")} value={kg(s.averageKgPerHive)} />
          <Tile label={t("harvests.count")} value={String(s.harvestCount)} />
          <Tile
            label={t("harvests.bestHive")}
            value={s.bestHive ? `n°${s.bestHive.hiveNumber} · ${kg(s.bestHive.totalKg)}` : "—"}
          />
        </div>
      )}

      <section className="mt-6">
        <h2 className="label-mono">{t("harvests.recent")}</h2>
        {list.isLoading && <p className="mt-2 text-sm text-muted">{t("common.loading")}</p>}
        {list.data?.length === 0 && <p className="mt-2 text-sm text-muted">—</p>}
        <ul className="mt-2 space-y-2">
          {list.data?.map((h) => (
            <li key={h.id} className="card flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">
                  {h.harvestedAt}
                  {h.honeyType ? <span className="text-muted"> · {h.honeyType}</span> : null}
                </div>
                <div className="label-mono mt-0.5">
                  {h.hiveId ? `${t("hives.number")} ?` : t("nav.apiaries")}
                  {h.batchCode ? ` · ${h.batchCode}` : ""}
                  {h.author ? ` · ${h.author}` : ""}
                </div>
              </div>
              <span className="font-display text-lg font-semibold tabular-nums">{kg(h.quantityKg)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="label-mono">{label}</div>
      <div className="mt-0.5 font-display text-base font-semibold">{value}</div>
    </div>
  );
}
