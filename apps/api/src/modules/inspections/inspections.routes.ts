import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  zId,
  zInspectionCreate,
  zInspectionUpdate,
} from "@moumen/shared";
import { inspectionsService } from "./inspections.service.js";

const zListQuery = z.object({
  hiveId: zId,
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
const zHistoryQuery = z.object({
  hiveId: zId,
  rangeDays: z.coerce.number().int().min(1).max(365).default(90),
});

export const inspectionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (req) => {
    const q = zListQuery.parse(req.query);
    return { data: await inspectionsService.listByHive(req.user, q.hiveId, q.limit) };
  });

  fastify.get("/history", async (req) => {
    const q = zHistoryQuery.parse(req.query);
    return { data: await inspectionsService.history(req.user, q.hiveId, q.rangeDays) };
  });

  fastify.get("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    return inspectionsService.get(req.user, id);
  });

  fastify.post("/", async (req, reply) => {
    const body = zInspectionCreate.parse(req.body);
    reply.code(201);
    return inspectionsService.create(req.user, body);
  });

  fastify.patch("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    const body = zInspectionUpdate.parse(req.body);
    return inspectionsService.update(req.user, id, body);
  });
};
