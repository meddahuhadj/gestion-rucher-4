import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { HiveListQuery, HiveStatus } from "@moumen/shared";
import { hivesApi } from "./api";
import { HiveForm } from "./HiveForm";
import { apiariesApi } from "@/features/apiaries/api";
import { ApiRequestError } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const STATUS_TONE: Record<HiveStatus, string> = {
  strong: "bg-ok/15 text-ok",
  active: "bg-ok/15 text-ok",
  medium: "bg-warn/15 text-warn",
  weak: "bg-attn/15 text-attn",
  very_weak: "bg-danger/15 text-danger",
  dead: "bg-danger/15 text-danger",
  sold: "bg-muted/15 text-muted",
  merged: "bg-muted/15 text-muted",
  archived: "bg-muted/15 text-muted",
};

type Filter = "active" | "weak" | "archived";
const FILTERS: Filter[] = ["active", "weak", "archived"];
const FILTER_QUERY: Record<Filter, Partial<HiveListQuery>> = {
  active: {},
  weak: { weak: true },
  archived: { archived: true },
};

export default function HivesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active");
  const [apiaryId, setApiaryId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const apiaries = useQuery({ queryKey: ["apiaries"], queryFn: apiariesApi.list });
  const apiaryName = new Map((apiaries.data ?? []).map((a) => [a.id, a.name]));
  const multiApiary = (apiaries.data?.length ?? 0) > 1;

  const hives = useQuery({
    queryKey: ["hives", filter, apiaryId],
    queryFn: () =>
      hivesApi.list({
        ...FILTER_QUERY[filter],
        ...(apiaryId ? { apiaryId } : {}),
      }),
  });

  const allHives = useQuery({
    queryKey: ["hives", "for-number"],
    queryFn: () => hivesApi.list({}),
  });
  const suggestedNumber =
    (allHives.data?.reduce((max, h) => Math.max(max, h.number), 0) ?? 0) + 1;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold">{t("hives.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {multiApiary && (
            <select
              className="input w-auto py-1.5 text-sm"
              value={apiaryId}
              onChange={(e) => setApiaryId(e.target.value)}
            >
              <option value="">{t("hives.allApiaries")}</option>
              {apiaries.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1 text-sm">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`rounded-lg px-3 py-1.5 ${
                  filter === f ? "bg-honey-wash text-honey-ink" : "text-muted"
                }`}
                onClick={() => setFilter(f)}
              >
                {t(`hives.filter.${f}`)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + {t("hives.new")}
          </button>
        </div>
      </div>

      {hives.isLoading && <p className="mt-6 text-sm text-muted">{t("common.loading")}</p>}

      {hives.isError && (
        <p className="mt-6 text-sm text-danger">
          {hives.error instanceof ApiRequestError
            ? t(hives.error.i18nKey ?? "error.internal")
            : t("error.internal")}
        </p>
      )}

      {hives.data && hives.data.length === 0 && (
        <p className="mt-6 text-sm text-muted">
          {filter === "archived" ? t("hives.emptyArchived") : t("hives.empty")}
        </p>
      )}

      {hives.data && hives.data.length > 0 && (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {hives.data.map((h) => (
            <li key={h.id}>
              <Link
                to={`/hives/${h.id}`}
                className="card flex items-center justify-between p-4 transition-colors hover:border-honey"
              >
                <div>
                  <div className="font-display text-lg font-semibold">
                    {t("hives.number")} {h.number}
                    {h.name ? <span className="text-muted"> · {h.name}</span> : null}
                  </div>
                  <div className="label-mono mt-1">
                    {multiApiary && apiaryName.get(h.apiaryId)
                      ? `${apiaryName.get(h.apiaryId)} · `
                      : ""}
                    {t("hives.lastInspection")}:{" "}
                    {h.lastInspectionAt ? fmtDate(h.lastInspectionAt) : t("hives.never")}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[h.status]}`}>
                  {t(`hiveStatus.${h.status}`, h.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <HiveForm
          suggestedNumber={suggestedNumber}
          onClose={() => setShowForm(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["hives"] })}
        />
      )}
    </div>
  );
}
