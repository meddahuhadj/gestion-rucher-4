import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { attachmentsApi } from "@/features/attachments/api";
import { uploadImage, type UploadMeta } from "@/lib/upload";

type Props = {
  value: string | null;
  onChange: (attachmentId: string | null) => void;
  meta: UploadMeta;
};

/** Sélecteur de photo : upload compressé, aperçu via URL signée, retrait. */
export function PhotoField({ value, onChange, meta }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ["attachment", value],
    queryFn: () => attachmentsApi.get(value as string),
    enabled: !!value,
    staleTime: 30 * 60_000,
  });

  async function pick(file: File) {
    setError(null);
    setBusy(true);
    try {
      const { attachmentId } = await uploadImage(file, meta);
      onChange(attachmentId);
    } catch {
      setError(t("photo.failed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <span className="label-mono">{t("photo.label")}</span>
      <div className="mt-1 flex items-center gap-3">
        {value && preview.data?.url ? (
          <img
            src={preview.data.url}
            alt=""
            className="h-16 w-16 flex-none rounded-xl border border-border object-cover"
          />
        ) : (
          <div className="grid h-16 w-16 flex-none place-items-center rounded-xl border border-dashed border-border text-xl text-muted">
            📷
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t("common.loading") : value ? t("photo.replace") : t("photo.add")}
          </button>
          {value && (
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => onChange(null)}
            >
              {t("photo.remove")}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-1 text-sm text-danger">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
        }}
      />
    </div>
  );
}
