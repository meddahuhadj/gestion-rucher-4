import { z } from "zod";

/** Identifiant UUID. */
export const zId = z.string().uuid();

/** UUID généré par le client pour l'idempotence de la synchro offline — §16. */
export const zClientUuid = z.string().uuid();

/** Champs communs renvoyés par l'API pour toute entité. */
export const zEntityMeta = z.object({
  id: zId,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  version: z.number().int().nonnegative(),
});
export type EntityMeta = z.infer<typeof zEntityMeta>;

/** Pagination par curseur. */
export const zCursorQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type CursorQuery = z.infer<typeof zCursorQuery>;

export type Paginated<T> = {
  data: T[];
  nextCursor: string | null;
};

/** Enveloppe d'erreur normalisée de l'API. */
export type ApiError = {
  error: {
    code: string;
    message: string;
    /** clé i18n optionnelle pour un rendu localisé côté client */
    i18nKey?: string;
    details?: unknown;
  };
};

/** Fenêtre temporelle pour les filtres finance / analytics — §18. */
export const zDateRange = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  preset: z
    .enum(["day", "week", "month", "year", "custom"])
    .optional()
    .default("month"),
});
export type DateRange = z.infer<typeof zDateRange>;
