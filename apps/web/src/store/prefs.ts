import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_UNITS } from "@moumen/shared";

/**
 * Préférences d'affichage (devise + unités) — miroir local de /settings.
 * Persistées pour que le formatage soit stable avant que l'API réponde au reload.
 * Hydratées par `usePrefsSync()` (AppShell) et par SettingsPage à l'enregistrement.
 */
type PrefsFields = {
  currency: string;
  weightUnit: "kg" | "lb";
  tempUnit: "c" | "f";
};

type PrefsState = PrefsFields & {
  setPrefs: (p: Partial<PrefsFields>) => void;
};

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      currency: "DZD",
      weightUnit: DEFAULT_UNITS.weight,
      tempUnit: DEFAULT_UNITS.temperature,
      setPrefs: (p) => set(p),
    }),
    { name: "moumen.prefs" },
  ),
);
