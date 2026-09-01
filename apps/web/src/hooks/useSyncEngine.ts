import { useEffect, useState } from "react";
import { flush, pendingCount, pullChanges } from "@/services/sync";
import { useNetwork } from "@/services/network";

/**
 * Moteur de synchro monté au niveau du shell — §16.
 * Vide l'outbox à la reconnexion, périodiquement, et au démarrage.
 */
export function useSyncEngine() {
  const online = useNetwork((s) => s.online);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      await flush();
      if (alive) setPending(await pendingCount());
    };

    void tick();
    if (online) void pullChanges().catch(() => {});

    const interval = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [online]);

  return { online, pending };
}
