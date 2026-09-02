import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  zChatRequest,
  zConfirmActionRequest,
  zVisionAnalyzeRequest,
  LOCALES,
  zId,
  type ChatDelta,
} from "@moumen/shared";
import { config } from "../../config.js";
import { prisma } from "../../core/db.js";
import { aiProvider } from "../../ai/provider/index.js";
import { runChat } from "../../ai/orchestrator/orchestrator.js";
import { proposeAction, takeAction } from "../../ai/orchestrator/pendingActions.js";
import { toolByName, voiceToolSchemas } from "../../ai/tools/registry.js";
import { analyzeAttachment } from "../../ai/vision/analyze.js";
import { writeAudit } from "../../core/audit.js";
import { AppError } from "../../core/errors.js";

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/status", async () => {
    const p = aiProvider();
    const ready = p.isReady() ? "ready" : "unconfigured";
    return { provider: p.name, chat: ready, voice: ready, vision: ready };
  });

  // ── MOUMEN VOICE (§6) : jeton éphémère + schémas d'outils + persistance ──

  // Le navigateur se connecte ensuite directement au Live API avec ce jeton.
  fastify.post(
    "/voice/token",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) => {
      const tok = await aiProvider().createRealtimeToken("voice");
      // L'audit ne doit pas faire échouer l'émission du jeton.
      try {
        await writeAudit({
          actorId: req.user.id,
          action: "ai.voice.token",
          entity: "conversation_session",
          via: "ai",
        });
      } catch (err) {
        req.log.warn({ err }, "writeAudit ai.voice.token a échoué (ignoré)");
      }
      let tools: ReturnType<typeof voiceToolSchemas> = [];
      try {
        tools = voiceToolSchemas();
      } catch (err) {
        req.log.warn({ err }, "voiceToolSchemas a échoué (jeton renvoyé sans outils)");
      }
      return { ...tok, apiVersion: "v1alpha", tools };
    },
  );

  // Exécution d'un outil demandé par le modèle pendant la session vocale.
  // Niveau 1 : exécuté. Niveau 2/3 : proposé (le client affiche une confirmation).
  fastify.post(
    "/tools/run",
    { config: { rateLimit: { max: config.RATE_LIMIT_AI_PER_MIN, timeWindow: "1 minute" } } },
    async (req) => {
      const { tool: name, args } = z
        .object({ tool: z.string(), args: z.record(z.string(), z.unknown()).default({}) })
        .parse(req.body);
      const tool = toolByName.get(name);
      if (!tool) throw new AppError("bad_request", `Outil inconnu : ${name}`);

      let parsed: unknown;
      try {
        parsed = tool.validate(args);
      } catch (err) {
        return { ok: false, error: "paramètres invalides", details: String(err) };
      }

      if (tool.level === 1) {
        const data = await tool.run(parsed, req.user);
        return { ok: true, data };
      }

      const summary = tool.summarize(parsed as Record<string, unknown>);
      const { token, expiresAt } = proposeAction({
        userId: req.user.id,
        tool: tool.name,
        level: tool.level,
        args: parsed as Record<string, unknown>,
        summary,
      });
      return {
        ok: false,
        pendingConfirmation: true,
        proposal: { actionToken: token, tool: tool.name, level: tool.level, summary, args: parsed, expiresAt },
      };
    },
  );

  // Persistance du transcript en fin de session vocale (§6).
  fastify.post("/voice/session", async (req) => {
    const body = z
      .object({
        locale: z.enum(LOCALES).optional(),
        page: z.string().max(80).optional(),
        startedAt: z.string().datetime().optional(),
        endedAt: z.string().datetime().optional(),
        durationS: z.number().int().nonnegative().optional(),
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant", "tool"]),
              content: z.string().max(20000),
              toolName: z.string().optional(),
            }),
          )
          .max(400)
          .default([]),
      })
      .parse(req.body);

    const session = await prisma.conversationSession.create({
      data: {
        ownerId: req.user.dataOwnerId,
        channel: "voice",
        locale: body.locale ?? "fr",
        page: body.page ?? null,
        startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
        endedAt: body.endedAt ? new Date(body.endedAt) : new Date(),
        durationS: body.durationS ?? null,
        messages: {
          create: body.messages.map((m) => ({
            role: m.role,
            content: m.content,
            toolName: m.toolName ?? null,
          })),
        },
      },
    });
    return { sessionId: session.id, saved: body.messages.length };
  });

  // ── historique de conversation (reprise côté client) ──
  fastify.get("/history", async (req) => {
    const { sessionId, limit, before } = z
      .object({
        sessionId: zId,
        limit: z.coerce.number().int().min(1).max(50).default(30),
        before: z.string().datetime().optional(),
      })
      .parse(req.query);

    const session = await prisma.conversationSession.findFirst({
      where: { id: sessionId, ownerId: req.user.dataOwnerId },
    });
    if (!session) throw new AppError("not_found", "Session introuvable", { i18nKey: "error.not_found" });

    const messages = await prisma.conversationMessage.findMany({
      where: { sessionId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return {
      session: { id: session.id, startedAt: session.startedAt, locale: session.locale },
      messages: messages.reverse().map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolName: m.toolName,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });

  // ── conversation MOUMEN — flux SSE (§8/§12) ──
  fastify.post(
    "/chat",
    {
      config: {
        rateLimit: { max: config.RATE_LIMIT_AI_PER_MIN, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const body = zChatRequest.parse(req.body);

      // `reply.raw.writeHead` court-circuite le hook onSend de @fastify/cors :
      // on réinjecte donc CORS (+ anti-buffering) à la main pour le flux SSE.
      const origin = req.headers.origin;
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
        ...(origin
          ? {
              "access-control-allow-origin": origin,
              "access-control-allow-credentials": "true",
              vary: "Origin",
            }
          : {}),
      });
      const send = (d: ChatDelta) => {
        reply.raw.write(`data: ${JSON.stringify(d)}\n\n`);
      };

      const ac = new AbortController();
      req.raw.on("close", () => ac.abort());

      // heartbeat : commentaire SSE périodique pour éviter la fermeture
      // des connexions par les proxies/load-balancers sur les flux longs.
      const heartbeat = setInterval(
        () => {
          if (!reply.raw.writableEnded) reply.raw.write(": keepalive\n\n");
        },
        15000,
      );
      const clearHeartbeat = () => clearInterval(heartbeat);

      try {
        await runChat(req.user, body, send, ac.signal);
      } catch (err) {
        req.log.error({ err }, "ai chat failed");
        send({
          type: "error",
          code: err instanceof AppError ? err.code : "internal",
          message: err instanceof AppError ? err.message : "Erreur de l'assistant",
        });
      } finally {
        clearHeartbeat();
        reply.raw.end();
      }
    },
  );

  // ── analyse visuelle prudente — MOUMEN VISION (§7) ──
  fastify.post(
    "/vision/analyze",
    {
      config: {
        rateLimit: { max: config.RATE_LIMIT_AI_PER_MIN, timeWindow: "1 minute" },
      },
    },
    async (req) => {
      const body = zVisionAnalyzeRequest.parse(req.body);
      return analyzeAttachment(req.user, body);
    },
  );

  // ── exécution d'une action proposée, après confirmation (§23) ──
  fastify.post("/actions/confirm", async (req) => {
    const { actionToken } = zConfirmActionRequest.parse(req.body);
    const pending = takeAction(actionToken, req.user.id);
    if (!pending) {
      throw new AppError("not_found", "Action introuvable ou expirée", {
        i18nKey: "error.not_found",
      });
    }
    const tool = toolByName.get(pending.tool);
    if (!tool) throw new AppError("bad_request", "Outil inconnu");

    const result = await tool.run(pending.args, req.user);
    await writeAudit({
      actorId: req.user.id,
      action: `ai.confirm.${pending.tool}`,
      entity: pending.tool,
      via: "ai",
      after: { args: pending.args, level: pending.level },
    });
    return { ok: true, tool: pending.tool, result };
  });
};
