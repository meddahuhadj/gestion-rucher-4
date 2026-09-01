import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

type AuditInput = {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  via?: "ui" | "ai" | "sync" | "job";
  ip?: string | null;
};

/**
 * Écrit une entrée d'audit — §14/§63.
 * À appeler dans la MÊME transaction que l'écriture métier lorsque c'est possible :
 * passer `tx` (client de transaction) au lieu du client global.
 */
export async function writeAudit(
  input: AuditInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      via: input.via ?? "ui",
      ip: input.ip ?? null,
    },
  });
}
