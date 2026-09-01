import type { Expense as ExpenseRow, Revenue as RevenueRow } from "@prisma/client";
import type {
  ExpenseCreate,
  FinanceQuery,
  FinanceSummary,
  RevenueCreate,
} from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { forbidden, notFound } from "../../core/errors.js";

const serExpense = (e: ExpenseRow) => ({
  id: e.id,
  spentAt: e.spentAt.toISOString().slice(0, 10),
  amountDzd: Number(e.amountDzd),
  category: e.category,
  hiveId: e.hiveId,
  apiaryId: e.apiaryId,
  description: e.description,
  receiptAttachmentId: e.receiptAttachmentId,
  version: e.version,
  createdAt: e.createdAt.toISOString(),
  updatedAt: e.updatedAt.toISOString(),
  deletedAt: e.deletedAt?.toISOString() ?? null,
});

const serRevenue = (r: RevenueRow) => ({
  id: r.id,
  receivedAt: r.receivedAt.toISOString().slice(0, 10),
  amountDzd: Number(r.amountDzd),
  product: r.product,
  quantity: r.quantity == null ? null : Number(r.quantity),
  unitPriceDzd: r.unitPriceDzd == null ? null : Number(r.unitPriceDzd),
  clientName: r.clientName,
  batchCode: r.batchCode,
  harvestId: r.harvestId,
  version: r.version,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  deletedAt: r.deletedAt?.toISOString() ?? null,
});

/** Résout la fenêtre temporelle d'un preset (§18). */
function resolveRange(q: FinanceQuery): { from: Date; to: Date } {
  const to = q.to ? new Date(q.to) : new Date();
  let from: Date;
  if (q.from) {
    from = new Date(q.from);
  } else {
    from = new Date(to);
    if (q.preset === "day") from.setDate(from.getDate() - 1);
    else if (q.preset === "week") from.setDate(from.getDate() - 7);
    else if (q.preset === "year") from.setFullYear(from.getFullYear() - 1);
    else from.setMonth(from.getMonth() - 1); // month par défaut
  }
  return { from, to };
}

export const financeService = {
  // ─────────── dépenses ───────────
  async listExpenses(ctx: AuthUser, q: FinanceQuery) {
    const { from, to } = resolveRange(q);
    const rows = await prisma.expense.findMany({
      where: { ownerId: ctx.dataOwnerId, deletedAt: null, spentAt: { gte: from, lte: to } },
      orderBy: { spentAt: "desc" },
      take: 500,
    });
    return rows.map(serExpense);
  },

  async createExpense(ctx: AuthUser, input: ExpenseCreate, via: "ui" | "ai" = "ui") {
    if (input.apiaryId) await assertApiary(ctx, input.apiaryId);
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          spentAt: new Date(input.spentAt),
          amountDzd: input.amountDzd,
          category: input.category,
          hiveId: input.hiveId ?? null,
          apiaryId: input.apiaryId ?? null,
          description: input.description ?? null,
          receiptAttachmentId: input.receiptAttachmentId ?? null,
          clientUuid: input.clientUuid ?? null,
        },
      });
      await writeAudit(
        { actorId: ctx.id, action: "expense.create", entity: "expense", entityId: created.id, after: created, via },
        tx,
      );
      return created;
    });
    return serExpense(row);
  },

  // ─────────── revenus ───────────
  async listRevenues(ctx: AuthUser, q: FinanceQuery) {
    const { from, to } = resolveRange(q);
    const rows = await prisma.revenue.findMany({
      where: { ownerId: ctx.dataOwnerId, deletedAt: null, receivedAt: { gte: from, lte: to } },
      orderBy: { receivedAt: "desc" },
      take: 500,
    });
    return rows.map(serRevenue);
  },

  async createRevenue(ctx: AuthUser, input: RevenueCreate, via: "ui" | "ai" = "ui") {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.revenue.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          receivedAt: new Date(input.receivedAt),
          amountDzd: input.amountDzd,
          product: input.product ?? null,
          quantity: input.quantity ?? null,
          unitPriceDzd: input.unitPriceDzd ?? null,
          clientName: input.clientName ?? null,
          batchCode: input.batchCode ?? null,
          harvestId: input.harvestId ?? null,
          clientUuid: input.clientUuid ?? null,
        },
      });
      await writeAudit(
        { actorId: ctx.id, action: "revenue.create", entity: "revenue", entityId: created.id, after: created, via },
        tx,
      );
      return created;
    });
    return serRevenue(row);
  },

  // ─────────── synthèse : REVENUS − DÉPENSES = BÉNÉFICE ───────────
  async summary(ctx: AuthUser, q: FinanceQuery): Promise<FinanceSummary> {
    const { from, to } = resolveRange(q);
    const scope = { ownerId: ctx.dataOwnerId, deletedAt: null };

    const [rev, exp, byCat] = await Promise.all([
      prisma.revenue.aggregate({
        where: { ...scope, receivedAt: { gte: from, lte: to } },
        _sum: { amountDzd: true },
      }),
      prisma.expense.aggregate({
        where: { ...scope, spentAt: { gte: from, lte: to } },
        _sum: { amountDzd: true },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: { ...scope, spentAt: { gte: from, lte: to } },
        _sum: { amountDzd: true },
      }),
    ]);

    const totalRevenue = Number(rev._sum.amountDzd ?? 0);
    const totalExpense = Number(exp._sum.amountDzd ?? 0);

    return {
      currency: "DZD",
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      totalRevenue,
      totalExpense,
      profit: totalRevenue - totalExpense,
      expenseByCategory: byCat
        .map((c) => ({ category: c.category, total: Number(c._sum.amountDzd ?? 0) }))
        .sort((a, b) => b.total - a.total),
    };
  },
};

async function assertApiary(ctx: AuthUser, apiaryId: string) {
  const a = await prisma.apiary.findFirst({
    where: { id: apiaryId, deletedAt: null },
    select: { ownerId: true },
  });
  if (!a) throw notFound("Rucher", apiaryId);
  if (a.ownerId !== ctx.dataOwnerId) throw forbidden();
}
