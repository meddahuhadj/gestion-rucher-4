import { z } from "zod";
import { LOCALES } from "../enums.js";

/**
 * Réglages utilisateur — §32/§38.
 * `thresholds` pilote le Knowledge Engine (alertes §13) ; `units`/`currency`
 * l'affichage. Persistés sur la ligne `users` (colonnes + blob `settings`).
 */

export const zThresholds = z.object({
  /** inspection en retard au-delà de N jours */
  inspectionOverdueDays: z.number().int().min(1).max(365).default(21),
  /** passe en « attention » au-delà de N jours */
  inspectionAttentionDays: z.number().int().min(1).max(365).default(30),
  /** ruche jamais inspectée signalée après N jours d'existence */
  neverInspectedDays: z.number().int().min(1).max(365).default(14),
  /** reine considérée vieille à partir de N ans */
  queenOldYears: z.number().int().min(1).max(10).default(3),
  /** tâche urgente signalée si échéance dans N jours */
  urgentTaskWithinDays: z.number().int().min(0).max(30).default(2),
});
export type Thresholds = z.infer<typeof zThresholds>;

export const DEFAULT_THRESHOLDS: Thresholds = zThresholds.parse({});

export const WEIGHT_UNITS = ["kg", "lb"] as const;
export const TEMP_UNITS = ["c", "f"] as const;

export const zUnits = z.object({
  weight: z.enum(WEIGHT_UNITS).default("kg"),
  temperature: z.enum(TEMP_UNITS).default("c"),
});
export type Units = z.infer<typeof zUnits>;

export const DEFAULT_UNITS: Units = zUnits.parse({});

/** Réponse de GET /settings — état complet résolu (défauts appliqués). */
export const zSettings = z.object({
  displayName: z.string().nullable(),
  locale: z.enum(LOCALES),
  currency: z.string().min(1).max(8),
  units: zUnits,
  thresholds: zThresholds,
});
export type Settings = z.infer<typeof zSettings>;

/** Corps de PATCH /settings — tout est optionnel, fusion partielle des seuils. */
export const zSettingsUpdate = z.object({
  displayName: z.string().max(120).nullable().optional(),
  locale: z.enum(LOCALES).optional(),
  currency: z.string().min(1).max(8).optional(),
  units: zUnits.partial().optional(),
  thresholds: zThresholds.partial().optional(),
});
export type SettingsUpdate = z.infer<typeof zSettingsUpdate>;
