import type { Hive as HiveRow, Prisma } from "@prisma/client";
import {
  LIVE_HIVE_STATUS,
  type HiveCreate,
  type HiveListQuery,
  type HiveUpdate,
} from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { conflict, forbidden, notFound } from "../../core/errors.js";

const serialize = (h: HiveRow) => ({
  id: h.id,
  apiaryId: h.apiaryId,
  number: h.number,
  name: h.name,
  origin: h.origin,
  hiveType: h.hiveType,
  strain: h.strain,
  status: h.status,
  strength: h.strength,
  currentQueenId: h.currentQueenId,
  photoAttachmentId: h.photoAttachmentId,
  lastInspectionAt: h.lastInspectionAt?.toISOString() ?? null,
  nextInspectionAt: h.nextInspectionAt?.toISOString() ?? null,
  notes: h.notes,
  version: h.version,
  createdAt: h.createdAt.toISOString(),
  updatedAt: h.updatedAt.toISOString(),
  deletedAt: h.deletedAt?.toISOString() ?? null,
});

async function assertApiaryOwned(ctx: AuthUser, apiaryId: string) {
  const apiary = await prisma.apiary.findFirst({
    where: { id: apiaryId, deletedAt: null },
    select: { ownerId: true },
  });
  if (!apiary) throw notFound("Rucher", apiaryId);
  if (apiary.ownerId !== ctx.dataOwnerId) throw forbidden();
}

export const hivesService = {
  async list(ctx: AuthUser, q: HiveListQuery) {
    // Statuts « sortis du cheptel » — masqués sauf demande explicite.
    const INACTIVE = ["archived", "dead", "sold", "merged"] as const;
    const statusFilter: Prisma.HiveWhereInput["status"] = q.status
      ? q.status
      : q.weak
        ? { in: ["weak", "very_weak"] }
        : q.archived
          ? { in: [...INACTIVE] }
          : { notIn: [...INACTIVE] };

    const where: Prisma.HiveWhereInput = {
      ownerId: ctx.dataOwnerId,
      deletedAt: null,
      status: statusFilter,
      ...(q.apiaryId ? { apiaryId: q.apiaryId } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" } },
              ...(Number.isInteger(Number(q.search))
                ? [{ number: Number(q.search) }]
                : []),
            ],
          }
        : {}),
    };

    if (q.notInspectedSinceDays) {
      const cutoff = new Date(
        Date.now() - q.notInspectedSinceDays * 24 * 60 * 60 * 1000,
      );
      where.OR = [
        { lastInspectionAt: null },
        { lastInspectionAt: { lt: cutoff } },
      ];
    }

    const rows = await prisma.hive.findMany({
      where,
      orderBy: [{ apiaryId: "asc" }, { number: "asc" }],
      take: 500,
    });
    return rows.map(serialize);
  },

  async get(ctx: AuthUser, id: string) {
    const row = await prisma.hive.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound("Ruche", id);
    if (row.ownerId !== ctx.dataOwnerId) throw forbidden();
    return serialize(row);
  },

  async create(ctx: AuthUser, input: HiveCreate) {
    await assertApiaryOwned(ctx, input.apiaryId);

    const dup = await prisma.hive.findFirst({
      where: { apiaryId: input.apiaryId, number: input.number, deletedAt: null },
      select: { id: true },
    });
    if (dup) {
      throw conflict(
        `Une ruche n°${input.number} existe déjà dans ce rucher.`,
        { field: "number" },
      );
    }

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.hive.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          apiaryId: input.apiaryId,
          number: input.number,
          name: input.name ?? null,
          origin: input.origin ?? null,
          hiveType: input.hiveType ?? null,
          strain: input.strain ?? null,
          status: input.status,
          strength: input.strength ?? null,
          photoAttachmentId: input.photoAttachmentId ?? null,
          notes: input.notes ?? null,
          clientUuid: input.clientUuid ?? null,
        },
      });
      await writeAudit(
        { actorId: ctx.id, action: "hive.create", entity: "hive", entityId: created.id, after: created },
        tx,
      );
      return created;
    });
    return serialize(row);
  },

  async update(ctx: AuthUser, id: string, input: HiveUpdate) {
    const existing = await prisma.hive.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Ruche", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();

    const row = await prisma.$transaction(async (tx) => {
      // Réassignation de la reine courante — l'ancienne garde son historique.
      let nextQueenId: string | null | undefined;
      if (input.currentQueenId !== undefined) {
        nextQueenId = input.currentQueenId;
        if (nextQueenId) {
          const q = await tx.queen.findFirst({
            where: { id: nextQueenId, deletedAt: null },
            select: { ownerId: true },
          });
          if (!q) throw notFound("Reine", nextQueenId);
          if (q.ownerId !== ctx.dataOwnerId) throw forbidden();
        }
        if (existing.currentQueenId && existing.currentQueenId !== nextQueenId) {
          await tx.queen.update({
            where: { id: existing.currentQueenId },
            data: { status: nextQueenId ? "replaced" : "removed" },
          });
        }
        if (nextQueenId) {
          await tx.queen.update({
            where: { id: nextQueenId },
            data: { hiveId: id, status: "active" },
          });
        }
      }

      const updated = await tx.hive.update({
        where: { id },
        data: {
          number: input.number ?? undefined,
          name: input.name === undefined ? undefined : input.name,
          origin: input.origin === undefined ? undefined : input.origin,
          hiveType: input.hiveType === undefined ? undefined : input.hiveType,
          strain: input.strain === undefined ? undefined : input.strain,
          status: input.status ?? undefined,
          strength: input.strength === undefined ? undefined : input.strength,
          notes: input.notes === undefined ? undefined : input.notes,
          photoAttachmentId:
            input.photoAttachmentId === undefined ? undefined : input.photoAttachmentId,
          ...(nextQueenId === undefined ? {} : { currentQueenId: nextQueenId }),
          version: { increment: 1 },
        },
      });
      await writeAudit(
        {
          actorId: ctx.id,
          action: "hive.update",
          entity: "hive",
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

  /** Archivage — jamais de suppression de l'historique (§9/§22 tools). */
  async archive(ctx: AuthUser, id: string, reason: string) {
    const existing = await prisma.hive.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Ruche", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.hive.update({
        where: { id },
        data: { status: "archived", version: { increment: 1 } },
      });
      await writeAudit(
        {
          actorId: ctx.id,
          action: "hive.archive",
          entity: "hive",
          entityId: id,
          before: existing,
          after: { ...updated, reason },
        },
        tx,
      );
      return updated;
    });
    return serialize(row);
  },

  /** Compteurs pour le dashboard (§40). */
  async counts(ctx: AuthUser) {
    const grouped = await prisma.hive.groupBy({
      by: ["status"],
      where: { ownerId: ctx.dataOwnerId, deletedAt: null },
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      grouped.map((g) => [g.status, g._count._all]),
    );
    const live = grouped
      .filter((g) => (LIVE_HIVE_STATUS as readonly string[]).includes(g.status))
      .reduce((sum, g) => sum + g._count._all, 0);
    return { total: live, byStatus };
  },
};
