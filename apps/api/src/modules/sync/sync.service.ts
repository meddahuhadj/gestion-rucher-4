import {
  zApiaryCreate,
  zHarvestCreate,
  zHiveCreate,
  zHiveUpdate,
  zInspectionCreate,
  zInspectionUpdate,
  zQueenCreate,
  zTaskCreate,
  zTaskUpdate,
  type SyncBatchResponse,
  type SyncOperation,
  type SyncableEntity,
} from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { apiariesService } from "../apiaries/apiaries.service.js";
import { harvestsService } from "../harvests/harvests.service.js";
import { hivesService } from "../hives/hives.service.js";
import { inspectionsService } from "../inspections/inspections.service.js";
import { queensService } from "../queens/queens.service.js";
import { tasksService } from "../tasks/tasks.service.js";

/**
 * Accès générique à un delegate Prisma par nom d'entité. Les modèles Prisma
 * portent exactement les mêmes noms que `SyncableEntity` (apiary, hive, …) et
 * partagent la forme { id, version, ownerId, clientUuid }.
 */
type MiniDelegate = {
  findFirst(args: {
    where: Record<string, unknown>;
    select: Record<string, boolean>;
  }): Promise<Record<string, unknown> | null>;
};
const delegateOf = (entity: SyncableEntity): MiniDelegate =>
  (prisma as unknown as Record<string, MiniDelegate>)[entity]!;

async function findByClientUuid(entity: SyncableEntity, clientUuid: string) {
  const row = await delegateOf(entity).findFirst({
    where: { clientUuid, deletedAt: null },
    select: { id: true, version: true },
  });
  return row as { id: string; version: number } | null;
}

async function currentVersion(entity: SyncableEntity, id: string) {
  const row = await delegateOf(entity).findFirst({
    where: { id },
    select: { id: true, version: true, ownerId: true },
  });
  return row as { id: string; version: number; ownerId: string } | null;
}

async function applyCreate(
  ctx: AuthUser,
  entity: SyncableEntity,
  payload: Record<string, unknown>,
): Promise<{ id: string; version: number }> {
  switch (entity) {
    case "apiary": {
      const r = await apiariesService.create(ctx, zApiaryCreate.parse(payload));
      return { id: r.id, version: r.version };
    }
    case "hive": {
      const r = await hivesService.create(ctx, zHiveCreate.parse(payload));
      return { id: r.id, version: r.version };
    }
    case "inspection": {
      const r = await inspectionsService.create(
        ctx,
        zInspectionCreate.parse(payload),
        "sync",
      );
      return { id: r.id, version: r.version };
    }
    case "task": {
      const r = await tasksService.create(ctx, zTaskCreate.parse(payload), "sync");
      return { id: r.id, version: r.version };
    }
    case "harvest": {
      const r = await harvestsService.create(ctx, zHarvestCreate.parse(payload), "sync");
      return { id: r.id, version: r.version };
    }
    case "queen": {
      const r = await queensService.create(ctx, zQueenCreate.parse(payload), "sync");
      return { id: r.id, version: r.version };
    }
    default:
      throw new Error(`création hors-ligne non prise en charge pour « ${entity} »`);
  }
}

async function applyUpdate(
  ctx: AuthUser,
  entity: SyncableEntity,
  id: string,
  payload: Record<string, unknown>,
): Promise<{ id: string; version: number }> {
  switch (entity) {
    case "hive": {
      const r = await hivesService.update(ctx, id, zHiveUpdate.parse(payload));
      return { id: r.id, version: r.version };
    }
    case "inspection": {
      const r = await inspectionsService.update(ctx, id, zInspectionUpdate.parse(payload));
      return { id: r.id, version: r.version };
    }
    case "task": {
      const r = await tasksService.update(ctx, id, zTaskUpdate.parse(payload));
      return { id: r.id, version: r.version };
    }
    default:
      throw new Error(`mise à jour hors-ligne non prise en charge pour « ${entity} »`);
  }
}

