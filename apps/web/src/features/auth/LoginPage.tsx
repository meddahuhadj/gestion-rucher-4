import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LOCALES, type Locale } from "@moumen/shared";
import { supabase, authConfigured } from "@/lib/supabase";
import { useSessionStore } from "@/store/session";
import { applyLocale, LOCALE_LABEL } from "@/i18n";

type Mode = "password" | "magic";

export default function LoginPage() {
  const { t } = useTranslation();
  const { token, debugUser, locale, setLocale, setDebugUser } = useSessionStore();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (token || debugUser) return <Navigate to="/" replace />;

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const signInPassword = () =>
    withBusy(async () => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) throw error;
    });

  const signUp = () =>
    withBusy(async () => {
      const { error } = await supabase!.auth.signUp({ email, password });
      if (error) throw error;
      setMsg(t("auth.checkEmail"));
    });

  const magicLink = () =>
    withBusy(async () => {
      const { error } = await supabase!.auth.signInWithOtp({ email });
      if (error) throw error;
      setMsg(t("auth.checkEmail"));
    });

  const google = () =>
    withBusy(async () => {
      const { error } = await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    });

  return (
    <div className="grid min-h-dvh place-items-center bg-ground p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold">🐝 {t("app.name")}</h1>
          <select
            aria-label="Langue"
            className="label-mono rounded-lg border border-border bg-surface px-2 py-1"
            value={locale}
            onChange={(e) => {
              const l = e.target.value as Locale;
              setLocale(l);
              applyLocale(l);
            }}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-sm text-muted">{t("app.tagline")}</p>

        {!authConfigured ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-attn">{t("auth.notConfigured")}</p>
            {(import.meta.env.DEV ||
              import.meta.env.VITE_ALLOW_DEV_LOGIN === "true") && (
              <button
                className="btn-ghost w-full"
                onClick={() => setDebugUser("00000000-0000-0000-0000-000000000001")}
              >
                {t("auth.devLogin")}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              placeholder={t("auth.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {mode === "password" && (
              <input
                type="password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                placeholder={t("auth.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}

            {mode === "password" ? (
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={signInPassword} disabled={busy}>
                  {t("auth.signIn")}
                </button>
                <button className="btn-ghost" onClick={signUp} disabled={busy}>
                  {t("auth.signUp")}
                </button>
              </div>
            ) : (
              <button className="btn-primary w-full" onClick={magicLink} disabled={busy}>
                {t("auth.sendMagicLink")}
              </button>
            )}

            <button
              className="label-mono w-full text-center text-honey-ink"
              onClick={() => setMode(mode === "password" ? "magic" : "password")}
            >
              {mode === "password" ? t("auth.useMagicLink") : t("auth.usePassword")}
            </button>

            <div className="flex items-center gap-2 text-muted">
              <span className="h-px flex-1 bg-border" /> {t("auth.or")} <span className="h-px flex-1 bg-border" />
            </div>
            <button className="btn-ghost w-full" onClick={google} disabled={busy}>
              {t("auth.google")}
            </button>
          </div>
        )}

        {msg && <p className="mt-4 text-sm text-attn">{msg}</p>}
      </div>
    </div>
  );
}
