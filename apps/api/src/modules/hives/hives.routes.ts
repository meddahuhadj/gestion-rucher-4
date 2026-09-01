import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  zHiveCreate,
  zHiveListQuery,
  zHiveUpdate,
  zId,
} from "@moumen/shared";
import { hivesService } from "./hives.service.js";

const zArchiveBody = z.object({ reason: z.string().min(1).max(400) });

export const hivesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (req) => {
    const q = zHiveListQuery.parse(req.query);
    return { data: await hivesService.list(req.user, q) };
  });

  fastify.get("/counts", async (req) => hivesService.counts(req.user));

  fastify.get("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    return hivesService.get(req.user, id);
  });

  fastify.post("/", async (req, reply) => {
    const body = zHiveCreate.parse(req.body);
    reply.code(201);
    return hivesService.create(req.user, body);
  });

  fastify.patch("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    const body = zHiveUpdate.parse(req.body);
    return hivesService.update(req.user, id, body);
  });

  fastify.post("/:id/archive", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    const { reason } = zArchiveBody.parse(req.body);
    return hivesService.archive(req.user, id, reason);
  });
};
