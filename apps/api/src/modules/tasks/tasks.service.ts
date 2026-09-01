import type { Task as TaskRow } from "@prisma/client";
import type { TaskCreate, TaskListQuery, TaskUpdate } from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { forbidden, notFound } from "../../core/errors.js";
import { resolveAuthors } from "../../core/users.js";

const serialize = (t: TaskRow) => ({
  id: t.id,
  createdBy: t.createdBy,
  completedBy: t.completedBy,
  title: t.title,
  type: t.type,
  hiveId: t.hiveId,
  apiaryId: t.apiaryId,
  priority: t.priority,
  status: t.status,
  dueAt: t.dueAt?.toISOString() ?? null,
  reminderAt: t.reminderAt?.toISOString() ?? null,
  completedAt: t.completedAt?.toISOString() ?? null,
  notes: t.notes,
  version: t.version,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
  deletedAt: t.deletedAt?.toISOString() ?? null,
});

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const tasksService = {
  async list(ctx: AuthUser, q: TaskListQuery) {
    const now = new Date();
    const where = {
      ownerId: ctx.dataOwnerId,
      deletedAt: null,
      ...(q.hiveId ? { hiveId: q.hiveId } : {}),
      ...(q.status ? { status: q.status } : {}),
    } as Record<string, unknown>;

    if (q.scope === "overdue") {
      where.status = { in: ["todo", "doing"] };
      where.dueAt = { lt: startOfToday() };
    } else if (q.scope === "today") {
      const end = new Date(startOfToday().getTime() + 86_400_000);
      where.status = { in: ["todo", "doing"] };
      where.dueAt = { gte: startOfToday(), lt: end };
    } else if (q.scope === "week") {
      const end = new Date(startOfToday().getTime() + 7 * 86_400_000);
      where.status = { in: ["todo", "doing"] };
      where.dueAt = { gte: startOfToday(), lt: end };
    }
    void now;

    const rows = await prisma.task.findMany({
      where: where as never,
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      take: 300,
    });
    const authors = await resolveAuthors(
      rows.flatMap((r) => [r.createdBy, r.completedBy]),
    );
    return rows.map((r) => ({
      ...serialize(r),
      author: authors.get(r.createdBy) ?? null,
      completedByName: r.completedBy ? (authors.get(r.completedBy) ?? null) : null,
    }));
  },

  async create(ctx: AuthUser, input: TaskCreate, via: "ui" | "ai" | "sync" = "ui") {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          ownerId: ctx.dataOwnerId,
          createdBy: ctx.id,
          title: input.title,
          type: input.type,
          hiveId: input.hiveId ?? null,
          apiaryId: input.apiaryId ?? null,
          priority: input.priority,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
          recurrence: input.recurrence ?? undefined,
          notes: input.notes ?? null,
          clientUuid: input.clientUuid ?? null,
        },
      });
      await writeAudit(
        {
          actorId: ctx.id,
          action: "task.create",
          entity: "task",
          entityId: created.id,
          after: created,
          via,
        },
        tx,
      );
      return created;
    });
    return serialize(row);
  },

  async update(ctx: AuthUser, id: string, input: TaskUpdate) {
    const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Tâche", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();

    const row = await prisma.task.update({
      where: { id },
      data: {
        title: input.title ?? undefined,
        type: input.type ?? undefined,
        priority: input.priority ?? undefined,
        status: input.status ?? undefined,
        dueAt:
          input.dueAt === undefined
            ? undefined
            : input.dueAt
              ? new Date(input.dueAt)
              : null,
        notes: input.notes === undefined ? undefined : input.notes,
        version: { increment: 1 },
      },
    });
    return serialize(row);
  },

  async complete(ctx: AuthUser, id: string) {
    const existing = await prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Tâche", id);
    if (existing.ownerId !== ctx.dataOwnerId) throw forbidden();
    const row = await prisma.task.update({
      where: { id },
      data: {
        status: "done",
        completedAt: new Date(),
        completedBy: ctx.id,
        version: { increment: 1 },
      },
    });
    return serialize(row);
  },
};
