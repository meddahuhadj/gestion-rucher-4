import type { Harvest as HarvestRow, Prisma } from "@prisma/client";
import type {
  HarvestCreate,
  HarvestListQuery,
  HarvestUpdate,
  ProductionStats,
} from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { forbidden, notFound } from "../../core/errors.js";
import { resolveAuthors } from "../../core/users.js";

const serialize = (h: HarvestRow) => ({
  id: h.id,
  createdBy: h.createdBy,
  apiaryId: h.apiaryId,
  hiveId: h.hiveId,
  harvestedAt: h.harvestedAt.toISOString().slice(0, 10),
  batchCode: h.batchCode,
  honeyType: h.honeyType,
  quantityKg: Number(h.quantityKg),
  jars: h.jars,
  unitPriceDzd: h.unitPriceDzd == null ? null : Number(h.unitPriceDzd),
  clientName: h.clientName,
  notes: h.notes,
  version: h.version,
  createdAt: h.createdAt.toISOString(),
  updatedAt: h.updatedAt.toISOString(),
  deletedAt: h.deletedAt?.toISOString() ?? null,
});

async function assertApiaryOwned(ctx: AuthUser, apiaryId: string) {
  const a = await prisma.apiary.findFirst({
    where: { id: apiaryId, deletedAt: null },
    select: { ownerId: true },
  });
  if (!a) throw notFound("Rucher", apiaryId);
  if (a.ownerId !== ctx.dataOwnerId) throw forbidden();
}

export const harvestsService = {
  async list(ctx: AuthUser, q: HarvestListQuery) {
    const where: Prisma.HarvestWhereInput = {
      ownerId: ctx.dataOwnerId,
      deletedAt: null,
      ...(q.apiaryId ? { apiaryId: q.apiaryId } : {}),
      ...(q.hiveId ? { hiveId: q.hiveId } : {}),
      ...(q.from || q.to
        ? {
            harvestedAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const rows = await prisma.harvest.findMany({
      where,
      orderBy: { harvestedAt: "desc" },
      take: 500,
    });
    const authors = await resolveAuthors(rows.map((r) => r.createdBy));
    return rows.map((r) => ({ ...serialize(r), author: authors.get(r.createdBy) ?? null }));
  },

  async create(ctx: AuthUser, input: HarvestCreate, via: "ui" | "ai" | "sync" = "ui") {
    await assertApiaryOwned(ctx, input.apiaryId);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.harvest.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          apiaryId: input.apiaryId,
          hiveId: input.hiveId ?? null,
          harvestedAt: new Date(input.harvestedAt),
          batchCode: input.batchCode ?? null,
          honeyType: input.honeyType ?? null,
          quantityKg: input.quantityKg,
          jars: input.jars ?? null,
          unitPriceDzd: input.unitPriceDzd ?? null,
          clientName: input.clientName ?? null,
          notes: input.notes ?? null,
          clientUuid: input.clientUuid ?? null,
        },
      });
      await writeAudit(
        { actorId: ctx.id, action: "harvest.create", entity: "harvest", entityId: created.id, after: created, via },
        tx,
      );
      return created;
    });
    return serialize(row);
  },

  async update(ctx: AuthUser, id: string, input: HarvestUpdate) {
    const existing = await prisma.harvest.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Récolte", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();
    const row = await prisma.harvest.update({
      where: { id },
      data: {
        hiveId: input.hiveId === undefined ? undefined : input.hiveId,
        harvestedAt: input.harvestedAt ? new Date(input.harvestedAt) : undefined,
        batchCode: input.batchCode === undefined ? undefined : input.batchCode,
        honeyType: input.honeyType === undefined ? undefined : input.honeyType,
        quantityKg: input.quantityKg ?? undefined,
        jars: input.jars === undefined ? undefined : input.jars,
        unitPriceDzd: input.unitPriceDzd === undefined ? undefined : input.unitPriceDzd,
        clientName: input.clientName === undefined ? undefined : input.clientName,
        notes: input.notes === undefined ? undefined : input.notes,
        version: { increment: 1 },
      },
    });
    return serialize(row);
  },

  /** Statistiques de production — §17 : total, moyenne, par ruche, par mois, meilleure ruche. */
  async stats(ctx: AuthUser, from?: string, to?: string): Promise<ProductionStats> {
    const where: Prisma.HarvestWhereInput = {
      ownerId: ctx.dataOwnerId,
      deletedAt: null,
      ...(from || to
        ? {
            harvestedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const rows = await prisma.harvest.findMany({
      where,
      select: { hiveId: true, quantityKg: true, harvestedAt: true },
    });

    const totalKg = rows.reduce((s, r) => s + Number(r.quantityKg), 0);

    const perHive = new Map<string | null, number>();
    for (const r of rows) {
      perHive.set(r.hiveId, (perHive.get(r.hiveId) ?? 0) + Number(r.quantityKg));
    }
    const hiveIds = [...perHive.keys()].filter((k): k is string => k !== null);
    const hives = hiveIds.length
      ? await prisma.hive.findMany({
          where: { id: { in: hiveIds } },
          select: { id: true, number: true },
        })
      : [];
    const numById = new Map(hives.map((h) => [h.id, h.number]));

    const byHive = [...perHive.entries()].map(([hiveId, kg]) => ({
      hiveId,
      hiveNumber: hiveId ? (numById.get(hiveId) ?? null) : null,
      totalKg: round(kg),
    }));

    const perMonth = new Map<string, number>();
    for (const r of rows) {
      const m = r.harvestedAt.toISOString().slice(0, 7);
      perMonth.set(m, (perMonth.get(m) ?? 0) + Number(r.quantityKg));
    }
    const byMonth = [...perMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, kg]) => ({ month, totalKg: round(kg) }));

    const producingHives = byHive.filter((h) => h.hiveId !== null);
    const best =
      producingHives.length > 0
        ? producingHives.reduce((a, b) => (b.totalKg > a.totalKg ? b : a))
        : null;

    return {
      totalKg: round(totalKg),
      averageKgPerHive: producingHives.length ? round(totalKg / producingHives.length) : 0,
      harvestCount: rows.length,
      byHive,
      byMonth,
      bestHive:
        best && best.hiveId && best.hiveNumber != null
          ? { hiveId: best.hiveId, hiveNumber: best.hiveNumber, totalKg: best.totalKg }
          : null,
    };
  },
};

const round = (n: number) => Math.round(n * 1000) / 1000;
