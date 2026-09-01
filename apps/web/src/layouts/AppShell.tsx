import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { LOCALES, type Locale } from "@moumen/shared";
import { useSessionStore } from "@/store/session";
import { applyLocale, LOCALE_LABEL } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { MoumenButton } from "@/components/MoumenButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAppContext } from "@/store/appContext";
import { usePrefsSync } from "@/hooks/usePrefsSync";

type Item = { to: string; key: string; icon: string; primary?: boolean };

const NAV: Item[] = [
  { to: "/", key: "nav.dashboard", icon: "🏠", primary: true },
  { to: "/apiaries", key: "nav.apiaries", icon: "🗺️" },
  { to: "/hives", key: "nav.hives", icon: "🐝", primary: true },
  { to: "/inspections", key: "nav.inspections", icon: "🔍" },
  { to: "/calendar", key: "nav.calendar", icon: "📅", primary: true },
  { to: "/tasks", key: "nav.tasks", icon: "🔧" },
  { to: "/queens", key: "nav.queens", icon: "👑" },
  { to: "/harvests", key: "nav.harvests", icon: "🍯" },
  { to: "/finance", key: "nav.finance", icon: "💰" },
  { to: "/analytics", key: "nav.analytics", icon: "📊" },
  { to: "/moumen", key: "nav.moumen", icon: "🧠", primary: true },
  { to: "/reports", key: "nav.reports", icon: "📄" },
  { to: "/settings", key: "nav.settings", icon: "⚙️" },
];

function LocaleSwitch() {
  const { locale, setLocale } = useSessionStore();
  return (
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
  );
}

function CurrentUser() {
  const email = useSessionStore((s) => s.email);
  const debugUser = useSessionStore((s) => s.debugUser);
  const label = email ?? debugUser;
  if (!label) return null;
  return (
    <span
      className="label-mono hidden max-w-[12rem] truncate sm:inline"
      title={label}
    >
      {label}
    </span>
  );
}

function SignOut() {
  const { t } = useTranslation();
  const signOut = useSessionStore((s) => s.signOut);
  return (
    <button
      type="button"
      aria-label={t("auth.signOut")}
      title={t("auth.signOut")}
      className="label-mono rounded-lg border border-border bg-surface px-2 py-1"
      onClick={async () => {
        await supabase?.auth.signOut();
        signOut();
      }}
    >
      ⎋
    </button>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const setContext = useAppContext((s) => s.set);
  const authed = useSessionStore((s) => Boolean(s.token) || Boolean(s.debugUser));

  usePrefsSync();

  useEffect(() => {
    setContext({ page: pathname });
  }, [pathname, setContext]);

  if (!authed) return <Navigate to="/login" replace />;

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-border bg-surface p-4 md:flex">
        <div className="flex items-baseline gap-2 px-2 pb-4">
          <span className="text-lg">🐝</span>
          <span className="font-display text-base font-semibold">MOUMEN</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={() =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isActive(item.to)
                    ? "bg-honey-wash font-semibold text-honey-ink"
                    : "text-ink-soft hover:bg-surface-2"
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-ground/85 px-4 py-2.5 backdrop-blur">
          <span className="font-display text-sm font-medium md:hidden">🐝 MOUMEN</span>
          <span className="label-mono hidden md:inline">{t("app.tagline")}</span>
          <div className="flex items-center gap-2">
            <CurrentUser />
            <LocaleSwitch />
            <SignOut />
          </div>
        </header>

        <OfflineBanner />

        <main className="flex-1 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((i) => i.primary).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={() =>
              `flex flex-col items-center gap-0.5 py-2 text-[0.65rem] ${
                isActive(item.to) ? "text-honey-ink" : "text-muted"
              }`
            }
          >
            <span className="text-lg" aria-hidden>{item.icon}</span>
            {t(item.key)}
          </NavLink>
        ))}
        <NavLink
          to="/settings"
          className="flex flex-col items-center gap-0.5 py-2 text-[0.65rem] text-muted"
        >
          <span className="text-lg" aria-hidden>☰</span>
          {t("nav.menu")}
        </NavLink>
      </nav>

      <MoumenButton />
    </div>
  );
}