export const syncService = {
  /**
   * Applique un lot d'opérations hors-ligne — §16.
   * Idempotent via `clientUuid` ; détection de conflit par `baseVersion`.
   * Ordonné par `seq` (dépendances de clés étrangères résolues côté client).
   */
  async batch(
    ctx: AuthUser,
    deviceId: string,
    ops: SyncOperation[],
  ): Promise<SyncBatchResponse> {
    const res: SyncBatchResponse = {
      applied: [],
      conflicts: [],
      failed: [],
      serverChanges: [],
    };
    const sorted = [...ops].sort((a, b) => a.seq - b.seq);

    for (const op of sorted) {
      try {
        // idempotence : déjà appliqué ?
        const existing = await findByClientUuid(op.entity, op.clientUuid);
        if (existing) {
          res.applied.push({
            clientUuid: op.clientUuid,
            id: existing.id,
            version: existing.version,
          });
          continue;
        }

        if (op.op === "create") {
          const r = await applyCreate(ctx, op.entity, {
            ...op.payload,
            clientUuid: op.clientUuid,
          });
          res.applied.push({ clientUuid: op.clientUuid, id: r.id, version: r.version });
        } else if (op.op === "update") {
          const targetId = String(op.payload.id ?? "");
          const cur = targetId ? await currentVersion(op.entity, targetId) : null;
          if (!cur || cur.ownerId !== ctx.dataOwnerId) {
            res.failed.push({
              clientUuid: op.clientUuid,
              code: "not_found",
              message: "cible introuvable",
            });
            continue;
          }
          if (op.baseVersion != null && cur.version !== op.baseVersion) {
            res.conflicts.push({
              clientUuid: op.clientUuid,
              entity: op.entity,
              local: op.payload,
              server: { id: cur.id, version: cur.version },
            });
            continue;
          }
          const r = await applyUpdate(ctx, op.entity, targetId, op.payload);
          res.applied.push({ clientUuid: op.clientUuid, id: r.id, version: r.version });
        } else {
          res.failed.push({
            clientUuid: op.clientUuid,
            code: "unsupported",
            message: "suppression hors-ligne non prise en charge",
          });
        }

        await prisma.syncOperation.upsert({
          where: { clientUuid_entity: { clientUuid: op.clientUuid, entity: op.entity } },
          create: {
            ownerId: ctx.dataOwnerId,
            clientUuid: op.clientUuid,
            entity: op.entity,
            op: op.op,
            payload: JSON.parse(JSON.stringify(op.payload)),
            baseVersion: op.baseVersion,
            deviceId,
            status: "applied",
            appliedAt: new Date(),
          },
          update: { status: "applied", appliedAt: new Date() },
        });
      } catch (err) {
        res.failed.push({
          clientUuid: op.clientUuid,
          code: "apply_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return res;
  },

  /** Deltas depuis un curseur temporel — pour réhydrater le cache local. */
  async changes(ctx: AuthUser, since?: string) {
    const gt = since ? new Date(since) : new Date(0);
    const where = { ownerId: ctx.dataOwnerId, updatedAt: { gt } };
    const pick = { id: true, version: true, updatedAt: true, deletedAt: true };

    const [apiaries, hives, inspections, tasks, harvests] = await Promise.all([
      prisma.apiary.findMany({ where, select: pick }),
      prisma.hive.findMany({ where, select: pick }),
      prisma.inspection.findMany({ where, select: pick }),
      prisma.task.findMany({ where, select: pick }),
      prisma.harvest.findMany({ where, select: pick }),
    ]);

    const map = (
      entity: SyncableEntity,
      rows: { id: string; version: number; updatedAt: Date; deletedAt: Date | null }[],
    ) =>
      rows.map((r) => ({
        entity,
        id: r.id,
        version: r.version,
        updatedAt: r.updatedAt.toISOString(),
        deleted: r.deletedAt != null,
      }));

    return {
      now: new Date().toISOString(),
      changes: [
        ...map("apiary", apiaries),
        ...map("hive", hives),
        ...map("inspection", inspections),
        ...map("task", tasks),
        ...map("harvest", harvests),
      ],
    };
  },
};
