import type {
  SyncableEntity,
  SyncBatchResponse,
  SyncOperation,
} from "@moumen/shared";
import { api } from "@/lib/api";
import { db, getMeta, setMeta, type OutboxRow } from "./db";
import { useNetwork } from "./network";

const DEVICE_KEY = "deviceId";

async function deviceId(): Promise<string> {
  let id = await getMeta(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    await setMeta(DEVICE_KEY, id);
  }
  return id;
}

let seqCounter = Date.now();

/**
 * Ajoute une opération à l'outbox. Renvoie le clientUuid (= id optimiste local).
 * §16 : idempotence garantie côté serveur par ce clientUuid.
 */
export async function enqueue(
  entity: SyncableEntity,
  op: OutboxRow["op"],
  payload: Record<string, unknown>,
  baseVersion: number | null = null,
): Promise<string> {
  const clientUuid = (payload.clientUuid as string) ?? crypto.randomUUID();
  await db.outbox.add({
    clientUuid,
    entity,
    op,
    payload: { ...payload, clientUuid },
    baseVersion,
    seq: seqCounter++,
    createdAt: Date.now(),
    tries: 0,
    status: "pending",
  });
  void flush();
  return clientUuid;
}

export async function pendingCount(): Promise<number> {
  return db.outbox.where("status").notEqual("syncing").count();
}

let flushing = false;

/** Vide l'outbox vers /sync/batch. Sans effet hors-ligne ou déjà en cours. */
export async function flush(): Promise<void> {
  if (flushing) return;
  if (!useNetwork.getState().online) return;

  const rows = await db.outbox.where("status").anyOf("pending", "failed").sortBy("seq");
  if (rows.length === 0) return;

  flushing = true;
  try {
    for (const r of rows) await db.outbox.update(r.id!, { status: "syncing" });

    const operations: SyncOperation[] = rows.map((r) => ({
      clientUuid: r.clientUuid,
      entity: r.entity,
      op: r.op,
      payload: r.payload,
      baseVersion: r.baseVersion,
      deviceId: "", // rempli ci-dessous
      seq: r.seq,
    }));
    const dev = await deviceId();
    for (const o of operations) o.deviceId = dev;

    const result = await api<SyncBatchResponse>("/sync/batch", {
      method: "POST",
      body: { deviceId: dev, operations },
    });

    const appliedUuids = new Set(result.applied.map((a) => a.clientUuid));
    const conflictUuids = new Set(result.conflicts.map((c) => c.clientUuid));
    const failedByUuid = new Map(result.failed.map((f) => [f.clientUuid, f.message]));

    for (const r of rows) {
      if (appliedUuids.has(r.clientUuid)) {
        await db.outbox.delete(r.id!);
      } else if (conflictUuids.has(r.clientUuid)) {
        await db.outbox.update(r.id!, {
          status: "failed",
          lastError: "conflit — version serveur plus récente",
        });
      } else if (failedByUuid.has(r.clientUuid)) {
        await db.outbox.update(r.id!, {
          status: "failed",
          tries: r.tries + 1,
          lastError: failedByUuid.get(r.clientUuid),
        });
      } else {
        await db.outbox.update(r.id!, { status: "pending" });
      }
    }
  } catch (err) {
    // réseau tombé en cours : on remet tout en pending pour un prochain essai
    const stuck = await db.outbox.where("status").equals("syncing").toArray();
    for (const r of stuck) {
      await db.outbox.update(r.id!, {
        status: "pending",
        tries: r.tries + 1,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  } finally {
    flushing = false;
  }
}

/** Récupère les deltas serveur depuis le dernier curseur (réhydratation). */
export async function pullChanges(): Promise<number> {
  if (!useNetwork.getState().online) return 0;
  const since = (await getMeta("changesCursor")) ?? undefined;
  const res = await api<{ now: string; changes: unknown[] }>("/sync/changes", {
    query: since ? { since } : {},
  });
  await setMeta("changesCursor", res.now);
  return res.changes.length;
}
