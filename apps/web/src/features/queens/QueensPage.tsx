import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Queen } from "@moumen/shared";
import { api } from "@/lib/api";

export default function QueensPage() {
  const { t } = useTranslation();
  const [oldOnly, setOldOnly] = useState(false);

  const queens = useQuery({
    queryKey: ["queens", { oldOnly }],
    queryFn: () =>
      api<{ data: Queen[] }>("/queens", {
        query: oldOnly ? { olderThanYears: 3, status: "active" } : {},
      }).then((r) => r.data),
  });

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{t("nav.queens")}</h1>
        <div className="flex gap-1 text-sm">
          <button
            className={`rounded-lg px-3 py-1.5 ${!oldOnly ? "bg-honey-wash text-honey-ink" : "text-muted"}`}
            onClick={() => setOldOnly(false)}
          >
            {t("hives.filterAll")}
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 ${oldOnly ? "bg-honey-wash text-honey-ink" : "text-muted"}`}
            onClick={() => setOldOnly(true)}
          >
            {t("queens.old")}
          </button>
        </div>
      </div>

      {queens.isLoading && <p className="mt-6 text-sm text-muted">{t("common.loading")}</p>}
      {queens.data?.length === 0 && <p className="mt-6 text-sm text-muted">—</p>}

      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {queens.data?.map((q) => (
          <li key={q.id} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-semibold">
                👑 {q.strain ?? t("queens.unknownStrain")}
              </span>
              <span className="label-mono">{t(`queenStatus.${q.status}`, q.status)}</span>
            </div>
            <div className="label-mono mt-1">
              {q.birthYear ? `${q.birthYear}` : "—"}
              {q.ageYears != null ? ` · ${q.ageYears} ${t("queens.years")}` : ""}
              {q.quality ? ` · ${t(`queenQuality.${q.quality}`, q.quality)}` : ""}
            </div>
            {q.origin && <p className="mt-1 text-sm text-ink-soft">{q.origin}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
