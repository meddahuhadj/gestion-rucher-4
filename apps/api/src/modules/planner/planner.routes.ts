import type { FastifyPluginAsync } from "fastify";
import { zPlannerRequest } from "@moumen/shared";
import { plannerService } from "./planner.service.js";

export const plannerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // Renvoie un planning PROPOSÉ — rien n'est enregistré (§14).
  fastify.post("/generate", async (req) => {
    const body = zPlannerRequest.parse(req.body ?? {});
    return plannerService.generate(req.user, body);
  });
};
