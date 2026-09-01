import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { config } from "./config.js";
import { AppError } from "./core/errors.js";
import authPlugin from "./core/auth.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { apiariesRoutes } from "./modules/apiaries/apiaries.routes.js";
import { hivesRoutes } from "./modules/hives/hives.routes.js";
import { inspectionsRoutes } from "./modules/inspections/inspections.routes.js";
import { tasksRoutes } from "./modules/tasks/tasks.routes.js";
import { attachmentsRoutes } from "./modules/attachments/attachments.routes.js";
import { queensRoutes } from "./modules/queens/queens.routes.js";
import { treatmentsRoutes } from "./modules/treatments/treatments.routes.js";
import { harvestsRoutes } from "./modules/harvests/harvests.routes.js";
import { financeRoutes } from "./modules/finance/finance.routes.js";
import { alertsRoutes } from "./modules/alerts/alerts.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { plannerRoutes } from "./modules/planner/planner.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";
import { settingsRoutes } from "./modules/settings/settings.routes.js";
import { syncRoutes } from "./modules/sync/sync.routes.js";
import { aiRoutes } from "./modules/ai/ai.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.isProd
        ? undefined
        : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    trustProxy: true,
    bodyLimit: 5 * 1024 * 1024,
  });

  // API et front vivent sur des origines distinctes (4000 / 5173, puis domaines
  // séparés en prod) : CORP "same-origin" bloquerait la lecture cross-origin
  // même avec un CORS valide. Le contrôle d'accès repose sur @fastify/cors.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  await app.register(cors, { origin: config.corsOrigins, credentials: true });
  await app.register(sensible);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(authPlugin);

  // ── error handler unique → enveloppe { error: { code, message, i18nKey } } ──
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      reply.code(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          i18nKey: err.i18nKey,
          details: err.details,
        },
      });
      return;
    }
    if (err instanceof ZodError) {
      reply.code(422).send({
        error: {
          code: "validation_failed",
          message: "Données invalides",
          i18nKey: "error.validation_failed",
          details: err.flatten(),
        },
      });
      return;
    }
    if ((err as { statusCode?: number }).statusCode === 429) {
      reply.code(429).send({
        error: { code: "rate_limited", message: "Trop de requêtes", i18nKey: "error.rate_limited" },
      });
      return;
    }
    req.log.error({ err }, "unhandled error");
    reply.code(500).send({
      error: { code: "internal", message: "Erreur interne", i18nKey: "error.internal" },
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({
      error: { code: "not_found", message: "Route inconnue", i18nKey: "error.not_found" },
    });
  });

  // ── routes ──
  await app.register(healthRoutes);
  await app.register(
    async (v1) => {
      await v1.register(apiariesRoutes, { prefix: "/apiaries" });
      await v1.register(hivesRoutes, { prefix: "/hives" });
      await v1.register(inspectionsRoutes, { prefix: "/inspections" });
      await v1.register(tasksRoutes, { prefix: "/tasks" });
      await v1.register(queensRoutes, { prefix: "/queens" });
      await v1.register(treatmentsRoutes, { prefix: "/treatments" });
      await v1.register(attachmentsRoutes, { prefix: "/attachments" });
      await v1.register(harvestsRoutes, { prefix: "/harvests" });
      await v1.register(financeRoutes, { prefix: "/finance" });
      await v1.register(alertsRoutes, { prefix: "/notifications" });
      await v1.register(analyticsRoutes, { prefix: "/analytics" });
      await v1.register(plannerRoutes, { prefix: "/planner" });
      await v1.register(reportsRoutes, { prefix: "/reports" });
      await v1.register(settingsRoutes, { prefix: "/settings" });
      await v1.register(syncRoutes, { prefix: "/sync" });
      await v1.register(aiRoutes, { prefix: "/ai" });
    },
    { prefix: "/api/v1" },
  );

  return app;
}
