import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  zHarvestCreate,
  zHarvestListQuery,
  zHarvestUpdate,
  zId,
} from "@moumen/shared";
import { harvestsService } from "./harvests.service.js";

const zStatsQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const harvestsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (req) => {
    const q = zHarvestListQuery.parse(req.query);
    return { data: await harvestsService.list(req.user, q) };
  });

  fastify.get("/stats", async (req) => {
    const q = zStatsQuery.parse(req.query);
    return harvestsService.stats(req.user, q.from, q.to);
  });

  fastify.post("/", async (req, reply) => {
    const body = zHarvestCreate.parse(req.body);
    reply.code(201);
    return harvestsService.create(req.user, body);
  });

  fastify.patch("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    const body = zHarvestUpdate.parse(req.body);
    return harvestsService.update(req.user, id, body);
  });
};
