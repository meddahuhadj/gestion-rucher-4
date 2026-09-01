import type { Inspection as InspectionRow, Prisma } from "@prisma/client";
import type {
  InspectionCreate,
  InspectionUpdate,
} from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { forbidden, notFound } from "../../core/errors.js";
import { resolveAuthors } from "../../core/users.js";

/** Intervalle par défaut avant la prochaine inspection (Knowledge Engine — §32). */
const DEFAULT_NEXT_INSPECTION_DAYS = 14;

const serialize = (i: InspectionRow) => ({
  id: i.id,
  hiveId: i.hiveId,
  createdBy: i.createdBy,
  performedAt: i.performedAt.toISOString(),
  method: i.method,
  colonyStrength: i.colonyStrength,
  queenPresent: i.queenPresent,
  queenSeen: i.queenSeen,
  laying: i.laying,
  broodOpen: i.broodOpen,
  broodCapped: i.broodCapped,
  broodAmount: i.broodAmount,
  storesHoney: i.storesHoney,
  storesPollen: i.storesPollen,
  feed: i.feed,
  healthStatus: i.healthStatus,
  notes: i.notes,
  transcript: i.transcript,
  aiSummaryId: i.aiSummaryId,
  version: i.version,
  createdAt: i.createdAt.toISOString(),
  updatedAt: i.updatedAt.toISOString(),
  deletedAt: i.deletedAt?.toISOString() ?? null,
});

async function assertHiveOwned(ctx: AuthUser, hiveId: string) {
  const hive = await prisma.hive.findFirst({
    where: { id: hiveId, deletedAt: null },
    select: { ownerId: true },
  });
  if (!hive) throw notFound("Ruche", hiveId);
  if (hive.ownerId !== ctx.dataOwnerId) throw forbidden();
}

export const inspectionsService = {
  async listByHive(ctx: AuthUser, hiveId: string, limit = 50) {
    await assertHiveOwned(ctx, hiveId);
    const rows = await prisma.inspection.findMany({
      where: { hiveId, deletedAt: null },
      orderBy: { performedAt: "desc" },
      take: Math.min(limit, 200),
    });
    const authors = await resolveAuthors(rows.map((r) => r.createdBy));
    return rows.map((r) => ({
      ...serialize(r),
      author: authors.get(r.createdBy) ?? null,
    }));
  },

  async get(ctx: AuthUser, id: string) {
    const row = await prisma.inspection.findFirst({
      where: { id, deletedAt: null },
      include: { observations: true },
    });
    if (!row) throw notFound("Inspection", id);
    if (row.ownerId !== ctx.dataOwnerId) throw forbidden();
    const authors = await resolveAuthors([row.createdBy]);
    return {
      ...serialize(row),
      author: authors.get(row.createdBy) ?? null,
      observations: row.observations.map((o) => ({
        key: o.key,
        value: o.value,
        source: o.source,
      })),
    };
  },

  /**
   * Historique condensé pour MOUMEN — §8/§28.
   * `rangeDays` limite la fenêtre ; renvoie l'essentiel, pas tout le détail.
   */
  async history(ctx: AuthUser, hiveId: string, rangeDays = 90) {
    await assertHiveOwned(ctx, hiveId);
    const since = new Date(Date.now() - rangeDays * 86_400_000);
    const rows = await prisma.inspection.findMany({
      where: { hiveId, deletedAt: null, performedAt: { gte: since } },
      orderBy: { performedAt: "desc" },
      select: {
        id: true,
        createdBy: true,
        performedAt: true,
        colonyStrength: true,
        queenPresent: true,
        storesHoney: true,
        healthStatus: true,
        notes: true,
      },
      take: 100,
    });
    const authors = await resolveAuthors(rows.map((r) => r.createdBy));
    return rows.map((r) => ({
      id: r.id,
      by: authors.get(r.createdBy) ?? null,
      performedAt: r.performedAt.toISOString(),
      colonyStrength: r.colonyStrength,
      queenPresent: r.queenPresent,
      storesHoney: r.storesHoney,
      healthStatus: r.healthStatus,
      notes: r.notes,
    }));
  },

  async create(
    ctx: AuthUser,
    input: InspectionCreate,
    via: "ui" | "ai" | "sync" = "ui",
  ) {
    await assertHiveOwned(ctx, input.hiveId);
    const performedAt = input.performedAt ? new Date(input.performedAt) : new Date();
    const nextAt = new Date(
      performedAt.getTime() + DEFAULT_NEXT_INSPECTION_DAYS * 86_400_000,
    );

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.inspection.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          hiveId: input.hiveId,
          performedAt,
          method: input.method,
          colonyStrength: input.colonyStrength ?? null,
          queenPresent: input.queenPresent ?? null,
          queenSeen: input.queenSeen ?? null,
          laying: input.laying ?? null,
          broodOpen: input.broodOpen ?? null,
          broodCapped: input.broodCapped ?? null,
          broodAmount: input.broodAmount ?? null,
          storesHoney: input.storesHoney ?? null,
          storesPollen: input.storesPollen ?? null,
          feed: input.feed ?? null,
          healthStatus: input.healthStatus ?? null,
          notes: input.notes ?? null,
          transcript: input.transcript ?? null,
          weatherRecordId: input.weatherRecordId ?? null,
          clientUuid: input.clientUuid ?? null,
          observations: input.observations?.length
            ? {
                create: input.observations.map((o) => ({
                  key: o.key,
                  value: o.value as Prisma.InputJsonValue,
                  source: o.source,
                })),
              }
            : undefined,
        },
      });

      if (input.attachmentIds?.length) {
        await tx.attachment.updateMany({
          where: { id: { in: input.attachmentIds }, ownerId: ctx.dataOwnerId },
          data: { inspectionId: created.id, hiveId: input.hiveId },
        });
      }

      // Met à jour la ruche : dernière / prochaine inspection, force observée.
      await tx.hive.update({
        where: { id: input.hiveId },
        data: {
          lastInspectionAt: performedAt,
          nextInspectionAt: nextAt,
          ...(input.colonyStrength
            ? { strength: mapStrength(input.colonyStrength) }
            : {}),
          version: { increment: 1 },
        },
      });

      await writeAudit(
        {
          actorId: ctx.id,
          action: "inspection.create",
          entity: "inspection",
          entityId: created.id,
          after: created,
          via,
        },
        tx,
      );
      return created;
    });

    return serialize(row);
  },

  async update(ctx: AuthUser, id: string, input: InspectionUpdate) {
    const existing = await prisma.inspection.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw notFound("Inspection", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.inspection.update({
        where: { id },
        data: {
          performedAt: input.performedAt ? new Date(input.performedAt) : undefined,
          colonyStrength:
            input.colonyStrength === undefined ? undefined : input.colonyStrength,
          queenPresent:
            input.queenPresent === undefined ? undefined : input.queenPresent,
          queenSeen: input.queenSeen === undefined ? undefined : input.queenSeen,
          laying: input.laying === undefined ? undefined : input.laying,
          storesHoney:
            input.storesHoney === undefined ? undefined : input.storesHoney,
          notes: input.notes === undefined ? undefined : input.notes,
          version: { increment: 1 },
        },
      });
      await writeAudit(
        {
          actorId: ctx.id,
          action: "inspection.update",
          entity: "inspection",
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
};

/** ColonyStrength (échelle inspection) → HiveStatus/strength (échelle ruche). */
function mapStrength(
  s: NonNullable<InspectionCreate["colonyStrength"]>,
): "very_strong" | "strong" | "medium" | "weak" | "very_weak" {
  return s;
}
