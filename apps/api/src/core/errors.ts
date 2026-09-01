/**
 * Erreurs applicatives normalisées.
 * Le handler Fastify (app.ts) les convertit en réponse { error: { code, message, i18nKey } }.
 */

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "rate_limited"
  | "ai_unavailable"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_failed: 422,
  rate_limited: 429,
  ai_unavailable: 503,
  internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly i18nKey?: string;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { i18nKey?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = STATUS[code];
    this.i18nKey = opts.i18nKey;
    this.details = opts.details;
  }
}

export const notFound = (entity: string, id?: string) =>
  new AppError("not_found", `${entity} introuvable${id ? ` (${id})` : ""}`, {
    i18nKey: "error.not_found",
  });

export const forbidden = (reason = "Accès refusé") =>
  new AppError("forbidden", reason, { i18nKey: "error.forbidden" });

export const conflict = (message: string, details?: unknown) =>
  new AppError("conflict", message, { i18nKey: "error.conflict", details });
