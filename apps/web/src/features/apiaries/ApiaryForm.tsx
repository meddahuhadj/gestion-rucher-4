import { useState } from "react";
import { useTranslation } from "react-i18next";
import { zApiaryCreate, type Apiary, type ApiaryUpdate } from "@moumen/shared";
import { Modal } from "@/components/Modal";
import { PhotoField } from "@/components/PhotoField";
import { ApiRequestError } from "@/lib/api";
import { apiariesApi } from "./api";

type Props = {
  apiary?: Apiary;
  onClose: () => void;
  onSaved: (a: Apiary) => void;
};

/** Création / édition d'un rucher (§4). Champs libres + géoloc optionnelle. */
export function ApiaryForm({ apiary, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const editing = !!apiary;

  const [name, setName] = useState(apiary?.name ?? "");
  const [location, setLocation] = useState(apiary?.location ?? "");
  const [lat, setLat] = useState(apiary?.lat != null ? String(apiary.lat) : "");
  const [lng, setLng] = useState(apiary?.lng != null ? String(apiary.lng) : "");
  const [notes, setNotes] = useState(apiary?.notes ?? "");
  const [photoId, setPhotoId] = useState<string | null>(apiary?.photoAttachmentId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const raw = {
      name: name.trim(),
      location: location.trim() || undefined,
      lat: lat.trim() ? Number(lat) : undefined,
      lng: lng.trim() ? Number(lng) : undefined,
      notes: notes.trim() || undefined,
    };
    const parsed = zApiaryCreate.omit({ clientUuid: true }).safeParse(raw);
    if (!parsed.success) {
      setError(t("error.validation_failed"));
      return;
    }

    setBusy(true);
    try {
      const saved = editing
        ? await apiariesApi.update(apiary.id, {
            ...parsed.data,
            photoAttachmentId: photoId,
          } satisfies ApiaryUpdate)
        : await apiariesApi.create(
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

  return (
    <Modal title={editing ? t("apiaries.edit") : t("apiaries.new")} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block">
          <span className="label-mono">{t("apiaries.name")}</span>
          <input
            className="input mt-1"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
        </label>

        <label className="block">
          <span className="label-mono">{t("apiaries.location")}</span>
          <input
            className="input mt-1"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={240}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label-mono">{t("apiaries.lat")}</span>
            <input
              className="input mt-1"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="36.75"
            />
          </label>
          <label className="block">
            <span className="label-mono">{t("apiaries.lng")}</span>
            <input
              className="input mt-1"
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="3.06"
            />
          </label>
        </div>

        <label className="block">
          <span className="label-mono">{t("apiaries.notes")}</span>
          <textarea
            className="input mt-1 min-h-[72px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={4000}
          />
        </label>

        <PhotoField
          value={photoId}
          onChange={setPhotoId}
          meta={{ category: "other", apiaryId: apiary?.id }}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary" disabled={busy || !name.trim()}>
            {busy ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
