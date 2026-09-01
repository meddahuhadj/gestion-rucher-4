import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { zId } from "@moumen/shared";
import { alertsService } from "./alerts.service.js";

export const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (req) => {
    const q = z.object({ unread: z.coerce.boolean().optional() }).parse(req.query);
    return { data: await alertsService.list(req.user, q.unread ?? false) };
  });

  fastify.post("/:id/read", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    return alertsService.markRead(req.user, id);
  });

  // Recalcul à la demande (en attendant un cron — §47 jobs).
  fastify.post("/scan", async (req) => alertsService.scan(req.user));
};
