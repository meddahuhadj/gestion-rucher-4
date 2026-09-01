import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Treatment } from "@moumen/shared";
import { api } from "@/lib/api";

export default function TreatmentsPage() {
  const { t } = useTranslation();

  const treatments = useQuery({
    queryKey: ["treatments"],
    queryFn: () => api<{ data: Treatment[] }>("/treatments").then((r) => r.data),
  });

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">{t("nav.treatments")}</h1>

      {treatments.isLoading && <p className="mt-6 text-sm text-muted">{t("common.loading")}</p>}
      {treatments.data?.length === 0 && <p className="mt-6 text-sm text-muted">—</p>}

      <ul className="mt-6 space-y-2">
        {treatments.data?.map((tr) => (
          <li key={tr.id} className="card p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{tr.product}</span>
              <span className="label-mono">{t(`treatmentTarget.${tr.target}`, tr.target)}</span>
            </div>
            <div className="label-mono mt-1">
              {tr.startedAt}
              {tr.endedAt ? ` → ${tr.endedAt}` : ` · ${t("treatments.ongoing")}`}
              {tr.dose ? ` · ${tr.dose}` : ""}
            </div>
            {tr.notes && <p className="mt-1 text-ink-soft">{tr.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
