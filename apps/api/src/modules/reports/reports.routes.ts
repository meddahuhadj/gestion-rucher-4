import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../../core/errors.js";
import { isReportKind, reportsService } from "./reports.service.js";

const zQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  sep: z.enum([",", ";"]).default(","),
});

export const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  /** Liste des rapports disponibles — alimente la page Rapports. */
  fastify.get("/", async () => ({ kinds: reportsService.kinds() }));

  /** GET /reports/:kind.csv?from=&to=&sep= → téléchargement CSV. */
  fastify.get("/:kind.csv", async (req, reply) => {
    const { kind } = req.params as { kind: string };
    if (!isReportKind(kind)) {
      throw new AppError("not_found", `Rapport inconnu (${kind})`, {
        i18nKey: "error.not_found",
      });
    }
    const q = zQuery.parse(req.query);
    const { filename, csv } = await reportsService.build(req.user, kind, q);

    reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="${filename}"`)
      .header("cache-control", "no-store");
    return csv;
  });
};
