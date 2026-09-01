import type { FastifyPluginAsync } from "fastify";
import {
  zExpenseCreate,
  zFinanceQuery,
  zRevenueCreate,
} from "@moumen/shared";
import { financeService } from "./finance.service.js";

export const financeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/expenses", async (req) => {
    const q = zFinanceQuery.parse(req.query);
    return { data: await financeService.listExpenses(req.user, q) };
  });
  fastify.post("/expenses", async (req, reply) => {
    const body = zExpenseCreate.parse(req.body);
    reply.code(201);
    return financeService.createExpense(req.user, body);
  });

  fastify.get("/revenues", async (req) => {
    const q = zFinanceQuery.parse(req.query);
    return { data: await financeService.listRevenues(req.user, q) };
  });
  fastify.post("/revenues", async (req, reply) => {
    const body = zRevenueCreate.parse(req.body);
    reply.code(201);
    return financeService.createRevenue(req.user, body);
  });

  fastify.get("/summary", async (req) => {
    const q = zFinanceQuery.parse(req.query);
    return financeService.summary(req.user, q);
  });
};
