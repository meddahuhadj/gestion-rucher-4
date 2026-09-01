/**
 * Énumérations métier partagées client / serveur.
 * Source de vérité unique — le schéma Prisma et les traductions i18n s'y réfèrent.
 */

export const LOCALES = ["ar", "fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const USER_ROLES = ["owner", "manager", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Statut d'une ruche — §9 du cahier des charges. */
export const HIVE_STATUS = [
  "active",
  "strong",
  "medium",
  "weak",
  "very_weak",
  "dead",
  "sold",
  "merged",
  "archived",
] as const;
export type HiveStatus = (typeof HIVE_STATUS)[number];

/** Statuts considérés comme "vivants" pour les compteurs et alertes. */
export const LIVE_HIVE_STATUS: readonly HiveStatus[] = [
  "active",
  "strong",
  "medium",
  "weak",
  "very_weak",
];

export const COLONY_STRENGTH = [
  "very_strong",
  "strong",
  "medium",
  "weak",
  "very_weak",
] as const;
export type ColonyStrength = (typeof COLONY_STRENGTH)[number];

export const LEVEL = ["none", "low", "medium", "high"] as const;
export type Level = (typeof LEVEL)[number];

export const LAYING_PATTERN = ["normal", "weak", "irregular"] as const;
export type LayingPattern = (typeof LAYING_PATTERN)[number];

export const BROOD_AMOUNT = ["none", "little", "moderate", "abundant"] as const;
export type BroodAmount = (typeof BROOD_AMOUNT)[number];

export const INSPECTION_METHOD = ["manual", "voice", "camera"] as const;
export type InspectionMethod = (typeof INSPECTION_METHOD)[number];

export const OBSERVATION_SOURCE = ["user", "voice", "ai"] as const;
export type ObservationSource = (typeof OBSERVATION_SOURCE)[number];

export const QUEEN_QUALITY = ["excellent", "good", "fair", "poor"] as const;
export type QueenQuality = (typeof QUEEN_QUALITY)[number];

export const QUEEN_STATUS = ["active", "replaced", "dead", "removed"] as const;
export type QueenStatus = (typeof QUEEN_STATUS)[number];

export const TREATMENT_TARGET = ["varroa", "nosema", "other"] as const;
export type TreatmentTarget = (typeof TREATMENT_TARGET)[number];

/** Types de travaux — §15. */
export const TASK_TYPE = [
  "inspection",
  "split",
  "feeding",
  "add_frame",
  "treatment",
  "queen_check",
  "queen_replace",
  "harvest",
  "transfer",
  "merge",
  "seasonal_prep",
  "custom",
] as const;
export type TaskType = (typeof TASK_TYPE)[number];

export const TASK_PRIORITY = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITY)[number];

export const TASK_STATUS = ["todo", "doing", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

export const EXPENSE_CATEGORY = [
  "feed",
  "treatment",
  "equipment",
  "hardware",
  "transport",
  "packaging",
  "rent",
  "labor",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORY)[number];

/** Catégories de pièces jointes — §27. */
export const ATTACHMENT_CATEGORY = [
  "hive",
  "frame",
  "queen",
  "brood",
  "entrance",
  "pest",
  "health",
  "stores",
  "equipment",
  "other",
] as const;
export type AttachmentCategory = (typeof ATTACHMENT_CATEGORY)[number];

/** Types d'alertes — §13. */
export const NOTIFICATION_KIND = [
  "inspection_overdue",
  "weak_hive",
  "no_queen",
  "unusual_trend",
  "urgent_task",
  "treatment_due",
  "harvest_due",
  "old_queen",
  "no_inspection",
  "recurring_issue",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KIND)[number];

/** Niveaux d'attention — §12 : 🟢 🟡 🟠 🔴 */
export const SEVERITY = ["normal", "watch", "attention", "urgent"] as const;
export type Severity = (typeof SEVERITY)[number];

export const AI_CONFIDENCE = ["low", "medium", "high"] as const;
export type AiConfidence = (typeof AI_CONFIDENCE)[number];

export const AI_CHANNEL = ["chat", "voice", "vision"] as const;
export type AiChannel = (typeof AI_CHANNEL)[number];

/** Niveau de confirmation d'un outil IA — §23. */
export const CONFIRM_LEVEL = [1, 2, 3] as const;
export type ConfirmLevel = (typeof CONFIRM_LEVEL)[number];

export const SYNC_OP = ["create", "update", "delete"] as const;
export type SyncOp = (typeof SYNC_OP)[number];

export const SYNC_STATUS = ["pending", "applied", "conflict", "failed"] as const;
export type SyncStatus = (typeof SYNC_STATUS)[number];

export const DEFAULT_CURRENCY = "DZD" as const;
