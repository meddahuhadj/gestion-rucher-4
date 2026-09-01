import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";

/** Rapports exportables — §29. Chaque type produit un CSV plat, filtrable par date. */
export const REPORT_KINDS = [
  "hives",
  "inspections",
  "harvests",
  "expenses",
  "revenues",
  "tasks",
  "treatments",
  "queens",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export function isReportKind(v: string): v is ReportKind {
  return (REPORT_KINDS as readonly string[]).includes(v);
}

type Cell = string | number | boolean | null | undefined;
type Row = Record<string, Cell>;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const num = (d: unknown) => (d == null ? "" : Number(d));
const bool = (b: boolean | null | undefined) => (b == null ? "" : b ? "oui" : "non");

function toCsv(headers: string[], rows: Row[], sep = ","): string {
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "boolean" ? (v ? "oui" : "non") : String(v);
    return new RegExp(`["${sep}\\r\\n]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(sep)];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(sep));
  // BOM UTF-8 → Excel (locale FR) reconnaît l'encodage et les accents.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

function dateWindow(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}

/** hiveId → numéro de ruche, pour enrichir les lignes qui ne portent qu'un id. */
async function hiveNumbers(ownerId: string): Promise<Map<string, number>> {
  const rows = await prisma.hive.findMany({
    where: { ownerId },
    select: { id: true, number: true },
  });
  return new Map(rows.map((h) => [h.id, h.number]));
}

export const reportsService = {
  kinds: () => REPORT_KINDS,

  async build(
    ctx: AuthUser,
    kind: ReportKind,
    opts: { from?: string; to?: string; sep?: "," | ";" } = {},
  ): Promise<{ filename: string; csv: string }> {
    const sep = opts.sep ?? ",";
    const scope = { ownerId: ctx.dataOwnerId, deletedAt: null };
    const win = dateWindow(opts.from, opts.to);
    const stamp = new Date().toISOString().slice(0, 10);
    let headers: string[] = [];
    let rows: Row[] = [];

    if (kind === "hives") {
      const list = await prisma.hive.findMany({
        where: { ...scope, ...(win ? { createdAt: win } : {}) },
        include: { apiary: { select: { name: true } } },
        orderBy: { number: "asc" },
      });
      headers = [
        "number", "name", "apiary", "status", "strength", "hiveType",
        "strain", "origin", "lastInspectionAt", "nextInspectionAt", "notes", "createdAt",
      ];
      rows = list.map((h) => ({
        number: h.number,
        name: h.name,
        apiary: h.apiary.name,
        status: h.status,
        strength: h.strength ?? "",
        hiveType: h.hiveType,
        strain: h.strain,
        origin: h.origin,
        lastInspectionAt: day(h.lastInspectionAt),
        nextInspectionAt: day(h.nextInspectionAt),
        notes: h.notes,
        createdAt: day(h.createdAt),
      }));
    } else if (kind === "inspections") {
      const [list, nums] = await Promise.all([
        prisma.inspection.findMany({
          where: { ...scope, ...(win ? { performedAt: win } : {}) },
          orderBy: { performedAt: "desc" },
        }),
        hiveNumbers(ctx.dataOwnerId),
      ]);
      headers = [
        "performedAt", "hive", "method", "colonyStrength", "queenSeen", "queenPresent",
        "laying", "broodOpen", "broodCapped", "broodAmount", "storesHoney",
        "storesPollen", "feed", "healthStatus", "notes",
      ];
      rows = list.map((i) => ({
        performedAt: iso(i.performedAt),
        hive: nums.get(i.hiveId) ?? "",
        method: i.method,
        colonyStrength: i.colonyStrength ?? "",
        queenSeen: bool(i.queenSeen),
        queenPresent: bool(i.queenPresent),
        laying: i.laying ?? "",
        broodOpen: bool(i.broodOpen),
        broodCapped: bool(i.broodCapped),
        broodAmount: i.broodAmount ?? "",
        storesHoney: i.storesHoney ?? "",
        storesPollen: i.storesPollen ?? "",
        feed: i.feed ?? "",
        healthStatus: i.healthStatus,
        notes: i.notes,
      }));
    } else if (kind === "harvests") {
      const [list, nums] = await Promise.all([
        prisma.harvest.findMany({
          where: { ...scope, ...(win ? { harvestedAt: win } : {}) },
          include: { apiary: { select: { name: true } } },
          orderBy: { harvestedAt: "desc" },
        }),
        hiveNumbers(ctx.dataOwnerId),
      ]);
      headers = [
        "harvestedAt", "apiary", "hive", "batchCode", "honeyType",
        "quantityKg", "jars", "unitPriceDzd", "clientName", "notes",
      ];
      rows = list.map((h) => ({
        harvestedAt: day(h.harvestedAt),
        apiary: h.apiary.name,
        hive: h.hiveId ? (nums.get(h.hiveId) ?? "") : "",
        batchCode: h.batchCode,
        honeyType: h.honeyType,
        quantityKg: num(h.quantityKg),
        jars: h.jars,
        unitPriceDzd: num(h.unitPriceDzd),
        clientName: h.clientName,
        notes: h.notes,
      }));
    } else if (kind === "expenses") {
      const list = await prisma.expense.findMany({
        where: { ...scope, ...(win ? { spentAt: win } : {}) },
        orderBy: { spentAt: "desc" },
      });
      headers = ["spentAt", "amountDzd", "category", "description"];
      rows = list.map((e) => ({
        spentAt: day(e.spentAt),
        amountDzd: num(e.amountDzd),
        category: e.category,
        description: e.description,
      }));
    } else if (kind === "revenues") {
      const list = await prisma.revenue.findMany({
        where: { ...scope, ...(win ? { receivedAt: win } : {}) },
        orderBy: { receivedAt: "desc" },
      });
      headers = [
        "receivedAt", "amountDzd", "product", "quantity",
        "unitPriceDzd", "clientName", "batchCode",
      ];
      rows = list.map((r) => ({
        receivedAt: day(r.receivedAt),
        amountDzd: num(r.amountDzd),
        product: r.product,
        quantity: num(r.quantity),
        unitPriceDzd: num(r.unitPriceDzd),
        clientName: r.clientName,
        batchCode: r.batchCode,
      }));
    } else if (kind === "tasks") {
      const [list, nums] = await Promise.all([
        prisma.task.findMany({
          where: { ...scope, ...(win ? { dueAt: win } : {}) },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        }),
        hiveNumbers(ctx.dataOwnerId),
      ]);
      headers = ["title", "type", "priority", "status", "dueAt", "completedAt", "hive", "notes"];
      rows = list.map((t) => ({
        title: t.title,
        type: t.type,
        priority: t.priority,
        status: t.status,
        dueAt: iso(t.dueAt),
        completedAt: iso(t.completedAt),
        hive: t.hiveId ? (nums.get(t.hiveId) ?? "") : "",
        notes: t.notes,
      }));
    } else if (kind === "treatments") {
      const [list, nums] = await Promise.all([
        prisma.treatment.findMany({
          where: { ...scope, ...(win ? { startedAt: win } : {}) },
          orderBy: { startedAt: "desc" },
        }),
        hiveNumbers(ctx.dataOwnerId),
      ]);
      headers = ["hive", "product", "target", "dose", "startedAt", "endedAt", "notes"];
      rows = list.map((tr) => ({
        hive: nums.get(tr.hiveId) ?? "",
        product: tr.product,
        target: tr.target,
        dose: tr.dose,
        startedAt: day(tr.startedAt),
        endedAt: day(tr.endedAt),
        notes: tr.notes,
      }));
    } else {
      // queens
      const [list, nums] = await Promise.all([
        prisma.queen.findMany({
          where: { ...scope, ...(win ? { introducedAt: win } : {}) },
          orderBy: { createdAt: "desc" },
        }),
        hiveNumbers(ctx.dataOwnerId),
      ]);
      headers = [
        "hive", "strain", "origin", "birthYear", "quality",
        "status", "introducedAt", "notes",
      ];
      rows = list.map((q) => ({
        hive: q.hiveId ? (nums.get(q.hiveId) ?? "") : "",
        strain: q.strain,
        origin: q.origin,
        birthYear: q.birthYear,
        quality: q.quality ?? "",
        status: q.status,
        introducedAt: day(q.introducedAt),
        notes: q.notes,
      }));
    }

    return {
      filename: `moumen_${kind}_${stamp}.csv`,
      csv: toCsv(headers, rows, sep),
    };
  },
};
