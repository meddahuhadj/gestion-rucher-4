import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Inspection } from "@moumen/shared";
import { api } from "@/lib/api";
import { hivesApi } from "./api";
import { HiveForm } from "./HiveForm";
import { attachmentsApi } from "@/features/attachments/api";
import { Modal } from "@/components/Modal";
import { ApiRequestError } from "@/lib/api";
import { useAppContext } from "@/store/appContext";
import { QuickInspectionForm } from "@/features/inspections/QuickInspectionForm";
import { fmtDate } from "@/lib/format";

export default function HiveDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const setCtx = useAppContext((s) => s.set);
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const hive = useQuery({ queryKey: ["hive", id], queryFn: () => hivesApi.get(id), enabled: !!id });

  const inspections = useQuery({
    queryKey: ["inspections", { hiveId: id }],
    queryFn: () =>
      api<{ data: Inspection[] }>("/inspections", { query: { hiveId: id, limit: 20 } }).then(
        (r) => r.data,
      ),
    enabled: !!id,
  });

  // alimente le Context Engine (§10) tant que la fiche est ouverte
  useEffect(() => {
    if (hive.data) setCtx({ currentHiveId: hive.data.id, currentApiaryId: hive.data.apiaryId });
    return () => setCtx({ currentHiveId: null });
  }, [hive.data, setCtx]);

  if (hive.isLoading) return <p className="p-8 text-sm text-muted">{t("common.loading")}</p>;
  if (!hive.data) return <p className="p-8 text-sm text-danger">{t("error.not_found")}</p>;
  const h = hive.data;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <Link to="/hives" className="label-mono">← {t("hives.title")}</Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {h.photoAttachmentId && <HiveThumb id={h.photoAttachmentId} />}
          <div>
            <h1 className="font-display text-2xl font-semibold">
              {t("hives.number")} {h.number}
              {h.name ? <span className="text-muted"> · {h.name}</span> : null}
            </h1>
            <p className="label-mono mt-1">
              {t("hives.status")}: {h.status} · {t("hives.strength")}: {h.strength ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button className="btn-primary" onClick={() => navigate(`/hives/${h.id}/inspect`)}>
            🔍 {t("hiveDetail.startInspection")}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setCtx({ currentHiveId: h.id, currentApiaryId: h.apiaryId });
              navigate("/moumen");
            }}
          >
            🎙️ {t("hiveDetail.askMoumen")}
          </button>
          <button className="btn-ghost" onClick={() => setEditing(true)}>
            ✏️ {t("hives.edit")}
          </button>
          {h.status === "archived" ? (
            <button
              className="btn-ghost"
              onClick={async () => {
                await hivesApi.update(h.id, { status: "active" });
                void qc.invalidateQueries({ queryKey: ["hive", id] });
                void qc.invalidateQueries({ queryKey: ["hives"] });
              }}
            >
              ♻️ {t("hiveDetail.unarchive")}
            </button>
          ) : (
            <button
              className="btn-ghost text-danger"
              onClick={() => setArchiveOpen(true)}
            >
              📦 {t("hiveDetail.archive")}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <HiveForm
          hive={h}
          onClose={() => setEditing(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["hive", id] });
            void qc.invalidateQueries({ queryKey: ["hives"] });
          }}
        />
      )}

      {archiveOpen && (
        <ArchiveDialog
          hiveId={h.id}
          onClose={() => setArchiveOpen(false)}
          onDone={() => {
            void qc.invalidateQueries({ queryKey: ["hives"] });
            navigate("/hives");
          }}
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label={t("hives.lastInspection")} value={fmt(h.lastInspectionAt)} />
        <Tile label={t("hiveDetail.nextInspection")} value={fmt(h.nextInspectionAt)} />
        <Tile label={t("hiveDetail.queen")} value={h.currentQueenId ? "✓" : "—"} />
      </div>

      <div className="mt-6">
        <QuickInspectionForm hiveId={h.id} />
      </div>

      <section className="mt-6">
        <h2 className="label-mono">{t("hiveDetail.inspections")}</h2>
        {inspections.isLoading && <p className="mt-2 text-sm text-muted">{t("common.loading")}</p>}
        {inspections.data?.length === 0 && (
          <p className="mt-2 text-sm text-muted">{t("hiveDetail.noInspections")}</p>
        )}
        <ul className="mt-2 space-y-2">
          {inspections.data?.map((i) => (
            <li key={i.id} className="card p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{fmt(i.performedAt)}</span>
                <span className="label-mono">
                  {i.author ? `${i.author} · ` : ""}
                  {i.method}
                </span>
              </div>
              <div className="mt-1 text-ink-soft">
                {i.colonyStrength ? `${t("hives.strength")}: ${i.colonyStrength}` : ""}
                {i.queenSeen != null ? ` · ${t("hiveDetail.queen")}: ${i.queenSeen ? "vue" : "non vue"}` : ""}
                {i.storesHoney ? ` · 🍯 ${i.storesHoney}` : ""}
              </div>
              {i.notes && <p className="mt-1">{i.notes}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const fmt = (iso: string | null) => (iso ? fmtDate(iso) : "—");

function ArchiveDialog({
  hiveId,
  onClose,
  onDone,
}: {
  hiveId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await hivesApi.archive(hiveId, reason.trim());
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
    <Modal title={t("hiveDetail.archive")} onClose={onClose}>
      <p className="text-sm text-muted">{t("hiveDetail.archiveHint")}</p>
      <textarea
        className="input mt-3 min-h-[80px]"
        autoFocus
        placeholder={t("hiveDetail.archiveReason")}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={400}
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !reason.trim()}
          onClick={() => void confirm()}
        >
          {busy ? t("common.loading") : t("hiveDetail.archive")}
        </button>
      </div>
    </Modal>
  );
}

function HiveThumb({ id }: { id: string }) {
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
      className="h-16 w-16 flex-none rounded-xl border border-border object-cover"
    />
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="label-mono">{label}</div>
      <div className="mt-0.5 font-display text-lg font-semibold">{value}</div>
    </div>
  );
}
