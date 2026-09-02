import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { UserRole } from "@moumen/shared";
import { config } from "../config.js";
import { AppError } from "./errors.js";
import { prisma } from "./db.js";

export type AuthUser = {
  /** Identité réelle de la personne connectée (createdBy, audit, settings). */
  id: string;
  /**
   * Périmètre de données à lire/écrire (`ownerId`). Égal à `id` en mode
   * mono-utilisateur ; égal au propriétaire canonique de l'équipe si `id`
   * fait partie de `config.teamMemberIds`.
   */
  dataOwnerId: string;
  email: string | null;
  role: UserRole;
};

/** Résout le périmètre de données partagé pour un id de personne. */
function resolveDataOwner(realId: string): string {
  return config.teamOwnerId && config.teamMemberIds.includes(realId)
    ? config.teamOwnerId
    : realId;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
  interface FastifyInstance {
    /** preHandler : rejette si pas de JWT valide, sinon peuple request.user */
    authenticate: (req: FastifyRequest) => Promise<void>;
    /** preHandler généré : exige un rôle minimum */
    requireRole: (min: UserRole) => (req: FastifyRequest) => Promise<void>;
  }
}

const ROLE_RANK: Record<UserRole, number> = { viewer: 0, manager: 1, owner: 2 };

const jwks = config.SUPABASE_JWT_JWKS_URL
  ? createRemoteJWKSet(new URL(config.SUPABASE_JWT_JWKS_URL))
  : null;
const hsSecret = config.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(config.SUPABASE_JWT_SECRET)
  : null;

async function verifyToken(token: string): Promise<JWTPayload> {
  if (jwks) {
    const { payload } = await jwtVerify(token, jwks);
    return payload;
  }
  if (hsSecret) {
    const { payload } = await jwtVerify(token, hsSecret);
    return payload;
  }
  throw new AppError(
    "internal",
    "Aucun mécanisme de vérification JWT configuré (SUPABASE_JWT_SECRET ou SUPABASE_JWT_JWKS_URL).",
  );
}

/** Crée la ligne applicative `users` au premier accès si absente. */
async function ensureUser(u: AuthUser): Promise<void> {
  await prisma.user.upsert({
    where: { id: u.id },
    update: {},
    create: { id: u.id, email: u.email ?? `${u.id}@unknown.local`, role: u.role },
  });
  // En équipe : garantir aussi la ligne du propriétaire canonique (FK ownerId)
  // même si ce compte ne s'est jamais connecté.
  if (u.dataOwnerId !== u.id) {
    await prisma.user.upsert({
      where: { id: u.dataOwnerId },
      update: {},
      create: { id: u.dataOwnerId, email: `${u.dataOwnerId}@team.local`, role: "owner" },
    });
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null as unknown as AuthUser);

  if (config.isProd && config.ALLOW_DEBUG_AUTH) {
    fastify.log.warn(
      "⚠️  ALLOW_DEBUG_AUTH=true en production — l'en-tête X-Debug-User est accepté. " +
        "À utiliser uniquement pour un déploiement privé sans Supabase Auth.",
    );
  }

  fastify.decorate("authenticate", async (req: FastifyRequest) => {
    // Raccourci sans Supabase Auth (déploiement privé). Opt-in via ALLOW_DEBUG_AUTH.
    if (config.ALLOW_DEBUG_AUTH) {
      const debugId = req.headers["x-debug-user"];
      if (typeof debugId === "string" && debugId.length > 0) {
        const role =
          (req.headers["x-debug-role"] as UserRole | undefined) ?? "owner";
        req.user = {
          id: debugId,
          dataOwnerId: resolveDataOwner(debugId),
          email: "debug@moumen.local",
          role,
        };
        await ensureUser(req.user);
        return;
      }
    }

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("unauthorized", "Jeton d'accès manquant", {
        i18nKey: "error.unauthorized",
      });
    }

    try {
      const payload = await verifyToken(header.slice(7));
      const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
      const realId = String(payload.sub);
      req.user = {
        id: realId,
        dataOwnerId: resolveDataOwner(realId),
        email: (payload.email as string) ?? null,
        role: (meta.role as UserRole) ?? "owner",
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("unauthorized", "Jeton d'accès invalide ou expiré", {
        i18nKey: "error.unauthorized",
      });
    }

    await ensureUser(req.user);
  });

  fastify.decorate(
    "requireRole",
    (min: UserRole) => async (req: FastifyRequest) => {
      await fastify.authenticate(req);
      if (ROLE_RANK[req.user.role] < ROLE_RANK[min]) {
        throw new AppError("forbidden", "Rôle insuffisant", {
          i18nKey: "error.forbidden",
        });
      }
    },
  );
};

export default fp(authPlugin, { name: "auth" });
