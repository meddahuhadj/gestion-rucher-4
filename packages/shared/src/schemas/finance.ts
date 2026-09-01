import { z } from "zod";
import { zClientUuid, zEntityMeta, zId } from "../common.js";
import { EXPENSE_CATEGORY } from "../enums.js";

// ─────────────── dépenses ───────────────
export const zExpenseCreate = z.object({
  spentAt: z.string().date(),
  amountDzd: z.number().positive().max(1_000_000_000),
  category: z.enum(EXPENSE_CATEGORY).default("other"),
  hiveId: zId.nullable().optional(),
  apiaryId: zId.nullable().optional(),
  description: z.string().max(2000).optional(),
  receiptAttachmentId: zId.optional(),
  clientUuid: zClientUuid.optional(),
});
export type ExpenseCreate = z.infer<typeof zExpenseCreate>;

export const zExpense = zEntityMeta.extend({
  spentAt: z.string(),
  amountDzd: z.number(),
  category: z.enum(EXPENSE_CATEGORY),
  hiveId: zId.nullable(),
  apiaryId: zId.nullable(),
  description: z.string().nullable(),
  receiptAttachmentId: zId.nullable(),
});
export type Expense = z.infer<typeof zExpense>;

// ─────────────── revenus ───────────────
export const zRevenueCreate = z.object({
  receivedAt: z.string().date(),
  amountDzd: z.number().positive().max(1_000_000_000),
  product: z.string().max(120).optional(),
  quantity: z.number().nonnegative().optional(),
  unitPriceDzd: z.number().nonnegative().optional(),
  clientName: z.string().max(160).optional(),
  batchCode: z.string().max(60).optional(),
  harvestId: zId.optional(),
  clientUuid: zClientUuid.optional(),
});
export type RevenueCreate = z.infer<typeof zRevenueCreate>;

export const zRevenue = zEntityMeta.extend({
  receivedAt: z.string(),
  amountDzd: z.number(),
  product: z.string().nullable(),
  quantity: z.number().nullable(),
  unitPriceDzd: z.number().nullable(),
  clientName: z.string().nullable(),
  batchCode: z.string().nullable(),
  harvestId: zId.nullable(),
});
export type Revenue = z.infer<typeof zRevenue>;

// ─────────────── synthèse ───────────────
export const zFinanceQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  preset: z.enum(["day", "week", "month", "year", "custom"]).default("month"),
});
export type FinanceQuery = z.infer<typeof zFinanceQuery>;

/** REVENUS − DÉPENSES = BÉNÉFICE — §18. Devise DZD. */
export const zFinanceSummary = z.object({
  currency: z.literal("DZD"),
  from: z.string(),
  to: z.string(),
  totalRevenue: z.number(),
  totalExpense: z.number(),
  profit: z.number(),
  expenseByCategory: z.array(
    z.object({ category: z.enum(EXPENSE_CATEGORY), total: z.number() }),
  ),
});
export type FinanceSummary = z.infer<typeof zFinanceSummary>;
