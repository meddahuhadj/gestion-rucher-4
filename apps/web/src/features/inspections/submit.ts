import type { Inspection, InspectionCreate } from "@moumen/shared";
import { api } from "@/lib/api";
import { enqueue } from "@/services/sync";
import { useNetwork } from "@/services/network";

/**
 * Crée une inspection — offline-first (§15/§26).
 * En ligne : POST direct. Hors-ligne ou en cas d'échec réseau : mise en file
 * d'attente locale (jamais perdue), id optimiste = clientUuid.
 */
export async function submitInspection(
  input: InspectionCreate,
): Promise<{ id: string; offline: boolean }> {
  const clientUuid = input.clientUuid ?? crypto.randomUUID();
  const payload = { ...input, clientUuid };

  if (useNetwork.getState().online) {
    try {
      const r = await api<Inspection>("/inspections", { method: "POST", body: payload });
      return { id: r.id, offline: false };
    } catch {
      // le réseau a lâché en cours de route → on bascule sur la file locale
    }
  }

  await enqueue("inspection", "create", payload as Record<string, unknown>);
  return { id: clientUuid, offline: true };
}
