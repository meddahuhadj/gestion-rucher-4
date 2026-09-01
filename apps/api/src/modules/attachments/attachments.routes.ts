import type { FastifyPluginAsync } from "fastify";
import { zId, zUploadRequest } from "@moumen/shared";
import { attachmentsService } from "./attachments.service.js";

export const attachmentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // demande d'URL d'upload signée
  fastify.post("/", async (req, reply) => {
    const body = zUploadRequest.parse(req.body);
    reply.code(201);
    return attachmentsService.createUploadTicket(req.user, body);
  });

  // métadonnées + URL signée de lecture
  fastify.get("/:id", async (req) => {
    const id = zId.parse((req.params as { id: string }).id);
    return attachmentsService.get(req.user, id);
  });
};
