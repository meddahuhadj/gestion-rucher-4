import { z } from "zod";
import { zId } from "../common.js";
import { AI_CHANNEL, AI_CONFIDENCE, LOCALES } from "../enums.js";

/**
 * Snapshot de contexte construit par le Context Engine — §10.
 * Le client fournit page / rucher / ruche courants ; le serveur complète le reste.
 */
export const zContextSnapshot = z.object({
  page: z.string().max(80).optional(),
  currentApiaryId: zId.nullable().optional(),
  currentHiveId: zId.nullable().optional(),
  currentInspectionId: zId.nullable().optional(),
});
export type ContextSnapshot = z.infer<typeof zContextSnapshot>;

export const zChatAttachment = z.object({
  attachmentId: zId,
  kind: z.enum(["image", "audio"]),
});

export const zChatRequest = z.object({
  sessionId: zId.nullable().optional(),
  channel: z.enum(AI_CHANNEL).default("chat"),
  locale: z.enum(LOCALES).optional(),
  message: z.string().min(1).max(4000),
  attachments: z.array(zChatAttachment).max(6).optional(),
  context: zContextSnapshot.optional(),
});
export type ChatRequest = z.infer<typeof zChatRequest>;

/**
 * Proposition d'action émise par l'orchestrateur pour les niveaux 2 et 3 — §8/§23.
 * Le client doit rappeler /ai/actions/confirm avec le token pour exécuter.
 */
export const zActionProposal = z.object({
  actionToken: z.string(),
  tool: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  summary: z.string(),
  args: z.record(z.string(), z.unknown()),
  expiresAt: z.string().datetime(),
});
export type ActionProposal = z.infer<typeof zActionProposal>;

/** Deltas de streaming SSE renvoyés par /ai/chat. */
export type ChatDelta =
  | { type: "text"; value: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; ok: boolean }
  | { type: "action_proposal"; proposal: ActionProposal }
  | { type: "done"; sessionId: string }
  | { type: "error"; code: string; message: string };

export const zConfirmActionRequest = z.object({
  actionToken: z.string(),
  confirm: z.literal(true),
});
export type ConfirmActionRequest = z.infer<typeof zConfirmActionRequest>;

/** Résultat d'analyse visuelle — §7. Jamais affirmatif. */
export const zVisionResult = z.object({
  subject: z.string(),
  observation: z.string(),
  confidence: z.enum(AI_CONFIDENCE),
  interpretation: z.string().nullable(),
  toVerify: z.string().nullable(),
  recommendation: z.string().nullable(),
});
export type VisionResult = z.infer<typeof zVisionResult>;

export const zVisionAnalyzeRequest = z.object({
  attachmentId: zId,
  hint: z.string().max(400).optional(),
  hiveId: zId.optional(),
  step: z
    .enum(["entrance", "frame", "brood", "queen", "stores"])
    .optional(),
});
export type VisionAnalyzeRequest = z.infer<typeof zVisionAnalyzeRequest>;
