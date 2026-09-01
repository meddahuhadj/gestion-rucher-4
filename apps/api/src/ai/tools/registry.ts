import { z } from "zod";
import {
  COLONY_STRENGTH,
  EXPENSE_CATEGORY,
  HIVE_STATUS,
  LEVEL,
  QUEEN_QUALITY,
  TASK_PRIORITY,
  TASK_TYPE,
  TREATMENT_TARGET,
} from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { apiariesService } from "../../modules/apiaries/apiaries.service.js";
import { hivesService } from "../../modules/hives/hives.service.js";
import { inspectionsService } from "../../modules/inspections/inspections.service.js";
import { tasksService } from "../../modules/tasks/tasks.service.js";
import { queensService } from "../../modules/queens/queens.service.js";
import { treatmentsService } from "../../modules/treatments/treatments.service.js";
import { harvestsService } from "../../modules/harvests/harvests.service.js";
import { financeService } from "../../modules/finance/finance.service.js";
import { alertsService } from "../../modules/alerts/alerts.service.js";
import { analyticsService } from "../../modules/analytics/analytics.service.js";
import { plannerService } from "../../modules/planner/planner.service.js";

/**
 * Registre d'outils — §9/§22.
 * Chaque outil : schéma strict (Zod) + JSON Schema pour le function calling,
 * niveau de confirmation (§23), exécution qui réutilise la couche service
 * (permissions et audit y sont déjà appliqués).
 */
export type Tool = {
  name: string;
  description: string;
  /** 1 = lecture (exécution directe) · 2 = action réversible · 3 = action sensible */
  level: 1 | 2 | 3;
  parameters: Record<string, unknown>;
  validate: (raw: unknown) => unknown;
  run: (args: unknown, ctx: AuthUser) => Promise<unknown>;
  summarize: (args: Record<string, unknown>) => string;
};

