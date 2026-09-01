import type { ContextSnapshot } from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";

/**
 * Context Engine — §10 / §33.
 * Assemble le contexte vérifié à partir du snapshot client (page, rucher, ruche
 * courants) + données serveur. Toute valeur inconnue reste `null` — jamais inventée.
 */
export type BuiltContext = {
  user: { id: string; role: string };
  currentApiary: { id: string; name: string } | null;
  currentHive: {
    id: string;
    number: number;
    status: string;
    strength: string | null;
    lastInspectionAt: string | null;
    nextInspectionAt: string | null;
  } | null;
  currentInspectionId: string | null;
  date: string;
  tasks: { overdue: number; dueToday: number };
  weather: null; // branché en V3 — jamais de valeur fictive
  page: string | null;
};

export async function buildContext(
  ctx: AuthUser,
  snapshot: ContextSnapshot | undefined,
): Promise<BuiltContext> {
  const s = snapshot ?? {};
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday.getTime() + 86_400_000);

  const [apiary, hive, overdue, dueToday] = await Promise.all([
    s.currentApiaryId
      ? prisma.apiary.findFirst({
          where: { id: s.currentApiaryId, ownerId: ctx.dataOwnerId, deletedAt: null },
          select: { id: true, name: true },
        })
      : null,
    s.currentHiveId
      ? prisma.hive.findFirst({
          where: { id: s.currentHiveId, ownerId: ctx.dataOwnerId, deletedAt: null },
          select: {
            id: true,
            number: true,
            status: true,
            strength: true,
            lastInspectionAt: true,
            nextInspectionAt: true,
          },
        })
      : null,
    prisma.task.count({
      where: {
        ownerId: ctx.dataOwnerId,
        deletedAt: null,
        status: { in: ["todo", "doing"] },
        dueAt: { lt: startToday },
      },
    }),
    prisma.task.count({
      where: {
        ownerId: ctx.dataOwnerId,
        deletedAt: null,
        status: { in: ["todo", "doing"] },
        dueAt: { gte: startToday, lt: endToday },
      },
    }),
  ]);

  return {
    user: { id: ctx.id, role: ctx.role },
    currentApiary: apiary ?? null,
    currentHive: hive
      ? {
          id: hive.id,
          number: hive.number,
          status: hive.status,
          strength: hive.strength,
          lastInspectionAt: hive.lastInspectionAt?.toISOString() ?? null,
          nextInspectionAt: hive.nextInspectionAt?.toISOString() ?? null,
        }
      : null,
    currentInspectionId: s.currentInspectionId ?? null,
    date: new Date().toISOString().slice(0, 10),
    tasks: { overdue, dueToday },
    weather: null,
    page: s.page ?? null,
  };
}

/** Rendu texte injecté dans le prompt système. */
export function contextToPrompt(c: BuiltContext): string {
  const lines = [
    `Date du jour : ${c.date}`,
    `Page courante : ${c.page ?? "—"}`,
    c.currentApiary
      ? `Rucher courant : ${c.currentApiary.name} (id ${c.currentApiary.id})`
      : "Rucher courant : aucun",
    c.currentHive
      ? `Ruche courante : n°${c.currentHive.number} — statut ${c.currentHive.status}, force ${
          c.currentHive.strength ?? "inconnue"
        }, dernière inspection ${c.currentHive.lastInspectionAt ?? "jamais"} (id ${c.currentHive.id})`
      : "Ruche courante : aucune",
    `Tâches : ${c.tasks.overdue} en retard, ${c.tasks.dueToday} pour aujourd'hui`,
    `Météo : non disponible (ne jamais inventer de données météo)`,
  ];
  return lines.join("\n");
}
