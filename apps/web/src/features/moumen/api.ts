import type { ChatDelta, ChatRequest } from "@moumen/shared";
import { useSessionStore } from "@/store/session";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

/** Consomme le flux SSE de POST /ai/chat et livre les deltas un à un. */
export async function* streamChat(
  body: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatDelta> {
  const { token, debugUser } = useSessionStore.getState();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  else if (debugUser) headers["x-debug-user"] = debugUser;

  const res = await fetch(`${BASE}/ai/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    yield { type: "error", code: `http_${res.status}`, message: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        yield JSON.parse(line.slice(5).trim()) as ChatDelta;
      } catch {
        /* ignore ligne partielle */
      }
    }
  }
}

export async function confirmAction(actionToken: string) {
  const { token, debugUser } = useSessionStore.getState();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  else if (debugUser) headers["x-debug-user"] = debugUser;

  const res = await fetch(`${BASE}/ai/actions/confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify({ actionToken, confirm: true }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ ok: true; tool: string; result: unknown }>;
}
