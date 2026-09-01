import Dexie, { type Table } from "dexie";
import type { SyncableEntity } from "@moumen/shared";

/**
 * Base locale (IndexedDB) — §15.
 * `outbox` = file d'opérations différées (source de vérité tant que non synchro).
 * Une inspection enregistrée ici n'est jamais perdue : elle reste jusqu'à
 * confirmation serveur.
 */
export type OutboxRow = {
  id?: number;
  clientUuid: string;
  entity: SyncableEntity;
  op: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  baseVersion: number | null;
  seq: number;
  createdAt: number;
  tries: number;
  lastError?: string;
  status: "pending" | "syncing" | "failed";
};

export type MetaRow = { key: string; value: string };

class MoumenDB extends Dexie {
  outbox!: Table<OutboxRow, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("moumen");
    this.version(1).stores({
      outbox: "++id, clientUuid, entity, status, seq",
      meta: "key",
    });
  }
}

export const db = new MoumenDB();

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.meta.get(key);
  return row?.value ?? null;
}
export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}
