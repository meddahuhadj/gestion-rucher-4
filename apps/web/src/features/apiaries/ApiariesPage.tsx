import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Apiary } from "@moumen/shared";
import { Modal } from "@/components/Modal";
import { ApiRequestError } from "@/lib/api";
import { attachmentsApi } from "@/features/attachments/api";
import { apiariesApi } from "./api";
import { ApiaryForm } from "./ApiaryForm";

export default function ApiariesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<{ apiary?: Apiary } | null>(null);
  const [toDelete, setToDelete] = useState<Apiary | null>(null);

  const apiaries = useQuery({
    queryKey: ["apiaries"],
    queryFn: apiariesApi.list,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["apiaries"] });

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{t("nav.apiaries")}</h1>
        <button className="btn-primary" onClick={() => setForm({})}>
          + {t("apiaries.new")}
        </button>
      </div>

      {apiaries.isLoading && <p className="mt-6 text-sm text-muted">{t("common.loading")}</p>}
      {apiaries.data?.length === 0 && (
        <p className="mt-6 text-sm text-muted">{t("apiaries.empty")}</p>
      )}

      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {apiaries.data?.map((a) => {
          const hasHives = (a.hiveCount ?? 0) > 0;
          return (
            <li key={a.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 gap-3">
                  {a.photoAttachmentId && <ApiaryThumb id={a.photoAttachmentId} />}
                  <div className="min-w-0">
                    <div className="font-display text-lg font-semibold">{a.name}</div>
                    <div className="label-mono mt-1">
                      {a.location ?? "—"} · {a.hiveCount ?? 0} 🐝
                    </div>
                    {a.notes && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{a.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <button
                    className="label-mono hover:text-honey"
                    onClick={() => setForm({ apiary: a })}
                  >
                    {t("apiaries.edit")}
                  </button>
                  <button
                    className="label-mono hover:text-danger disabled:opacity-40 disabled:hover:text-muted"
                    disabled={hasHives}
                    title={hasHives ? t("apiaries.deleteBlocked") : undefined}
                    onClick={() => setToDelete(a)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {form && (
        <ApiaryForm
          apiary={form.apiary}
          onClose={() => setForm(null)}
          onSaved={() => void refresh()}
        />
      )}

      {toDelete && (
        <DeleteApiaryDialog
          apiary={toDelete}
          onClose={() => setToDelete(null)}
          onDone={() => {
            setToDelete(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function ApiaryThumb({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["attachment", id],
    queryFn: () => attachmentsApi.get(id),
    staleTime: 30 * 60_000,
  });
  if (!q.data?.url) return null;
  return (
    <img
      src={q.data.url}
      alt=""
      className="h-14 w-14 flex-none rounded-xl border border-border object-cover"
    />
  );
}

function DeleteApiaryDialog({
  apiary,
  onClose,
  onDone,
}: {
  apiary: Apiary;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await apiariesApi.remove(apiary.id);
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? t(err.i18nKey ?? "error.internal")
          : t("error.internal"),
      );
      setBusy(false);
    }
  }

  return (
    <Modal title={t("apiaries.delete")} onClose={onClose}>
      <p className="text-sm text-ink-soft">
        {t("apiaries.deleteConfirm", { name: apiary.name })}
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy ? t("common.loading") : t("common.delete")}
        </button>
      </div>
    </Modal>
  );
}
