import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * Accès rapides globaux — §41 (bouton MOUMEN) + §3 (caméra).
 * Présents sur toutes les pages ; le contexte courant est transmis via le store.
 */
export function MoumenButton() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="fixed bottom-24 end-4 z-30 flex flex-col gap-2 md:bottom-6 md:end-6">
      <button
        type="button"
        onClick={() => navigate("/vision")}
        aria-label={t("vision.title")}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-xl shadow-md transition-transform hover:scale-105 active:scale-95"
      >
        📷
      </button>
      <button
        type="button"
        onClick={() => navigate("/moumen")}
        aria-label={t("dashboard.talkToMoumen")}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-honey text-2xl text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        🧠
      </button>
    </div>
  );
}
