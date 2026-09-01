import type { PlanItem, PlannerRequest, PlannerResult } from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const TREATMENT_FOLLOWUP_DAYS = 21;

/**
 * Planificateur intelligent — §14 / §57.
 * Agrège tâches en retard, inspections dues, ruches à surveiller, suivis de
 * traitement ; répartit sur la semaine. Renvoie une PROPOSITION, rien n'est créé.
 */
export const plannerService = {
  async generate(ctx: AuthUser, req: PlannerRequest): Promise<PlannerResult> {
    const from = req.from ? new Date(req.from) : new Date();
    from.setHours(0, 0, 0, 0);
    const to = req.to ? new Date(req.to) : addDays(from, 7);
    const days: string[] = [];
    for (let d = new Date(from); d < to; d = addDays(d, 1)) days.push(iso(d));

    const raw: Omit<PlanItem, "day">[] = [];

    // 1) tâches en retard ou à échéance dans la fenêtre
    const tasks = await prisma.task.findMany({
      where: {
        ownerId: ctx.dataOwnerId,
        deletedAt: null,
        status: { in: ["todo", "doing"] },
        OR: [{ dueAt: null }, { dueAt: { lt: to } }],
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 100,
      select: { id: true, title: true, priority: true, hiveId: true, apiaryId: true, dueAt: true },
    });
    for (const tk of tasks) {
      const overdue = tk.dueAt != null && tk.dueAt < from;
      raw.push({
        kind: "task",
        title: tk.title,
        priority: tk.priority,
        hiveId: tk.hiveId,
        hiveNumber: null,
        apiaryId: tk.apiaryId,
        taskId: tk.id,
        reason: overdue ? "tâche en retard" : "tâche à échéance cette semaine",
      });
    }

    // 2) inspections dues (nextInspectionAt <= to ou jamais inspectée) + ruches faibles
    const hives = await prisma.hive.findMany({
      where: {
        ownerId: ctx.dataOwnerId,
        deletedAt: null,
        status: { in: ["active", "strong", "medium", "weak", "very_weak"] },
      },
      select: {
        id: true,
        number: true,
        apiaryId: true,
        status: true,
        lastInspectionAt: true,
        nextInspectionAt: true,
      },
    });
    for (const h of hives) {
      const weak = h.status === "weak" || h.status === "very_weak";
      const due =
        !h.lastInspectionAt ||
        (h.nextInspectionAt != null && h.nextInspectionAt < to);
      if (weak) {
        raw.push({
          kind: "inspection",
          title: `Inspecter la ruche ${h.number}`,
          priority: h.status === "very_weak" ? "urgent" : "high",
          hiveId: h.id,
          hiveNumber: h.number,
          apiaryId: h.apiaryId,
          taskId: null,
          reason: h.status === "very_weak" ? "ruche très faible" : "ruche faible",
        });
      } else if (due) {
        raw.push({
          kind: "inspection",
          title: `Inspecter la ruche ${h.number}`,
          priority: "normal",
          hiveId: h.id,
          hiveNumber: h.number,
          apiaryId: h.apiaryId,
          taskId: null,
          reason: h.lastInspectionAt ? "inspection due" : "jamais inspectée",
        });
      }
    }

    // 3) suivis de traitement (démarré il y a > 21 j, non clôturé)
    const treatments = await prisma.treatment.findMany({
      where: {
        ownerId: ctx.dataOwnerId,
        deletedAt: null,
        endedAt: null,
        startedAt: { lt: addDays(new Date(), -TREATMENT_FOLLOWUP_DAYS) },
      },
      select: { id: true, product: true, hiveId: true, hive: { select: { number: true, apiaryId: true } } },
    });
    for (const tr of treatments) {
      raw.push({
        kind: "treatment_followup",
        title: `Contrôler le traitement « ${tr.product} » (ruche ${tr.hive.number})`,
        priority: "normal",
        hiveId: tr.hiveId,
        hiveNumber: tr.hive.number,
        apiaryId: tr.hive.apiaryId,
        taskId: null,
        reason: "traitement en cours depuis plus de 3 semaines",
      });
    }

    // tri par priorité puis répartition round-robin sur les jours
    const rank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
    raw.sort((a, b) => rank[a.priority] - rank[b.priority]);

    const items: PlanItem[] = [];
    const perDay = new Array(days.length).fill(0);
    let cursor = 0;
    for (const it of raw) {
      // cherche le prochain jour non saturé
      let placed = false;
      for (let k = 0; k < days.length; k++) {
        const d = (cursor + k) % days.length;
        if (perDay[d] < req.maxPerDay) {
          items.push({ ...it, day: days[d]! });
          perDay[d]++;
          cursor = (d + 1) % days.length;
          placed = true;
          break;
        }
      }
      if (!placed) break; // semaine pleine
    }

    const counts = items.reduce(
      (acc, i) => ((acc[i.kind] = (acc[i.kind] ?? 0) + 1), acc),
      {} as Record<string, number>,
    );
    const summary =
      items.length === 0
        ? "Rien d'urgent à planifier cette semaine."
        : `${items.length} interventions proposées : ` +
          Object.entries(counts)
            .map(([k, n]) => `${n} ${k}`)
            .join(", ") +
          ". Aucune tâche n'est créée sans votre confirmation.";

    return { from: iso(from), to: iso(to), items, summary };
  },
};
