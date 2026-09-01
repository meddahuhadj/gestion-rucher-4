import { z } from "zod";
import { zClientUuid, zEntityMeta, zId } from "../common.js";
import { QUEEN_QUALITY, QUEEN_STATUS } from "../enums.js";

export const zQueenCreate = z.object({
  hiveId: zId.nullable().optional(),
  introducedAt: z.string().date().optional(),
  origin: z.string().max(120).optional(),
  strain: z.string().max(120).optional(),
  birthYear: z.number().int().min(2000).max(2100).optional(),
  quality: z.enum(QUEEN_QUALITY).optional(),
  status: z.enum(QUEEN_STATUS).default("active"),
  notes: z.string().max(2000).optional(),
  /** si true et hiveId fourni : devient la reine courante de la ruche */
  setAsCurrent: z.boolean().default(true),
  clientUuid: zClientUuid.optional(),
});
export type QueenCreate = z.infer<typeof zQueenCreate>;

export const zQueenUpdate = z.object({
  hiveId: zId.nullable().optional(),
  origin: z.string().max(120).nullable().optional(),
  strain: z.string().max(120).nullable().optional(),
  birthYear: z.number().int().min(2000).max(2100).nullable().optional(),
  quality: z.enum(QUEEN_QUALITY).nullable().optional(),
  status: z.enum(QUEEN_STATUS).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type QueenUpdate = z.infer<typeof zQueenUpdate>;

export const zQueenListQuery = z.object({
  hiveId: zId.optional(),
  status: z.enum(QUEEN_STATUS).optional(),
  /** reines dont l'année de naissance est <= (année courante - olderThanYears) */
  olderThanYears: z.coerce.number().int().min(1).max(10).optional(),
});
export type QueenListQuery = z.infer<typeof zQueenListQuery>;

export const zQueen = zEntityMeta.extend({
  hiveId: zId.nullable(),
  introducedAt: z.string().nullable(),
  origin: z.string().nullable(),
  strain: z.string().nullable(),
  birthYear: z.number().int().nullable(),
  quality: z.enum(QUEEN_QUALITY).nullable(),
  status: z.enum(QUEEN_STATUS),
  notes: z.string().nullable(),
  ageYears: z.number().int().nullable(),
});
export type Queen = z.infer<typeof zQueen>;
