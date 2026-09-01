import { randomUUID } from "node:crypto";
import type { Attachment as AttachmentRow } from "@prisma/client";
import type { UploadRequest } from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { forbidden, notFound } from "../../core/errors.js";
import {
  createSignedDownloadUrl,
  createSignedUploadUrl,
} from "../../core/storage.js";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};

const serialize = (a: AttachmentRow, url?: string) => ({
  id: a.id,
  storagePath: a.storagePath,
  mime: a.mime,
  sizeBytes: Number(a.sizeBytes),
  category: a.category,
  hiveId: a.hiveId,
  apiaryId: a.apiaryId,
  inspectionId: a.inspectionId,
  taskId: a.taskId,
  caption: a.caption,
  takenAt: a.takenAt?.toISOString() ?? null,
  url,
  version: a.version,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
  deletedAt: a.deletedAt?.toISOString() ?? null,
});

export const attachmentsService = {
  /** Crée la ligne + renvoie une URL signée pour l'upload direct depuis le client. */
  async createUploadTicket(ctx: AuthUser, input: UploadRequest) {
    const ext = EXT[input.mime] ?? "bin";
    const path = `${ctx.id}/${randomUUID()}.${ext}`;
    const signed = await createSignedUploadUrl(path);

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          storagePath: path,
          mime: input.mime,
          sizeBytes: BigInt(input.sizeBytes),
          category: input.category,
          hiveId: input.hiveId ?? null,
          apiaryId: input.apiaryId ?? null,
          inspectionId: input.inspectionId ?? null,
          taskId: input.taskId ?? null,
          caption: input.caption ?? null,
          takenAt: input.takenAt ? new Date(input.takenAt) : null,
          clientUuid: input.clientUuid ?? null,
        },
      });
      await writeAudit(
        {
          actorId: ctx.id,
          action: "attachment.create",
          entity: "attachment",
          entityId: created.id,
          after: { path, mime: input.mime },
        },
        tx,
      );
      return created;
    });

    return {
      attachmentId: row.id,
      uploadUrl: signed.uploadUrl,
      token: signed.token,
      path,
    };
  },

  async get(ctx: AuthUser, id: string) {
    const row = await prisma.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound("Pièce jointe", id);
    if (row.ownerId !== ctx.dataOwnerId) throw forbidden();
    const url = await createSignedDownloadUrl(row.storagePath, 3600);
    return serialize(row, url);
  },

  /** Usage interne (Vision) : renvoie la ligne sans URL. */
  async getRow(ctx: AuthUser, id: string) {
    const row = await prisma.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound("Pièce jointe", id);
    if (row.ownerId !== ctx.dataOwnerId) throw forbidden();
    return row;
  },
};
