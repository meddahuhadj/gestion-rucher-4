import { z } from "zod";
import { zClientUuid, zEntityMeta, zId } from "../common.js";

export const zApiaryCreate = z.object({
  name: z.string().min(1).max(120),
  location: z.string().max(240).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  notes: z.string().max(4000).optional(),
  photoAttachmentId: zId.optional(),
  clientUuid: zClientUuid.optional(),
});
export type ApiaryCreate = z.infer<typeof zApiaryCreate>;

export const zApiaryUpdate = zApiaryCreate
  .partial()
  .omit({ clientUuid: true })
  .extend({ photoAttachmentId: zId.nullable().optional() });
export type ApiaryUpdate = z.infer<typeof zApiaryUpdate>;

export const zApiary = zEntityMeta.extend({
  name: z.string(),
  location: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  notes: z.string().nullable(),
  photoAttachmentId: zId.nullable(),
  hiveCount: z.number().int().nonnegative().optional(),
});
export type Apiary = z.infer<typeof zApiary>;
