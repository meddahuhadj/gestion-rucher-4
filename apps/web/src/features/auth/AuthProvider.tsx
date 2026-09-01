import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session";

/**
 * Synchronise la session Supabase (rafraîchie automatiquement) vers le store.
 * `api.ts` envoie ensuite `Authorization: Bearer <access_token>`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const setToken = useSessionStore((s) => s.setToken);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setToken(s?.access_token ?? null, s?.user.id ?? null, s?.user.email ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setToken(
        session?.access_token ?? null,
        session?.user.id ?? null,
        session?.user.email ?? null,
      );
    });
    return () => sub.subscription.unsubscribe();
  }, [setToken]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">🐝…</div>
    );
  }
  return <>{children}</>;
}
