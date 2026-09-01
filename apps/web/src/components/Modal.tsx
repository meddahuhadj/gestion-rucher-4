import { useEffect, type ReactNode } from "react";

/**
 * Modale légère — overlay + panneau centré, fermeture Échap / clic sur le fond.
 * Pas de portail : le shell n'a pas de contexte de superposition concurrent.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none rounded-t-2xl p-5 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="×"
            className="rounded-lg px-2 py-1 text-xl text-muted hover:text-ink"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
