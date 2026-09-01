import type { ApiaryCreate, ApiaryUpdate } from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { AppError, forbidden, notFound } from "../../core/errors.js";

const serialize = (a: {
  id: string;
  name: string;
  location: string | null;
  lat: unknown;
  lng: unknown;
  notes: string | null;
  photoAttachmentId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  _count?: { hives: number };
}) => ({
  id: a.id,
  name: a.name,
  location: a.location,
  lat: a.lat == null ? null : Number(a.lat),
  lng: a.lng == null ? null : Number(a.lng),
  notes: a.notes,
  photoAttachmentId: a.photoAttachmentId,
  hiveCount: a._count?.hives,
  version: a.version,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
  deletedAt: a.deletedAt?.toISOString() ?? null,
});

export const apiariesService = {
  async list(ctx: AuthUser) {
    const rows = await prisma.apiary.findMany({
      where: { ownerId: ctx.dataOwnerId, deletedAt: null },
      include: { _count: { select: { hives: { where: { deletedAt: null } } } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(serialize);
  },

  async get(ctx: AuthUser, id: string) {
    const row = await prisma.apiary.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { hives: { where: { deletedAt: null } } } } },
    });
    if (!row) throw notFound("Rucher", id);
    if (row.ownerId !== ctx.dataOwnerId) throw forbidden();
    return serialize(row);
  },

  async create(ctx: AuthUser, input: ApiaryCreate) {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.apiary.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          name: input.name,
          location: input.location ?? null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          notes: input.notes ?? null,
          photoAttachmentId: input.photoAttachmentId ?? null,
          clientUuid: input.clientUuid ?? null,
        },
      });
      await writeAudit(
        { actorId: ctx.id, action: "apiary.create", entity: "apiary", entityId: created.id, after: created },
        tx,
      );
      return created;
    });
    return serialize(row);
  },

  async update(ctx: AuthUser, id: string, input: ApiaryUpdate) {
    const existing = await prisma.apiary.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Rucher", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.apiary.update({
        where: { id },
        data: {
          name: input.name ?? undefined,
          location: input.location === undefined ? undefined : input.location,
          lat: input.lat === undefined ? undefined : input.lat,
          lng: input.lng === undefined ? undefined : input.lng,
          notes: input.notes === undefined ? undefined : input.notes,
          photoAttachmentId:
            input.photoAttachmentId === undefined ? undefined : input.photoAttachmentId,
          version: { increment: 1 },
        },
      });
      await writeAudit(
        {
          actorId: ctx.id,
          action: "apiary.update",
          entity: "apiary",
          entityId: id,
          before: existing,
          after: updated,
        },
        tx,
      );
      return updated;
    });
    return serialize(row);
  },

  /** Soft delete — l'historique des ruches n'est jamais supprimé (§9). */
  async remove(ctx: AuthUser, id: string) {
    const existing = await prisma.apiary.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Rucher", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();

    const liveHives = await prisma.hive.count({
      where: { apiaryId: id, deletedAt: null },
    });
    if (liveHives > 0) {
      throw new AppError(
        "conflict",
        `Ce rucher contient encore ${liveHives} ruche(s).`,
        { i18nKey: "error.apiary_has_hives", details: { hives: liveHives } },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.apiary.update({ where: { id }, data: { deletedAt: new Date() } });
      await writeAudit(
        { actorId: ctx.id, action: "apiary.delete", entity: "apiary", entityId: id, before: existing },
        tx,
      );
    });
    return { id, deleted: true };
  },
};
