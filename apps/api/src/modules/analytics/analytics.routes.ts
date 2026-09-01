import type { FastifyPluginAsync } from "fastify";
import { analyticsService } from "./analytics.service.js";

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/overview", async (req) => analyticsService.overview(req.user));
};
