import fs from "node:fs";
import { z } from "zod";

if (fs.existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignorer si la version de Node ne supporte pas loadEnvFile
  }
}


const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Secret HS256 des JWT Supabase. En prod, préférer la vérification JWKS.
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  SUPABASE_JWT_JWKS_URL: z.string().url().optional(),

  AI_PROVIDER: z.enum(["gemini", "openai", "anthropic"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  // gemini-2.5-flash a été retiré pour les nouvelles clés API (404). 3.6-flash
  // est le modèle courant ; il "réfléchit" par défaut (voir thinkingBudget).
  GEMINI_MODEL: z.string().default("gemini-3.6-flash"),
  GEMINI_LIVE_MODEL: z
    .string()
    .default("gemini-2.5-flash-native-audio-preview-09-2025"),

  API_PORT: z.coerce.number().int().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  RATE_LIMIT_AI_PER_MIN: z.coerce.number().int().default(20),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // Accepte un header X-Debug-User pour simuler un utilisateur sans passer par
  // Supabase Auth. Opt-in explicite (déploiement privé) : voir core/auth.ts.
  ALLOW_DEBUG_AUTH: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Équipe co-propriétaire (§ multi-utilisateur léger) : liste d'IDs Supabase
  // séparés par des virgules. Tous ces comptes partagent le MÊME périmètre de
  // données ; le PREMIER id de la liste est le propriétaire canonique (ownerId).
  // `createdBy` / audit conservent l'auteur réel. Vide = mode mono-utilisateur.
  TEAM_MEMBER_IDS: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Configuration invalide :",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

const teamMemberIds = parsed.data.TEAM_MEMBER_IDS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  isTest: parsed.data.NODE_ENV === "test",
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()),
  teamMemberIds,
  /** Propriétaire canonique des données partagées, ou null si mode mono-utilisateur. */
  teamOwnerId: teamMemberIds[0] ?? null,
};

export type AppConfig = typeof config;
