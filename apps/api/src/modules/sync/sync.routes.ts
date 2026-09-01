import type { FastifyPluginAsync } from "fastify";
import { zSyncBatchRequest, zSyncChangesQuery } from "@moumen/shared";
import { syncService } from "./sync.service.js";

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/batch", async (req) => {
    const body = zSyncBatchRequest.parse(req.body);
    return syncService.batch(req.user, body.deviceId, body.operations);
  });

  fastify.get("/changes", async (req) => {
    const q = zSyncChangesQuery.parse(req.query);
    return syncService.changes(req.user, q.since);
  });
};
