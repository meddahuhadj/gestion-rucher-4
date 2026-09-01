import { useTranslation } from "react-i18next";
import { useSyncEngine } from "@/hooks/useSyncEngine";

/** Bandeau d'état réseau + file de synchro — §15/§25. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const { online, pending } = useSyncEngine();

  if (online && pending === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-sm ${
        online ? "bg-propolis/15 text-propolis" : "bg-attn/15 text-attn"
      }`}
    >
      <span aria-hidden>{online ? "↻" : "🟠"}</span>
      {online
        ? t("common.syncing", { count: pending })
        : t("common.offline")}
    </div>
  );
}
