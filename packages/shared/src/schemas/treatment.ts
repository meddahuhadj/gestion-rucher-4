import { z } from "zod";
import { zClientUuid, zEntityMeta, zId } from "../common.js";
import { TREATMENT_TARGET } from "../enums.js";

export const zTreatmentCreate = z.object({
  hiveId: zId,
  product: z.string().min(1).max(120),
  target: z.enum(TREATMENT_TARGET).default("varroa"),
  dose: z.string().max(120).optional(),
  startedAt: z.string().date(),
  endedAt: z.string().date().optional(),
  notes: z.string().max(2000).optional(),
  clientUuid: zClientUuid.optional(),
});
export type TreatmentCreate = z.infer<typeof zTreatmentCreate>;

export const zTreatmentUpdate = z.object({
  product: z.string().min(1).max(120).optional(),
  target: z.enum(TREATMENT_TARGET).optional(),
  dose: z.string().max(120).nullable().optional(),
  endedAt: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type TreatmentUpdate = z.infer<typeof zTreatmentUpdate>;

export const zTreatmentListQuery = z.object({
  hiveId: zId.optional(),
  target: z.enum(TREATMENT_TARGET).optional(),
  active: z.coerce.boolean().optional(),
});
export type TreatmentListQuery = z.infer<typeof zTreatmentListQuery>;

export const zTreatment = zEntityMeta.extend({
  hiveId: zId,
  product: z.string(),
  target: z.enum(TREATMENT_TARGET),
  dose: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Treatment = z.infer<typeof zTreatment>;
