import { z } from "zod";
import { zClientUuid, zEntityMeta, zId } from "../common.js";
import { ATTACHMENT_CATEGORY } from "../enums.js";

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const ALLOWED_AUDIO_MIME = ["audio/webm", "audio/mp4", "audio/mpeg"] as const;

/** Demande d'URL d'upload — le client compresse puis PUT sur l'URL signée. */
export const zUploadRequest = z.object({
  category: z.enum(ATTACHMENT_CATEGORY).default("other"),
  mime: z.enum([...ALLOWED_IMAGE_MIME, ...ALLOWED_AUDIO_MIME]),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
  hiveId: zId.optional(),
  apiaryId: zId.optional(),
  inspectionId: zId.optional(),
  taskId: zId.optional(),
  caption: z.string().max(400).optional(),
  takenAt: z.string().datetime().optional(),
  clientUuid: zClientUuid.optional(),
});
export type UploadRequest = z.infer<typeof zUploadRequest>;

export const zUploadTicket = z.object({
  attachmentId: zId,
  uploadUrl: z.string().url(),
  token: z.string(),
  path: z.string(),
});
export type UploadTicket = z.infer<typeof zUploadTicket>;

export const zAttachment = zEntityMeta.extend({
  storagePath: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int(),
  category: z.enum(ATTACHMENT_CATEGORY),
  hiveId: zId.nullable(),
  apiaryId: zId.nullable(),
  inspectionId: zId.nullable(),
  taskId: zId.nullable(),
  caption: z.string().nullable(),
  takenAt: z.string().datetime().nullable(),
  /** URL signée de lecture, ajoutée à la volée par l'API */
  url: z.string().url().optional(),
});
export type Attachment = z.infer<typeof zAttachment>;
