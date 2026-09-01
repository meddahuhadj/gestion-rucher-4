import type { AttachmentCategory, UploadTicket } from "@moumen/shared";
import { api } from "./api";

/** Compresse une image côté client avant upload — §48. */
async function compress(file: Blob, maxDim = 1600, quality = 0.72): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const cctx = canvas.getContext("2d");
  if (!cctx) return file;
  cctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve) =>
    canvas.toBlob(
      (b) => resolve(b ?? file),
      "image/jpeg",
      quality,
    ),
  );
}

export type UploadMeta = {
  category: AttachmentCategory;
  hiveId?: string;
  apiaryId?: string;
  inspectionId?: string;
  caption?: string;
};

/** Compresse → demande une URL signée → PUT → renvoie l'id de la pièce jointe. */
export async function uploadImage(
  file: Blob,
  meta: UploadMeta,
): Promise<{ attachmentId: string }> {
  const blob = file.type === "image/jpeg" ? await compress(file) : await compress(file);

  const ticket = await api<UploadTicket>("/attachments", {
    method: "POST",
    body: {
      category: meta.category,
      mime: "image/jpeg",
      sizeBytes: blob.size,
      hiveId: meta.hiveId,
      apiaryId: meta.apiaryId,
      inspectionId: meta.inspectionId,
      caption: meta.caption,
      takenAt: new Date().toISOString(),
    },
  });

  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "image/jpeg", "x-upsert": "true" },
    body: blob,
  });
  if (!put.ok) throw new Error(`Upload échoué (${put.status})`);

  return { attachmentId: ticket.attachmentId };
}
