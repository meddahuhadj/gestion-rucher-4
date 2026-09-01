import type { FastifyPluginAsync } from "fastify";
import { zId, zQueenCreate, zQueenListQuery, zQueenUpdate } from "@moumen/shared";
import { queensService } from "./queens.service.js";

export const queensRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (req) => {
    const q = zQueenListQuery.parse(req.query);
    return { data: await queensService.list(req.user, q) };
  });

  fastify.get("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    return queensService.get(req.user, id);
  });

  fastify.post("/", async (req, reply) => {
    const body = zQueenCreate.parse(req.body);
    reply.code(201);
    return queensService.create(req.user, body);
  });

  fastify.patch("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    const body = zQueenUpdate.parse(req.body);
    return queensService.update(req.user, id, body);
  });
};
