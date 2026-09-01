import type { Queen as QueenRow, Prisma } from "@prisma/client";
import type { QueenCreate, QueenListQuery, QueenUpdate } from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { forbidden, notFound } from "../../core/errors.js";

const serialize = (q: QueenRow) => ({
  id: q.id,
  hiveId: q.hiveId,
  introducedAt: q.introducedAt ? q.introducedAt.toISOString().slice(0, 10) : null,
  origin: q.origin,
  strain: q.strain,
  birthYear: q.birthYear,
  quality: q.quality,
  status: q.status,
  notes: q.notes,
  ageYears: q.birthYear ? new Date().getFullYear() - q.birthYear : null,
  version: q.version,
  createdAt: q.createdAt.toISOString(),
  updatedAt: q.updatedAt.toISOString(),
  deletedAt: q.deletedAt?.toISOString() ?? null,
});

async function assertHiveOwned(ctx: AuthUser, hiveId: string) {
  const h = await prisma.hive.findFirst({
    where: { id: hiveId, deletedAt: null },
    select: { ownerId: true },
  });
  if (!h) throw notFound("Ruche", hiveId);
  if (h.ownerId !== ctx.dataOwnerId) throw forbidden();
}

export const queensService = {
  async list(ctx: AuthUser, q: QueenListQuery) {
    const where: Prisma.QueenWhereInput = {
      ownerId: ctx.dataOwnerId,
      deletedAt: null,
      ...(q.hiveId ? { hiveId: q.hiveId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.olderThanYears
        ? { birthYear: { lte: new Date().getFullYear() - q.olderThanYears } }
        : {}),
    };
    const rows = await prisma.queen.findMany({
      where,
      orderBy: [{ status: "asc" }, { introducedAt: "desc" }],
      take: 500,
    });
    return rows.map(serialize);
  },

  async get(ctx: AuthUser, id: string) {
    const row = await prisma.queen.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw notFound("Reine", id);
    if (row.ownerId !== ctx.dataOwnerId) throw forbidden();
    return serialize(row);
  },

  async create(ctx: AuthUser, input: QueenCreate, via: "ui" | "ai" | "sync" = "ui") {
    if (input.hiveId) await assertHiveOwned(ctx, input.hiveId);

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.queen.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          hiveId: input.hiveId ?? null,
          introducedAt: input.introducedAt ? new Date(input.introducedAt) : null,
          origin: input.origin ?? null,
          strain: input.strain ?? null,
          birthYear: input.birthYear ?? null,
          quality: input.quality ?? null,
          status: input.status,
          notes: input.notes ?? null,
          clientUuid: input.clientUuid ?? null,
        },
      });

      // Devient la reine courante ; l'ancienne passe "replaced" (historique conservé).
      if (input.hiveId && input.setAsCurrent && input.status === "active") {
        const hive = await tx.hive.findUnique({
          where: { id: input.hiveId },
          select: { currentQueenId: true },
        });
        if (hive?.currentQueenId && hive.currentQueenId !== created.id) {
          await tx.queen.update({
            where: { id: hive.currentQueenId },
            data: { status: "replaced" },
          });
        }
        await tx.hive.update({
          where: { id: input.hiveId },
          data: { currentQueenId: created.id, version: { increment: 1 } },
        });
      }

      await writeAudit(
        { actorId: ctx.id, action: "queen.create", entity: "queen", entityId: created.id, after: created, via },
        tx,
      );
      return created;
    });
    return serialize(row);
  },

  async update(ctx: AuthUser, id: string, input: QueenUpdate) {
    const existing = await prisma.queen.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Reine", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();

    const row = await prisma.queen.update({
      where: { id },
      data: {
        hiveId: input.hiveId === undefined ? undefined : input.hiveId,
        origin: input.origin === undefined ? undefined : input.origin,
        strain: input.strain === undefined ? undefined : input.strain,
        birthYear: input.birthYear === undefined ? undefined : input.birthYear,
        quality: input.quality === undefined ? undefined : input.quality,
        status: input.status ?? undefined,
        notes: input.notes === undefined ? undefined : input.notes,
        version: { increment: 1 },
      },
    });
    await writeAudit({
      actorId: ctx.id,
      action: "queen.update",
      entity: "queen",
      entityId: id,
      before: existing,
      after: row,
    });
    return serialize(row);
  },
};
