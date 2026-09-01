import { z } from "zod";
import { zClientUuid, zEntityMeta, zId } from "../common.js";
import { COLONY_STRENGTH, HIVE_STATUS } from "../enums.js";

export const zHiveCreate = z.object({
  apiaryId: zId,
  number: z.number().int().positive(),
  name: z.string().max(120).optional(),
  origin: z.string().max(120).optional(),
  hiveType: z.string().max(120).optional(),
  strain: z.string().max(120).optional(),
  status: z.enum(HIVE_STATUS).default("active"),
  strength: z.enum(COLONY_STRENGTH).nullable().optional(),
  photoAttachmentId: zId.optional(),
  notes: z.string().max(4000).optional(),
  clientUuid: zClientUuid.optional(),
});
export type HiveCreate = z.infer<typeof zHiveCreate>;

export const zHiveUpdate = zHiveCreate
  .partial()
  .omit({ clientUuid: true })
  .extend({
    photoAttachmentId: zId.nullable().optional(),
    /** Réassigne la reine courante ; l'ancienne passe "replaced" (ou "removed" si null). */
    currentQueenId: zId.nullable().optional(),
  });
export type HiveUpdate = z.infer<typeof zHiveUpdate>;

/**
 * Filtres de liste — alimente `getHives()` (outil IA) et `/hives`.
 * `notInspectedSinceDays` : ruches sans inspection depuis N jours — §20.
 */
export const zHiveListQuery = z.object({
  apiaryId: zId.optional(),
  status: z.enum(HIVE_STATUS).optional(),
  weak: z.coerce.boolean().optional(),
  /** true : ruches archivées/mortes/vendues/fusionnées uniquement. Par défaut elles sont masquées. */
  archived: z.coerce.boolean().optional(),
  notInspectedSinceDays: z.coerce.number().int().min(1).max(365).optional(),
  search: z.string().max(120).optional(),
});
export type HiveListQuery = z.infer<typeof zHiveListQuery>;

export const zHive = zEntityMeta.extend({
  apiaryId: zId,
  number: z.number().int(),
  name: z.string().nullable(),
  origin: z.string().nullable(),
  hiveType: z.string().nullable(),
  strain: z.string().nullable(),
  status: z.enum(HIVE_STATUS),
  strength: z.enum(COLONY_STRENGTH).nullable(),
  currentQueenId: zId.nullable(),
  photoAttachmentId: zId.nullable(),
  lastInspectionAt: z.string().datetime().nullable(),
  nextInspectionAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
});
export type Hive = z.infer<typeof zHive>;
