import type { FastifyPluginAsync } from "fastify";
import { zApiaryCreate, zApiaryUpdate, zId } from "@moumen/shared";
import { apiariesService } from "./apiaries.service.js";

export const apiariesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (req) => ({
    data: await apiariesService.list(req.user),
  }));

  fastify.get("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    return apiariesService.get(req.user, id);
  });

  fastify.post("/", async (req, reply) => {
    const body = zApiaryCreate.parse(req.body);
    reply.code(201);
    return apiariesService.create(req.user, body);
  });

  fastify.patch("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    const body = zApiaryUpdate.parse(req.body);
    return apiariesService.update(req.user, id, body);
  });

  fastify.delete("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    return apiariesService.remove(req.user, id);
  });
};
