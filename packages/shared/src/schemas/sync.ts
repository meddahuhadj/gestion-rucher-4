import { z } from "zod";
import { zClientUuid } from "../common.js";
import { SYNC_OP } from "../enums.js";

/** Entités synchronisables hors-ligne — §15/§16. */
export const SYNCABLE_ENTITIES = [
  "apiary",
  "hive",
  "inspection",
  "task",
  "queen",
  "harvest",
  "attachment",
] as const;
export type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];

export const zSyncOperation = z.object({
  clientUuid: zClientUuid,
  entity: z.enum(SYNCABLE_ENTITIES),
  op: z.enum(SYNC_OP),
  payload: z.record(z.string(), z.unknown()),
  baseVersion: z.number().int().nonnegative().nullable(),
  deviceId: z.string().max(120),
  /** ordre local, respecte les dépendances de clés étrangères */
  seq: z.number().int().nonnegative(),
});
export type SyncOperation = z.infer<typeof zSyncOperation>;

export const zSyncBatchRequest = z.object({
  deviceId: z.string().max(120),
  operations: z.array(zSyncOperation).min(1).max(200),
});
export type SyncBatchRequest = z.infer<typeof zSyncBatchRequest>;

export const zSyncConflict = z.object({
  clientUuid: zClientUuid,
  entity: z.enum(SYNCABLE_ENTITIES),
  local: z.record(z.string(), z.unknown()),
  server: z.record(z.string(), z.unknown()),
});
export type SyncConflict = z.infer<typeof zSyncConflict>;

export type SyncBatchResponse = {
  applied: { clientUuid: string; id: string; version: number }[];
  conflicts: SyncConflict[];
  failed: { clientUuid: string; code: string; message: string }[];
  serverChanges: { entity: SyncableEntity; id: string; version: number }[];
};

export const zSyncChangesQuery = z.object({
  since: z.string().datetime().optional(),
});
export type SyncChangesQuery = z.infer<typeof zSyncChangesQuery>;
