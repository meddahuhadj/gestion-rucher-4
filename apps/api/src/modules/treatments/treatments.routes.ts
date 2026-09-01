import type { FastifyPluginAsync } from "fastify";
import {
  zId,
  zTreatmentCreate,
  zTreatmentListQuery,
  zTreatmentUpdate,
} from "@moumen/shared";
import { treatmentsService } from "./treatments.service.js";

export const treatmentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (req) => {
    const q = zTreatmentListQuery.parse(req.query);
    return { data: await treatmentsService.list(req.user, q) };
  });

  fastify.post("/", async (req, reply) => {
    const body = zTreatmentCreate.parse(req.body);
    reply.code(201);
    return treatmentsService.create(req.user, body);
  });

  fastify.patch("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    const body = zTreatmentUpdate.parse(req.body);
    return treatmentsService.update(req.user, id, body);
  });
};
