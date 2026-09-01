import type { Treatment as TreatmentRow, Prisma } from "@prisma/client";
import type {
  TreatmentCreate,
  TreatmentListQuery,
  TreatmentUpdate,
} from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { forbidden, notFound } from "../../core/errors.js";

const serialize = (t: TreatmentRow) => ({
  id: t.id,
  hiveId: t.hiveId,
  product: t.product,
  target: t.target,
  dose: t.dose,
  startedAt: t.startedAt.toISOString().slice(0, 10),
  endedAt: t.endedAt ? t.endedAt.toISOString().slice(0, 10) : null,
  notes: t.notes,
  version: t.version,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
  deletedAt: t.deletedAt?.toISOString() ?? null,
});

async function assertHiveOwned(ctx: AuthUser, hiveId: string) {
  const h = await prisma.hive.findFirst({
    where: { id: hiveId, deletedAt: null },
    select: { ownerId: true },
  });
  if (!h) throw notFound("Ruche", hiveId);
  if (h.ownerId !== ctx.dataOwnerId) throw forbidden();
}

export const treatmentsService = {
  async list(ctx: AuthUser, q: TreatmentListQuery) {
    const where: Prisma.TreatmentWhereInput = {
      ownerId: ctx.dataOwnerId,
      deletedAt: null,
      ...(q.hiveId ? { hiveId: q.hiveId } : {}),
      ...(q.target ? { target: q.target } : {}),
      ...(q.active ? { endedAt: null } : {}),
    };
    const rows = await prisma.treatment.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 500,
    });
    return rows.map(serialize);
  },

  async create(ctx: AuthUser, input: TreatmentCreate, via: "ui" | "ai" | "sync" = "ui") {
    await assertHiveOwned(ctx, input.hiveId);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.treatment.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          hiveId: input.hiveId,
          product: input.product,
          target: input.target,
          dose: input.dose ?? null,
          startedAt: new Date(input.startedAt),
          endedAt: input.endedAt ? new Date(input.endedAt) : null,
          notes: input.notes ?? null,
          clientUuid: input.clientUuid ?? null,
        },
      });
      await writeAudit(
        { actorId: ctx.id, action: "treatment.create", entity: "treatment", entityId: created.id, after: created, via },
        tx,
      );
      return created;
    });
    return serialize(row);
  },

  async update(ctx: AuthUser, id: string, input: TreatmentUpdate) {
    const existing = await prisma.treatment.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Traitement", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();
    const row = await prisma.treatment.update({
      where: { id },
      data: {
        product: input.product ?? undefined,
        target: input.target ?? undefined,
        dose: input.dose === undefined ? undefined : input.dose,
        endedAt:
          input.endedAt === undefined
            ? undefined
            : input.endedAt
              ? new Date(input.endedAt)
              : null,
        notes: input.notes === undefined ? undefined : input.notes,
        version: { increment: 1 },
      },
    });
    return serialize(row);
  },
};
