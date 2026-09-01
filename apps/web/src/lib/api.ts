import type { ApiError } from "@moumen/shared";
import { useSessionStore } from "@/store/session";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export class ApiRequestError extends Error {
  code: string;
  status: number;
  i18nKey?: string;
  details?: unknown;
  constructor(status: number, body: ApiError["error"]) {
    super(body.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = body.code;
    this.i18nKey = body.i18nKey;
    this.details = body.details;
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; query?: Record<string, unknown> };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { body, query, headers, ...rest } = opts;
  const url = new URL(BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const { token, debugUser } = useSessionStore.getState();
  const h = new Headers(headers);
  if (body !== undefined) h.set("content-type", "application/json");
  if (token) h.set("authorization", `Bearer ${token}`);
  // Dev only : contourne Supabase Auth quand ALLOW_DEBUG_AUTH=true côté API.
  if (!token && debugUser) h.set("x-debug-user", debugUser);

  const res = await fetch(url, {
    ...rest,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (payload as ApiError | null)?.error ?? {
      code: "internal",
      message: `HTTP ${res.status}`,
    };
    throw new ApiRequestError(res.status, err);
  }
  return payload as T;
}
