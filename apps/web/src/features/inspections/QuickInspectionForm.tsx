import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { COLONY_STRENGTH, LEVEL, type ColonyStrength, type Level } from "@moumen/shared";
import { submitInspection } from "./submit";

/** Saisie rapide d'inspection — utilisable au rucher, hors-ligne (§24). */
export function QuickInspectionForm({ hiveId }: { hiveId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [strength, setStrength] = useState<ColonyStrength | "">("");
  const [queenSeen, setQueenSeen] = useState(false);
  const [honey, setHoney] = useState<Level | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string>("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { offline } = await submitInspection({
        hiveId,
        method: "manual",
        colonyStrength: strength || null,
        queenSeen,
        storesHoney: honey || null,
        notes: notes.trim() || undefined,
      });
      setFlash(offline ? t("inspection.savedOffline") : t("inspection.saved"));
      setStrength("");
      setQueenSeen(false);
      setHoney("");
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["inspections", { hiveId }] });
      void qc.invalidateQueries({ queryKey: ["hive", hiveId] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-4">
      <h3 className="font-display text-lg font-semibold">{t("inspection.quickTitle")}</h3>

      <label className="block text-sm">
        <span className="label-mono">{t("hives.strength")}</span>
        <select
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
          value={strength}
          onChange={(e) => setStrength(e.target.value as ColonyStrength | "")}
        >
          <option value="">—</option>
          {COLONY_STRENGTH.map((s) => (
            <option key={s} value={s}>
              {t(`strength.${s}`, s)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={queenSeen} onChange={(e) => setQueenSeen(e.target.checked)} />
        {t("inspection.queenSeen")}
      </label>

      <label className="block text-sm">
        <span className="label-mono">🍯 {t("inspection.honey")}</span>
        <select
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
          value={honey}
          onChange={(e) => setHoney(e.target.value as Level | "")}
        >
          <option value="">—</option>
          {LEVEL.map((l) => (
            <option key={l} value={l}>
              {t(`level.${l}`, l)}
            </option>
          ))}
        </select>
      </label>

      <textarea
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        rows={2}
        placeholder={t("inspection.notes")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy}>
          {t("common.save")}
        </button>
        {flash && <span className="text-sm text-ok">{flash}</span>}
      </div>
    </form>
  );
}
