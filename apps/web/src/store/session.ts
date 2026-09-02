import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@moumen/shared";

type SessionState = {
  token: string | null;
  userId: string | null;
  email: string | null;
  locale: Locale;
  /** dev : identifiant injecté via X-Debug-User quand aucun vrai JWT n'est présent */
  debugUser: string | null;
  setToken: (token: string | null, userId?: string | null, email?: string | null) => void;
  setLocale: (locale: Locale) => void;
  setDebugUser: (id: string | null) => void;
  signOut: () => void;
};

const SUPPORTED: readonly Locale[] = ["fr", "ar", "en"];
/** `||` (pas `??`) : une env var vide "" doit aussi retomber sur "fr". */
const envLocale = (import.meta.env.VITE_DEFAULT_LOCALE || "fr") as Locale;
const defaultLocale: Locale = SUPPORTED.includes(envLocale) ? envLocale : "fr";

/** Garde-fou : une locale persistée invalide ("" d'une version précédente) ne
 *  doit jamais atteindre Intl / toLocaleDateString. */
export const safeLocale = (l: unknown): Locale =>
  typeof l === "string" && SUPPORTED.includes(l as Locale) ? (l as Locale) : "fr";

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      email: null,
      locale: defaultLocale,
      debugUser: null,
      setToken: (token, userId = null, email = null) => set({ token, userId, email }),
      setLocale: (locale) => set({ locale }),
      setDebugUser: (debugUser) => set({ debugUser }),
      signOut: () => set({ token: null, userId: null, email: null, debugUser: null }),
    }),
    {
      name: "moumen.session",
      // le token vient de Supabase (rafraîchi automatiquement) — on ne le persiste pas
      partialize: (s) => ({ locale: s.locale, debugUser: s.debugUser }),
      // assainit une locale corrompue venue d'un ancien localStorage
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SessionState>;
        return { ...current, ...p, locale: safeLocale(p.locale) };
      },
    },
  ),
);
