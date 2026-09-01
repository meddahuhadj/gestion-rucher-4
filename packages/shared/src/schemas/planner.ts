import { z } from "zod";
import { zId } from "../common.js";
import { TASK_PRIORITY } from "../enums.js";

export const zPlannerRequest = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  /** nombre max d'items proposés par jour */
  maxPerDay: z.coerce.number().int().min(1).max(20).default(4),
});
export type PlannerRequest = z.infer<typeof zPlannerRequest>;

export const zPlanItem = z.object({
  day: z.string(), // AAAA-MM-JJ
  kind: z.enum(["inspection", "task", "treatment_followup", "harvest"]),
  title: z.string(),
  priority: z.enum(TASK_PRIORITY),
  hiveId: zId.nullable(),
  hiveNumber: z.number().int().nullable(),
  apiaryId: zId.nullable(),
  /** pourquoi cet item est proposé — transparence, §14 */
  reason: z.string(),
  /** tâche existante liée (le cas échéant) */
  taskId: zId.nullable(),
});
export type PlanItem = z.infer<typeof zPlanItem>;

/** Planning PROPOSÉ — jamais appliqué automatiquement (§14/§57). */
export const zPlannerResult = z.object({
  from: z.string(),
  to: z.string(),
  items: z.array(zPlanItem),
  summary: z.string(),
});
export type PlannerResult = z.infer<typeof zPlannerResult>;
