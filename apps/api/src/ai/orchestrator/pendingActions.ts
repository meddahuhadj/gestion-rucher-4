import { randomUUID } from "node:crypto";

/**
 * Actions de niveau 2 / 3 proposées par l'orchestrateur, en attente de
 * confirmation utilisateur — §8/§23.
 *
 * Stockage en mémoire (TTL court). Suffisant pour une instance ; à déplacer
 * en table `pending_actions` (ou Redis) quand l'API passera en multi-réplicas.
 */
type Pending = {
  token: string;
  userId: string;
  tool: string;
  level: 2 | 3;
  args: Record<string, unknown>;
  summary: string;
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, Pending>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt < now) store.delete(k);
}

export function proposeAction(input: {
  userId: string;
  tool: string;
  level: 2 | 3;
  args: Record<string, unknown>;
  summary: string;
}): { token: string; expiresAt: string } {
  sweep();
  const token = randomUUID();
  const expiresAt = Date.now() + TTL_MS;
  store.set(token, { token, expiresAt, ...input });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export function takeAction(token: string, userId: string): Pending | null {
  sweep();
  const p = store.get(token);
  if (!p || p.userId !== userId) return null;
  store.delete(token);
  return p;
}
