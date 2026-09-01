import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../core/db.js";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  fastify.get("/health/db", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "up" };
    } catch {
      reply.code(503);
      return { status: "degraded", db: "down" };
    }
  });
};
