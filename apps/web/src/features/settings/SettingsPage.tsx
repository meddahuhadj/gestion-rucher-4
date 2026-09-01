import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  LOCALES,
  TEMP_UNITS,
  WEIGHT_UNITS,
  zThresholds,
  type Locale,
  type Settings,
  type Thresholds,
} from "@moumen/shared";
import { applyLocale, LOCALE_LABEL } from "@/i18n";
import { useSessionStore } from "@/store/session";
import { usePrefsStore } from "@/store/prefs";
import { ApiRequestError } from "@/lib/api";
import { settingsApi } from "./api";

const THRESHOLD_KEYS = Object.keys(zThresholds.shape) as (keyof Thresholds)[];

export default function SettingsPage() {
  const { t } = useTranslation();
  const setLocale = useSessionStore((s) => s.setLocale);

  const query = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });

  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  if (query.isLoading || !draft) {
    return <p className="p-8 text-sm text-muted">{t("common.loading")}</p>;
  }

  const patch = (p: Partial<Settings>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setStatus("idle");
  };
  const patchThreshold = (k: keyof Thresholds, v: number) =>
    patch({ thresholds: { ...draft.thresholds, [k]: v } });

  async function save() {
    if (!draft) return;
    setBusy(true);
    setStatus("idle");
    try {
      const saved = await settingsApi.update({
        displayName: draft.displayName,
        locale: draft.locale,
        currency: draft.currency.trim() || "DZD",
        units: draft.units,
        thresholds: draft.thresholds,
      });
      setDraft(saved);
      setLocale(saved.locale);
      applyLocale(saved.locale);
      usePrefsStore.getState().setPrefs({
        currency: saved.currency,
        weightUnit: saved.units.weight,
        tempUnit: saved.units.temperature,
      });
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      if (err instanceof ApiRequestError && err.i18nKey) {
        // laisse le message générique s'afficher
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">{t("nav.settings")}</h1>

      {/* ── profil ── */}
      <section className="card mt-4 space-y-3 p-4">
        <h2 className="label-mono">{t("settings.profile")}</h2>
        <label className="block">
          <span className="label-mono">{t("settings.displayName")}</span>
          <input
            className="input mt-1"
            value={draft.displayName ?? ""}
            onChange={(e) => patch({ displayName: e.target.value || null })}
            maxLength={120}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label-mono">{t("settings.language")}</span>
            <select
              className="input mt-1"
              value={draft.locale}
              onChange={(e) => patch({ locale: e.target.value as Locale })}
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-mono">{t("settings.currency")}</span>
            <input
              className="input mt-1"
              value={draft.currency}
              onChange={(e) => patch({ currency: e.target.value })}
              maxLength={8}
            />
          </label>
        </div>
      </section>

      {/* ── unités ── */}
      <section className="card mt-4 space-y-3 p-4">
        <h2 className="label-mono">{t("settings.units")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label-mono">{t("settings.weight")}</span>
            <select
              className="input mt-1"
              value={draft.units.weight}
              onChange={(e) =>
                patch({ units: { ...draft.units, weight: e.target.value as "kg" | "lb" } })
              }
            >
              {WEIGHT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`settings.weightUnit.${u}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label-mono">{t("settings.temperature")}</span>
            <select
              className="input mt-1"
              value={draft.units.temperature}
              onChange={(e) =>
                patch({ units: { ...draft.units, temperature: e.target.value as "c" | "f" } })
              }
            >
              {TEMP_UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`settings.tempUnit.${u}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* ── seuils d'alerte ── */}
      <section className="card mt-4 space-y-3 p-4">
        <h2 className="label-mono">{t("settings.thresholds")}</h2>
        <p className="text-sm text-muted">{t("settings.thresholdsHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {THRESHOLD_KEYS.map((k) => (
            <label key={k} className="block">
              <span className="label-mono">{t(`settings.threshold.${k}`)}</span>
              <input
                type="number"
                className="input mt-1"
                min={0}
                value={draft.thresholds[k]}
                onChange={(e) => patchThreshold(k, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </section>

      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? t("common.loading") : t("common.save")}
        </button>
        {status === "saved" && <span className="text-sm text-ok">{t("settings.saved")}</span>}
        {status === "error" && <span className="text-sm text-danger">{t("error.internal")}</span>}
      </div>
    </div>
  );
}
