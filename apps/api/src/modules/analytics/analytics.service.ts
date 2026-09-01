import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { hivesService } from "../hives/hives.service.js";
import { harvestsService } from "../harvests/harvests.service.js";
import { financeService } from "../finance/finance.service.js";

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Tableau de bord agrégé — §19 / §40 (MOUMEN AI Command Center). */
export const analyticsService = {
  async overview(ctx: AuthUser) {
    const today = startOfDay();
    const endToday = new Date(today.getTime() + 86_400_000);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    const [
      hiveCounts,
      insp30,
      insp7,
      overdueTasks,
      dueTodayTasks,
      upcomingTasks,
      production,
      finance,
      alertsBySeverity,
    ] = await Promise.all([
      hivesService.counts(ctx),
      prisma.inspection.count({
        where: { ownerId: ctx.dataOwnerId, deletedAt: null, performedAt: { gte: daysAgo(30) } },
      }),
      prisma.inspection.count({
        where: { ownerId: ctx.dataOwnerId, deletedAt: null, performedAt: { gte: daysAgo(7) } },
      }),
      prisma.task.count({
        where: {
          ownerId: ctx.dataOwnerId,
          deletedAt: null,
          status: { in: ["todo", "doing"] },
          dueAt: { lt: today },
        },
      }),
      prisma.task.count({
        where: {
          ownerId: ctx.dataOwnerId,
          deletedAt: null,
          status: { in: ["todo", "doing"] },
          dueAt: { gte: today, lt: endToday },
        },
      }),
      prisma.task.count({
        where: {
          ownerId: ctx.dataOwnerId,
          deletedAt: null,
          status: { in: ["todo", "doing"] },
          dueAt: { gte: endToday, lt: new Date(today.getTime() + 7 * 86_400_000) },
        },
      }),
      harvestsService.stats(ctx, yearStart.toISOString().slice(0, 10)),
      financeService.summary(ctx, { preset: "month" }),
      prisma.notification.groupBy({
        by: ["severity"],
        where: { ownerId: ctx.dataOwnerId, readAt: null },
        _count: { _all: true },
      }),
    ]);

    const alerts = {
      total: alertsBySeverity.reduce((s, a) => s + a._count._all, 0),
      bySeverity: Object.fromEntries(
        alertsBySeverity.map((a) => [a.severity, a._count._all]),
      ) as Record<string, number>,
    };

    return {
      hives: { live: hiveCounts.total, byStatus: hiveCounts.byStatus },
      inspections: { last30d: insp30, last7d: insp7 },
      tasks: { overdue: overdueTasks, dueToday: dueTodayTasks, upcoming: upcomingTasks },
      production: {
        year: new Date().getFullYear(),
        totalKg: production.totalKg,
        bestHive: production.bestHive,
      },
      finance: {
        currency: "DZD" as const,
        month: { revenue: finance.totalRevenue, expense: finance.totalExpense, profit: finance.profit },
      },
      alerts,
    };
  },
};