// NB : pas de `additionalProperties` ici — l'API Gemini (sous-ensemble OpenAPI 3.0
// pour le function calling) le rejette. La validation stricte se fait via Zod.
const obj = (
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> => ({
  type: "object",
  properties,
  required,
});
const str = (description: string) => ({ type: "string", description });
const int = (description: string) => ({ type: "integer", description });
const bool = (description: string) => ({ type: "boolean", description });
const enm = (values: readonly string[], description: string) => ({
  type: "string",
  enum: [...values],
  description,
});

export const TOOLS: Tool[] = [
  // ─────────── lecture (niveau 1) ───────────
  {
    name: "getApiaries",
    description: "Liste les ruchers de l'utilisateur avec le nombre de ruches.",
    level: 1,
    parameters: obj({}),
    validate: () => ({}),
    run: (_a, ctx) => apiariesService.list(ctx),
    summarize: () => "Lister les ruchers",
  },
  {
    name: "getHives",
    description:
      "Liste les ruches. Filtres optionnels : weak (faibles), notInspectedSinceDays, apiaryId, status.",
    level: 1,
    parameters: obj({
      weak: bool("ne renvoyer que les ruches faibles / très faibles"),
      notInspectedSinceDays: int("ruches sans inspection depuis N jours"),
      apiaryId: str("filtrer sur un rucher"),
      status: enm(HIVE_STATUS, "filtrer sur un statut"),
    }),
    validate: (raw) =>
      z
        .object({
          weak: z.boolean().optional(),
          notInspectedSinceDays: z.number().int().min(1).max(365).optional(),
          apiaryId: z.string().uuid().optional(),
          status: z.enum(HIVE_STATUS).optional(),
        })
        .parse(raw ?? {}),
    run: (a, ctx) => hivesService.list(ctx, a as never),
    summarize: () => "Lister les ruches",
  },
  {
    name: "getHive",
    description: "Détail d'une ruche par son identifiant.",
    level: 1,
    parameters: obj({ hiveId: str("identifiant de la ruche") }, ["hiveId"]),
    validate: (raw) => z.object({ hiveId: z.string().uuid() }).parse(raw),
    run: (a, ctx) => hivesService.get(ctx, (a as { hiveId: string }).hiveId),
    summarize: () => "Consulter une ruche",
  },
  {
    name: "getHiveCounts",
    description: "Compteurs de ruches par statut (pour le tableau de bord).",
    level: 1,
    parameters: obj({}),
    validate: () => ({}),
    run: (_a, ctx) => hivesService.counts(ctx),
    summarize: () => "Compter les ruches",
  },
  {
    name: "getInspectionHistory",
    description:
      "Historique condensé des inspections d'une ruche sur une fenêtre (rangeDays, défaut 90).",
    level: 1,
    parameters: obj(
      { hiveId: str("identifiant de la ruche"), rangeDays: int("fenêtre en jours") },
      ["hiveId"],
    ),
    validate: (raw) =>
      z
        .object({
          hiveId: z.string().uuid(),
          rangeDays: z.number().int().min(1).max(365).optional(),
        })
        .parse(raw),
    run: (a, ctx) => {
      const { hiveId, rangeDays } = a as { hiveId: string; rangeDays?: number };
      return inspectionsService.history(ctx, hiveId, rangeDays ?? 90);
    },
    summarize: () => "Consulter l'historique d'inspections",
  },
  {
    name: "getUpcomingTasks",
    description: "Tâches à faire dans les 7 prochains jours.",
    level: 1,
    parameters: obj({}),
    validate: () => ({}),
    run: (_a, ctx) => tasksService.list(ctx, { scope: "week" }),
    summarize: () => "Lister les tâches à venir",
  },
  {
    name: "getOverdueTasks",
    description: "Tâches en retard (échéance dépassée, non terminées).",
    level: 1,
    parameters: obj({}),
    validate: () => ({}),
    run: (_a, ctx) => tasksService.list(ctx, { scope: "overdue" }),
    summarize: () => "Lister les tâches en retard",
  },
  {
    name: "getQueens",
    description:
      "Liste les reines. Filtres : hiveId, status, olderThanYears (reines anciennes, ex. 3).",
    level: 1,
    parameters: obj({
      hiveId: str("filtrer sur une ruche"),
      olderThanYears: int("reines nées il y a au moins N ans"),
    }),
    validate: (raw) =>
      z
        .object({
          hiveId: z.string().uuid().optional(),
          olderThanYears: z.number().int().min(1).max(10).optional(),
        })
        .parse(raw ?? {}),
    run: (a, ctx) => queensService.list(ctx, a as never),
    summarize: () => "Lister les reines",
  },
  {
    name: "getTreatments",
    description: "Liste les traitements sanitaires. Filtres : hiveId, active (en cours).",
    level: 1,
    parameters: obj({
      hiveId: str("filtrer sur une ruche"),
      active: bool("seulement les traitements en cours"),
    }),
    validate: (raw) =>
      z
        .object({
          hiveId: z.string().uuid().optional(),
          active: z.boolean().optional(),
        })
        .parse(raw ?? {}),
    run: (a, ctx) => treatmentsService.list(ctx, a as never),
    summarize: () => "Lister les traitements",
  },
  {
    name: "generatePlan",
    description:
      "Propose un planning de travail pour la semaine (tâches en retard, inspections dues, ruches à surveiller, suivis de traitement). Ne crée rien : présente la proposition à l'utilisateur.",
    level: 1,
    parameters: obj({
      from: str("début AAAA-MM-JJ (défaut : aujourd'hui)"),
      to: str("fin AAAA-MM-JJ (défaut : +7 jours)"),
    }),
    validate: (raw) =>
      z
        .object({
          from: z.string().date().optional(),
          to: z.string().date().optional(),
        })
        .parse(raw ?? {}),
    run: (a, ctx) => plannerService.generate(ctx, { ...(a as object), maxPerDay: 4 } as never),
    summarize: () => "Proposer un planning de semaine",
  },
  {
    name: "getAlerts",
    description:
      "Liste les alertes intelligentes en cours (inspection en retard, ruche faible, reine ancienne, etc.).",
    level: 1,
    parameters: obj({}),
    validate: () => ({}),
    run: (_a, ctx) => alertsService.list(ctx, true),
    summarize: () => "Consulter les alertes",
  },
  {
    name: "generateAIInsights",
    description:
      "Vue d'ensemble agrégée du rucher (ruches, inspections, tâches, production de l'année, finances du mois, alertes) pour produire des synthèses. Basé uniquement sur les données réelles.",
    level: 1,
    parameters: obj({}),
    validate: () => ({}),
    run: (_a, ctx) => analyticsService.overview(ctx),
    summarize: () => "Générer une vue d'ensemble",
  },
  {
    name: "getProductionStatistics",
    description:
      "Statistiques de production de miel : total, moyenne par ruche, par mois, meilleure ruche. Fenêtre optionnelle from/to (AAAA-MM-JJ).",
    level: 1,
    parameters: obj({ from: str("date de début"), to: str("date de fin") }),
    validate: (raw) =>
      z
        .object({ from: z.string().date().optional(), to: z.string().date().optional() })
        .parse(raw ?? {}),
    run: (a, ctx) => {
      const { from, to } = a as { from?: string; to?: string };
      return harvestsService.stats(ctx, from, to);
    },
    summarize: () => "Consulter les statistiques de production",
  },
  {
    name: "getFinancialSummary",
    description:
      "Synthèse financière (revenus − dépenses = bénéfice) sur une période. preset: day|week|month|year, ou from/to.",
    level: 1,
    parameters: obj({
      preset: enm(["day", "week", "month", "year", "custom"], "période"),
      from: str("date de début (si custom)"),
      to: str("date de fin (si custom)"),
    }),
    validate: (raw) =>
      z
        .object({
          preset: z.enum(["day", "week", "month", "year", "custom"]).default("month"),
          from: z.string().date().optional(),
          to: z.string().date().optional(),
        })
        .parse(raw ?? {}),
    run: (a, ctx) => financeService.summary(ctx, a as never),
    summarize: () => "Consulter la synthèse financière",
  },

  // ─────────── action réversible (niveau 2) ───────────
  {
    name: "createInspection",
    description:
      "Enregistre une inspection pour une ruche. N'utiliser qu'après confirmation de l'utilisateur.",
    level: 2,
    parameters: obj(
      {
        hiveId: str("identifiant de la ruche"),
        colonyStrength: enm(COLONY_STRENGTH, "force de la colonie observée"),
        queenSeen: bool("la reine a-t-elle été vue"),
        storesHoney: enm(LEVEL, "niveau des réserves de miel"),
        notes: str("observations libres"),
      },
      ["hiveId"],
    ),
    validate: (raw) =>
      z
        .object({
          hiveId: z.string().uuid(),
          colonyStrength: z.enum(COLONY_STRENGTH).optional(),
          queenSeen: z.boolean().optional(),
          storesHoney: z.enum(LEVEL).optional(),
          notes: z.string().max(2000).optional(),
        })
        .parse(raw),
    run: (a, ctx) =>
      inspectionsService.create(
        ctx,
        { ...(a as object), method: "voice" } as never,
        "ai",
      ),
    summarize: (a) => `Créer une inspection pour la ruche ${a.hiveId}`,
  },
  {
    name: "createTask",
    description:
      "Crée une tâche / un travail. N'utiliser qu'après confirmation de l'utilisateur.",
    level: 2,
    parameters: obj(
      {
        title: str("intitulé de la tâche"),
        type: enm(TASK_TYPE, "type de travail"),
        hiveId: str("ruche concernée (optionnel)"),
        priority: enm(TASK_PRIORITY, "priorité"),
        dueAt: str("échéance ISO 8601 (optionnel)"),
      },
      ["title"],
    ),
    validate: (raw) =>
      z
        .object({
          title: z.string().min(1).max(200),
          type: z.enum(TASK_TYPE).optional(),
          hiveId: z.string().uuid().optional(),
          priority: z.enum(TASK_PRIORITY).optional(),
          dueAt: z.string().datetime().optional(),
        })
        .parse(raw),
    run: (a, ctx) =>
      tasksService.create(
        ctx,
        {
          ...(a as { title: string }),
          type: (a as { type?: string }).type ?? "custom",
          priority: (a as { priority?: string }).priority ?? "normal",
        } as never,
        "ai",
      ),
    summarize: (a) => `Créer la tâche « ${String(a.title)} »`,
  },
  {
    name: "updateHiveStatus",
    description: "Modifie le statut d'une ruche. Confirmation requise.",
    level: 2,
    parameters: obj(
      { hiveId: str("identifiant de la ruche"), status: enm(HIVE_STATUS, "nouveau statut") },
      ["hiveId", "status"],
    ),
    validate: (raw) =>
      z
        .object({ hiveId: z.string().uuid(), status: z.enum(HIVE_STATUS) })
        .parse(raw),
    run: (a, ctx) => {
      const { hiveId, status } = a as { hiveId: string; status: never };
      return hivesService.update(ctx, hiveId, { status });
    },
    summarize: (a) => `Passer la ruche ${a.hiveId} au statut « ${String(a.status)} »`,
  },

  {
    name: "createQueen",
    description:
      "Introduit une reine dans une ruche (devient la reine courante). Confirmation requise.",
    level: 2,
    parameters: obj(
      {
        hiveId: str("ruche d'introduction"),
        introducedAt: str("date AAAA-MM-JJ"),
        origin: str("origine / éleveur"),
        strain: str("race / souche"),
        birthYear: int("année de naissance"),
        quality: enm(QUEEN_QUALITY, "qualité observée"),
      },
      ["hiveId"],
    ),
    validate: (raw) =>
      z
        .object({
          hiveId: z.string().uuid(),
          introducedAt: z.string().date().optional(),
          origin: z.string().max(120).optional(),
          strain: z.string().max(120).optional(),
          birthYear: z.number().int().min(2000).max(2100).optional(),
          quality: z.enum(QUEEN_QUALITY).optional(),
        })
        .parse(raw),
    run: (a, ctx) =>
      queensService.create(ctx, { ...(a as object), status: "active", setAsCurrent: true } as never, "ai"),
    summarize: (a) => `Introduire une reine dans la ruche ${a.hiveId}`,
  },
  {
    name: "createTreatment",
    description:
      "Enregistre un traitement sanitaire pour une ruche. Confirmation requise.",
    level: 2,
    parameters: obj(
      {
        hiveId: str("ruche traitée"),
        product: str("produit utilisé"),
        target: enm(TREATMENT_TARGET, "cible du traitement"),
        startedAt: str("date de début AAAA-MM-JJ"),
        dose: str("dosage"),
      },
      ["hiveId", "product", "startedAt"],
    ),
    validate: (raw) =>
      z
        .object({
          hiveId: z.string().uuid(),
          product: z.string().min(1).max(120),
          target: z.enum(TREATMENT_TARGET).default("varroa"),
          startedAt: z.string().date(),
          dose: z.string().max(120).optional(),
        })
        .parse(raw),
    run: (a, ctx) => treatmentsService.create(ctx, a as never, "ai"),
    summarize: (a) => `Enregistrer un traitement « ${String(a.product)} »`,
  },
  {
    name: "createHarvest",
    description:
      "Enregistre une récolte de miel. Confirmation requise.",
    level: 2,
    parameters: obj(
      {
        apiaryId: str("rucher concerné"),
        hiveId: str("ruche concernée (optionnel)"),
        harvestedAt: str("date de récolte AAAA-MM-JJ"),
        quantityKg: { type: "number", description: "quantité récoltée en kg" },
        honeyType: str("type de miel"),
      },
      ["apiaryId", "harvestedAt", "quantityKg"],
    ),
    validate: (raw) =>
      z
        .object({
          apiaryId: z.string().uuid(),
          hiveId: z.string().uuid().optional(),
          harvestedAt: z.string().date(),
          quantityKg: z.number().positive().max(10000),
          honeyType: z.string().max(80).optional(),
        })
        .parse(raw),
    run: (a, ctx) => harvestsService.create(ctx, a as never, "ai"),
    summarize: (a) => `Enregistrer une récolte de ${String(a.quantityKg)} kg`,
  },

  // ─────────── action sensible (niveau 3) ───────────
  {
    name: "createExpense",
    description:
      "Enregistre une dépense (opération financière). Action sensible : confirmation obligatoire.",
    level: 3,
    parameters: obj(
      {
        spentAt: str("date AAAA-MM-JJ"),
        amountDzd: { type: "number", description: "montant en DZD" },
        category: enm(EXPENSE_CATEGORY, "catégorie de dépense"),
        description: str("libellé"),
        hiveId: str("ruche concernée (optionnel)"),
      },
      ["spentAt", "amountDzd"],
    ),
    validate: (raw) =>
      z
        .object({
          spentAt: z.string().date(),
          amountDzd: z.number().positive().max(1_000_000_000),
          category: z.enum(EXPENSE_CATEGORY).default("other"),
          description: z.string().max(2000).optional(),
          hiveId: z.string().uuid().optional(),
        })
        .parse(raw),
    run: (a, ctx) => financeService.createExpense(ctx, a as never, "ai"),
    summarize: (a) => `Enregistrer une dépense de ${String(a.amountDzd)} DZD`,
  },
  {
    name: "createRevenue",
    description:
      "Enregistre un revenu (opération financière). Action sensible : confirmation obligatoire.",
    level: 3,
    parameters: obj(
      {
        receivedAt: str("date AAAA-MM-JJ"),
        amountDzd: { type: "number", description: "montant en DZD" },
        product: str("produit vendu"),
        clientName: str("client"),
      },
      ["receivedAt", "amountDzd"],
    ),
    validate: (raw) =>
      z
        .object({
          receivedAt: z.string().date(),
          amountDzd: z.number().positive().max(1_000_000_000),
          product: z.string().max(120).optional(),
          clientName: z.string().max(160).optional(),
        })
        .parse(raw),
    run: (a, ctx) => financeService.createRevenue(ctx, a as never, "ai"),
    summarize: (a) => `Enregistrer un revenu de ${String(a.amountDzd)} DZD`,
  },
  {
    name: "archiveHive",
    description:
      "Archive une ruche (morte, vendue, fusionnée). Action sensible : confirmation obligatoire. L'historique est conservé.",
    level: 3,
    parameters: obj(
      { hiveId: str("identifiant de la ruche"), reason: str("motif de l'archivage") },
      ["hiveId", "reason"],
    ),
    validate: (raw) =>
      z
        .object({ hiveId: z.string().uuid(), reason: z.string().min(1).max(400) })
        .parse(raw),
    run: (a, ctx) => {
      const { hiveId, reason } = a as { hiveId: string; reason: string };
      return hivesService.archive(ctx, hiveId, reason);
    },
    summarize: (a) => `Archiver la ruche ${a.hiveId} (${String(a.reason)})`,
  },
];

export const toolByName = new Map(TOOLS.map((t) => [t.name, t]));

const schemaOf = (t: Tool) => ({
  name: t.name,
  description: t.description,
  parameters: t.parameters,
});

export const toolSchemas = () => TOOLS.map(schemaOf);

/**
 * Sous-ensemble exposé pendant une session vocale — lecture seule (niveau 1).
 * Les actions (niveau 2/3) restent proposées puis confirmées à l'écran.
 */
export const voiceToolSchemas = () => TOOLS.filter((t) => t.level === 1).map(schemaOf);
