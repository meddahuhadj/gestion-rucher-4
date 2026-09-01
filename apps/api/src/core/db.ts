import { PrismaClient } from "@prisma/client";
import { config } from "../config.js";

/**
 * Client Prisma unique. En dev, on le stocke sur globalThis pour survivre
 * aux rechargements à chaud de tsx.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isProd ? ["warn", "error"] : ["warn", "error"],
  });

if (!config.isProd) globalForPrisma.prisma = prisma;

export type Db = PrismaClient;
