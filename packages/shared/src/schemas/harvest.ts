import { z } from "zod";
import { zClientUuid, zEntityMeta, zId } from "../common.js";

export const zHarvestCreate = z.object({
  apiaryId: zId,
  hiveId: zId.nullable().optional(),
  harvestedAt: z.string().date(),
  batchCode: z.string().max(60).optional(),
  honeyType: z.string().max(80).optional(),
  quantityKg: z.number().positive().max(10000),
  jars: z.number().int().nonnegative().max(100000).optional(),
  unitPriceDzd: z.number().nonnegative().max(1_000_000).optional(),
  clientName: z.string().max(160).optional(),
  notes: z.string().max(2000).optional(),
  clientUuid: zClientUuid.optional(),
});
export type HarvestCreate = z.infer<typeof zHarvestCreate>;

export const zHarvestUpdate = zHarvestCreate
  .partial()
  .omit({ clientUuid: true, apiaryId: true });
export type HarvestUpdate = z.infer<typeof zHarvestUpdate>;

export const zHarvestListQuery = z.object({
  apiaryId: zId.optional(),
  hiveId: zId.optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export type HarvestListQuery = z.infer<typeof zHarvestListQuery>;

export const zHarvest = zEntityMeta.extend({
  apiaryId: zId,
  hiveId: zId.nullable(),
  harvestedAt: z.string(),
  batchCode: z.string().nullable(),
  honeyType: z.string().nullable(),
  quantityKg: z.number(),
  jars: z.number().int().nullable(),
  unitPriceDzd: z.number().nullable(),
  clientName: z.string().nullable(),
  notes: z.string().nullable(),
  /** Auteur — attribution en équipe co-propriétaire. */
  createdBy: zId.nullable().optional(),
  author: z.string().nullable().optional(),
});
export type Harvest = z.infer<typeof zHarvest>;

/** Statistiques de production — §17. */
export const zProductionStats = z.object({
  totalKg: z.number(),
  averageKgPerHive: z.number(),
  harvestCount: z.number().int(),
  byHive: z.array(
    z.object({ hiveId: zId.nullable(), hiveNumber: z.number().int().nullable(), totalKg: z.number() }),
  ),
  byMonth: z.array(z.object({ month: z.string(), totalKg: z.number() })),
  bestHive: z
    .object({ hiveId: zId, hiveNumber: z.number().int(), totalKg: z.number() })
    .nullable(),
});
export type ProductionStats = z.infer<typeof zProductionStats>;
