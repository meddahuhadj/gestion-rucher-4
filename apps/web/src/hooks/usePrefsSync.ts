import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/features/settings/api";
import { usePrefsStore } from "@/store/prefs";

/**
 * Récupère /settings une fois par session et pousse devise + unités dans
 * `usePrefsStore` pour que les helpers de `lib/format` les respectent.
 */
export function usePrefsSync() {
  const setPrefs = usePrefsStore((s) => s.setPrefs);
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;
    setPrefs({
      currency: data.currency,
      weightUnit: data.units.weight,
      tempUnit: data.units.temperature,
    });
  }, [data, setPrefs]);
}
