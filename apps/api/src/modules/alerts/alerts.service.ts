import type { Prisma } from "@prisma/client";
import type { NotificationKind, Severity } from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { notFound } from "../../core/errors.js";
import { resolveThresholds } from "../settings/settings.service.js";

/**
 * Seuils du Knowledge Engine — §13/§32.
 * Résolus par utilisateur : `resolveThresholds(user.settings)` applique les
 * valeurs par défaut puis les surcharges enregistrées via /settings.
 */

const LIVE = ["active", "strong", "medium", "weak", "very_weak"] as const;

type Candidate = {
  kind: NotificationKind;
  severity: Severity;
  title: string;
  body?: string;
  hiveId?: string;
  apiaryId?: string;
  action?: Prisma.InputJsonValue;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export const alertsService = {
  async list(ctx: AuthUser, unreadOnly = false) {
    const rows = await prisma.notification.findMany({
      where: { ownerId: ctx.dataOwnerId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      severity: n.severity,
      title: n.title,
      body: n.body,
      hiveId: n.hiveId,
      apiaryId: n.apiaryId,
      action: n.action,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
  },

  async markRead(ctx: AuthUser, id: string) {
    const n = await prisma.notification.findFirst({ where: { id, ownerId: ctx.dataOwnerId } });
    if (!n) throw notFound("Notification", id);
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return { id, read: true };
  },

  /**
   * Recalcule les alertes d'un utilisateur — §13.
   * Idempotent : supprime les alertes non lues puis réinsère l'état courant.
   * Les alertes lues restent comme historique.
   */
  async scan(ctx: AuthUser) {
    const userRow = await prisma.user.findUnique({
      where: { id: ctx.id },
      select: { settings: true },
    });
    const T = resolveThresholds(userRow?.settings);

    const hives = await prisma.hive.findMany({
      where: { ownerId: ctx.dataOwnerId, deletedAt: null, status: { in: [...LIVE] } },
      select: {
        id: true,
        number: true,
        apiaryId: true,
        status: true,
        createdAt: true,
        lastInspectionAt: true,
        currentQueenId: true,
      },
    });

    const queenIds = hives.map((h) => h.currentQueenId).filter((v): v is string => !!v);
    const queenRows = queenIds.length
      ? await prisma.queen.findMany({
          where: { id: { in: queenIds } },
          select: { id: true, birthYear: true },
        })
      : [];
    const queenBirthYear = new Map(queenRows.map((q) => [q.id, q.birthYear]));

    const candidates: Candidate[] = [];

    for (const h of hives) {
      const label = `Ruche ${h.number}`;

      if (h.status === "very_weak") {
        candidates.push({
          kind: "weak_hive",
          severity: "urgent",
          title: `${label} : très faible`,
          hiveId: h.id,
          apiaryId: h.apiaryId,
        });
      } else if (h.status === "weak") {
        candidates.push({
          kind: "weak_hive",
          severity: "attention",
          title: `${label} : faible`,
          hiveId: h.id,
          apiaryId: h.apiaryId,
        });
      }

      if (!h.lastInspectionAt) {
        if (h.createdAt < daysAgo(T.neverInspectedDays)) {
          candidates.push({
            kind: "no_inspection",
            severity: "attention",
            title: `${label} n'a jamais été inspectée`,
            hiveId: h.id,
            apiaryId: h.apiaryId,
            action: { createTask: { type: "inspection", hiveId: h.id, title: `Inspecter ${label}` } },
          });
        }
      } else {
        const d = Math.floor((Date.now() - h.lastInspectionAt.getTime()) / 86_400_000);
        if (d >= T.inspectionOverdueDays) {
          candidates.push({
            kind: "inspection_overdue",
            severity: d >= T.inspectionAttentionDays ? "attention" : "watch",
            title: `${label} n'a pas été inspectée depuis ${d} jours`,
            hiveId: h.id,
            apiaryId: h.apiaryId,
            action: { createTask: { type: "inspection", hiveId: h.id, title: `Inspecter ${label}` } },
          });
        }
      }

      if (!h.currentQueenId && h.lastInspectionAt) {
        candidates.push({
          kind: "no_queen",
          severity: "watch",
          title: `${label} : aucune reine enregistrée`,
          hiveId: h.id,
          apiaryId: h.apiaryId,
        });
      }

      const by = h.currentQueenId ? queenBirthYear.get(h.currentQueenId) : null;
      if (by && new Date().getFullYear() - by >= T.queenOldYears) {
        candidates.push({
          kind: "old_queen",
          severity: "watch",
          title: `${label} : reine de ${by} (${new Date().getFullYear() - by} ans)`,
          hiveId: h.id,
          apiaryId: h.apiaryId,
        });
      }
    }

    // dernières inspections signalant une reine absente
    const noQueenInspections = await prisma.inspection.findMany({
      where: { ownerId: ctx.dataOwnerId, deletedAt: null, queenPresent: false, performedAt: { gte: daysAgo(45) } },
      select: { hiveId: true, hive: { select: { number: true, apiaryId: true } } },
      distinct: ["hiveId"],
    });
    for (const i of noQueenInspections) {
      candidates.push({
        kind: "no_queen",
        severity: "attention",
        title: `Ruche ${i.hive.number} : reine signalée absente lors de la dernière inspection`,
        hiveId: i.hiveId,
        apiaryId: i.hive.apiaryId,
      });
    }

    // tâches urgentes imminentes
    const urgentTasks = await prisma.task.findMany({
      where: {
        ownerId: ctx.dataOwnerId,
        deletedAt: null,
        status: { in: ["todo", "doing"] },
        priority: "urgent",
        dueAt: { lte: daysAgo(-T.urgentTaskWithinDays) },
      },
      select: { id: true, title: true, hiveId: true },
    });
    for (const tk of urgentTasks) {
      candidates.push({
        kind: "urgent_task",
        severity: "attention",
        title: `Tâche urgente : ${tk.title}`,
        hiveId: tk.hiveId ?? undefined,
      });
    }

    // réécriture idempotente des alertes non lues
    const written = await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { ownerId: ctx.dataOwnerId, readAt: null } });
      if (candidates.length === 0) return 0;
      await tx.notification.createMany({
        data: candidates.map((c) => ({
          ownerId: ctx.dataOwnerId,
          kind: c.kind,
          severity: c.severity,
          title: c.title,
          body: c.body ?? null,
          hiveId: c.hiveId ?? null,
          apiaryId: c.apiaryId ?? null,
          action: c.action ?? undefined,
        })),
      });
      return candidates.length;
    });

    return { generated: written };
  },
};
