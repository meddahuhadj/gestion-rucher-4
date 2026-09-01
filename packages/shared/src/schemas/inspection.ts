import { z } from "zod";
import { zClientUuid, zEntityMeta, zId } from "../common.js";
import {
  BROOD_AMOUNT,
  COLONY_STRENGTH,
  INSPECTION_METHOD,
  LAYING_PATTERN,
  LEVEL,
  OBSERVATION_SOURCE,
  SEVERITY,
} from "../enums.js";

export const zInspectionObservation = z.object({
  key: z.string().min(1).max(80),
  value: z.unknown(),
  source: z.enum(OBSERVATION_SOURCE).default("user"),
});
export type InspectionObservation = z.infer<typeof zInspectionObservation>;

export const zInspectionCreate = z.object({
  hiveId: zId,
  performedAt: z.string().datetime().optional(),
  method: z.enum(INSPECTION_METHOD).default("manual"),

  colonyStrength: z.enum(COLONY_STRENGTH).nullable().optional(),
  queenPresent: z.boolean().nullable().optional(),
  queenSeen: z.boolean().nullable().optional(),
  laying: z.enum(LAYING_PATTERN).nullable().optional(),
  broodOpen: z.boolean().nullable().optional(),
  broodCapped: z.boolean().nullable().optional(),
  broodAmount: z.enum(BROOD_AMOUNT).nullable().optional(),
  storesHoney: z.enum(LEVEL).nullable().optional(),
  storesPollen: z.enum(LEVEL).nullable().optional(),
  feed: z.enum(LEVEL).nullable().optional(),
  healthStatus: z.string().max(200).nullable().optional(),

  notes: z.string().max(4000).optional(),
  transcript: z.string().max(20000).optional(),
  weatherRecordId: zId.optional(),
  attachmentIds: z.array(zId).max(30).optional(),
  observations: z.array(zInspectionObservation).max(50).optional(),
  clientUuid: zClientUuid.optional(),
});
export type InspectionCreate = z.infer<typeof zInspectionCreate>;

export const zInspectionUpdate = zInspectionCreate
  .partial()
  .omit({ hiveId: true, clientUuid: true });
export type InspectionUpdate = z.infer<typeof zInspectionUpdate>;

export const zInspection = zEntityMeta.extend({
  hiveId: zId,
  performedAt: z.string().datetime(),
  method: z.enum(INSPECTION_METHOD),
  colonyStrength: z.enum(COLONY_STRENGTH).nullable(),
  queenPresent: z.boolean().nullable(),
  queenSeen: z.boolean().nullable(),
  laying: z.enum(LAYING_PATTERN).nullable(),
  broodOpen: z.boolean().nullable(),
  broodCapped: z.boolean().nullable(),
  broodAmount: z.enum(BROOD_AMOUNT).nullable(),
  storesHoney: z.enum(LEVEL).nullable(),
  storesPollen: z.enum(LEVEL).nullable(),
  feed: z.enum(LEVEL).nullable(),
  healthStatus: z.string().nullable(),
  notes: z.string().nullable(),
  transcript: z.string().nullable(),
  aiSummaryId: zId.nullable(),
  /** Auteur de l'inspection — attribution en équipe co-propriétaire. */
  createdBy: zId.nullable().optional(),
  author: z.string().nullable().optional(),
});
export type Inspection = z.infer<typeof zInspection>;

/**
 * Résumé IA d'une inspection — §12.
 * Sépare explicitement données enregistrées / observations IA / recommandations IA.
 */
export const zInspectionAiSummary = z.object({
  level: z.enum(SEVERITY),
  recorded: z.record(z.string(), z.unknown()),
  aiObservations: z.array(
    z.object({
      observation: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
      toVerify: z.string().nullable(),
    }),
  ),
  recommendations: z.array(z.string()),
  watchPoints: z.array(z.string()),
});
export type InspectionAiSummary = z.infer<typeof zInspectionAiSummary>;
