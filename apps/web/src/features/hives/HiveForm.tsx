import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  COLONY_STRENGTH,
  HIVE_STATUS,
  zHiveCreate,
  type ColonyStrength,
  type Hive,
  type HiveStatus,
  type HiveUpdate,
  type Queen,
} from "@moumen/shared";
import { Modal } from "@/components/Modal";
import { PhotoField } from "@/components/PhotoField";
import { api, ApiRequestError } from "@/lib/api";
import { apiariesApi } from "@/features/apiaries/api";
import { hivesApi } from "./api";

type Props = {
  hive?: Hive;
  defaultApiaryId?: string;
  suggestedNumber?: number;
  onClose: () => void;
  onSaved: (h: Hive) => void;
};

/** Création / édition d'une ruche (§9). Rucher obligatoire, n° unique par rucher. */
export function HiveForm({ hive, defaultApiaryId, suggestedNumber, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const editing = !!hive;

  const apiaries = useQuery({ queryKey: ["apiaries"], queryFn: apiariesApi.list });

  const [apiaryId, setApiaryId] = useState(hive?.apiaryId ?? defaultApiaryId ?? "");
  const [number, setNumber] = useState(
    hive?.number != null
      ? String(hive.number)
      : suggestedNumber != null
        ? String(suggestedNumber)
        : "",
  );
  const [name, setName] = useState(hive?.name ?? "");
  const [origin, setOrigin] = useState(hive?.origin ?? "");
  const [hiveType, setHiveType] = useState(hive?.hiveType ?? "");
  const [strain, setStrain] = useState(hive?.strain ?? "");
  const [status, setStatus] = useState<HiveStatus>(hive?.status ?? "active");
  const [strength, setStrength] = useState<ColonyStrength | "">(hive?.strength ?? "");
  const [notes, setNotes] = useState(hive?.notes ?? "");
  const [photoId, setPhotoId] = useState<string | null>(hive?.photoAttachmentId ?? null);
  const [queenId, setQueenId] = useState<string>(hive?.currentQueenId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reines assignables (édition uniquement) : actives + la reine courante.
  const queens = useQuery({
    queryKey: ["queens", "assignable"],
    queryFn: () =>
      api<{ data: Queen[] }>("/queens", { query: { status: "active" } }).then((r) => r.data),
    enabled: editing,
  });

  const effectiveApiaryId = useMemo(() => {
    if (apiaryId) return apiaryId;
    const list = apiaries.data ?? [];
    const only = list.length === 1 ? list[0] : undefined;
    return only ? only.id : "";
  }, [apiaryId, apiaries.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const raw = {
      apiaryId: effectiveApiaryId,
      number: Number(number),
      name: name.trim() || undefined,
      origin: origin.trim() || undefined,
      hiveType: hiveType.trim() || undefined,
      strain: strain.trim() || undefined,
      status,
      strength: strength || null,
      notes: notes.trim() || undefined,
    };
    const parsed = zHiveCreate.omit({ clientUuid: true }).safeParse(raw);
    if (!parsed.success) {
      setError(t("error.validation_failed"));
      return;
    }

    setBusy(true);
    try {
      const saved = editing
        ? await hivesApi.update(hive.id, {
            ...parsed.data,
            photoAttachmentId: photoId,
            currentQueenId: queenId || null,
          } satisfies HiveUpdate)
        : await hivesApi.create(
            photoId ? { ...parsed.data, photoAttachmentId: photoId } : parsed.data,
          );
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? t(err.i18nKey ?? "error.internal")
          : t("error.internal"),
      );
    } finally {
      setBusy(false);
    }
  }

  const noApiary = !apiaries.isLoading && (apiaries.data?.length ?? 0) === 0;

  return (
    <Modal title={editing ? t("hives.edit") : t("hives.new")} onClose={onClose}>
      {noApiary ? (
        <p className="text-sm text-muted">{t("hives.needApiary")}</p>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <label className="block">
            <span className="label-mono">{t("nav.apiaries")}</span>
            <select
              className="input mt-1"
              value={effectiveApiaryId}
              onChange={(e) => setApiaryId(e.target.value)}
              disabled={editing}
              required
            >
              <option value="" disabled>
                —
              </option>
              {apiaries.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label-mono">{t("hives.number")}</span>
              <input
                className="input mt-1"
                inputMode="numeric"
                autoFocus
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, ""))}
                required
              />
            </label>
            <label className="block">
              <span className="label-mono">{t("hives.name")}</span>
              <input
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label-mono">{t("hives.status")}</span>
              <select
                className="input mt-1"
                value={status}
                onChange={(e) => setStatus(e.target.value as HiveStatus)}
              >
                {HIVE_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {t(`hiveStatus.${s}`, s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-mono">{t("hives.strength")}</span>
              <select
                className="input mt-1"
                value={strength}
                onChange={(e) => setStrength(e.target.value as ColonyStrength | "")}
              >
                <option value="">—</option>
                {COLONY_STRENGTH.map((s) => (
                  <option key={s} value={s}>
                    {t(`strength.${s}`, s)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label-mono">{t("hives.hiveType")}</span>
              <input
                className="input mt-1"
                value={hiveType}
                onChange={(e) => setHiveType(e.target.value)}
                maxLength={120}
                placeholder="Langstroth"
              />
            </label>
            <label className="block">
              <span className="label-mono">{t("hives.strain")}</span>
              <input
                className="input mt-1"
                value={strain}
                onChange={(e) => setStrain(e.target.value)}
                maxLength={120}
              />
            </label>
          </div>

          <label className="block">
            <span className="label-mono">{t("hives.origin")}</span>
            <input
              className="input mt-1"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              maxLength={120}
            />
          </label>

          <label className="block">
            <span className="label-mono">{t("apiaries.notes")}</span>
            <textarea
              className="input mt-1 min-h-[64px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
            />
          </label>

          {editing && (
            <label className="block">
              <span className="label-mono">{t("hives.currentQueen")}</span>
              <select
                className="input mt-1"
                value={queenId}
                onChange={(e) => setQueenId(e.target.value)}
              >
                <option value="">{t("hives.noQueen")}</option>
                {queenId &&
                  !queens.data?.some((q) => q.id === queenId) && (
                    <option value={queenId}>👑 …</option>
                  )}
                {queens.data?.map((q) => (
                  <option key={q.id} value={q.id}>
                    👑 {q.strain ?? "?"}
                    {q.birthYear ? ` · ${q.birthYear}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <PhotoField
            value={photoId}
            onChange={setPhotoId}
            meta={{ category: "hive", hiveId: hive?.id }}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </button>
            <button
              className="btn-primary"
              disabled={busy || !effectiveApiaryId || !number}
            >
              {busy ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
