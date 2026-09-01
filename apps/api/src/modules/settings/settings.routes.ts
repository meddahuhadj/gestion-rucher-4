import type { FastifyPluginAsync } from "fastify";
import { zSettingsUpdate } from "@moumen/shared";
import { settingsService } from "./settings.service.js";

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (req) => settingsService.get(req.user));

  fastify.patch("/", async (req) => {
    const body = zSettingsUpdate.parse(req.body);
    return settingsService.update(req.user, body);
  });
};
