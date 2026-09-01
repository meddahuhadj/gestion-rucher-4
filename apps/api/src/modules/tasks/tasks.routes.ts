import type { FastifyPluginAsync } from "fastify";
import { zId, zTaskCreate, zTaskListQuery, zTaskUpdate } from "@moumen/shared";
import { tasksService } from "./tasks.service.js";

export const tasksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (req) => {
    const q = zTaskListQuery.parse(req.query);
    return { data: await tasksService.list(req.user, q) };
  });

  fastify.post("/", async (req, reply) => {
    const body = zTaskCreate.parse(req.body);
    reply.code(201);
    return tasksService.create(req.user, body);
  });

  fastify.patch("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    const body = zTaskUpdate.parse(req.body);
    return tasksService.update(req.user, id, body);
  });

  fastify.post("/:id/complete", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    return tasksService.complete(req.user, id);
  });
};
