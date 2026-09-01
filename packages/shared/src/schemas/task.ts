import { z } from "zod";
import { zClientUuid, zEntityMeta, zId } from "../common.js";
import { TASK_PRIORITY, TASK_STATUS, TASK_TYPE } from "../enums.js";

export const zTaskCreate = z
  .object({
    title: z.string().min(1).max(200),
    type: z.enum(TASK_TYPE).default("custom"),
    hiveId: zId.nullable().optional(),
    apiaryId: zId.nullable().optional(),
    priority: z.enum(TASK_PRIORITY).default("normal"),
    dueAt: z.string().datetime().nullable().optional(),
    reminderAt: z.string().datetime().nullable().optional(),
    /** RRULE simplifiée, ex. { freq: "WEEKLY", interval: 2 } */
    recurrence: z
      .object({
        freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
        interval: z.number().int().min(1).max(52).default(1),
      })
      .nullable()
      .optional(),
    notes: z.string().max(2000).optional(),
    clientUuid: zClientUuid.optional(),
  })
  .refine((t) => t.hiveId == null || t.apiaryId == null, {
    message: "Une tâche cible une ruche OU un rucher, pas les deux.",
  });
export type TaskCreate = z.infer<typeof zTaskCreate>;

export const zTaskUpdate = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum(TASK_TYPE).optional(),
  priority: z.enum(TASK_PRIORITY).optional(),
  status: z.enum(TASK_STATUS).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type TaskUpdate = z.infer<typeof zTaskUpdate>;

export const zTaskListQuery = z.object({
  scope: z.enum(["all", "overdue", "today", "week"]).default("all"),
  hiveId: zId.optional(),
  status: z.enum(TASK_STATUS).optional(),
});
export type TaskListQuery = z.infer<typeof zTaskListQuery>;

export const zTask = zEntityMeta.extend({
  title: z.string(),
  type: z.enum(TASK_TYPE),
  hiveId: zId.nullable(),
  apiaryId: zId.nullable(),
  priority: z.enum(TASK_PRIORITY),
  status: z.enum(TASK_STATUS),
  dueAt: z.string().datetime().nullable(),
  reminderAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  /** Attribution en équipe co-propriétaire : créateur et personne ayant complété. */
  createdBy: zId.nullable().optional(),
  author: z.string().nullable().optional(),
  completedBy: zId.nullable().optional(),
  completedByName: z.string().nullable().optional(),
});
export type Task = z.infer<typeof zTask>;
