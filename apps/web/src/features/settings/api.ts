import type { Settings, SettingsUpdate } from "@moumen/shared";
import { api } from "@/lib/api";

export const settingsApi = {
  get: () => api<Settings>("/settings"),
  update: (body: SettingsUpdate) =>
    api<Settings>("/settings", { method: "PATCH", body }),
};
