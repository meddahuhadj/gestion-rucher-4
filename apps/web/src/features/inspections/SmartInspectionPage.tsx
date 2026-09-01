import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  COLONY_STRENGTH,
  LEVEL,
  type ColonyStrength,
  type InspectionCreate,
  type Level,
  type VisionResult,
} from "@moumen/shared";
import { api } from "@/lib/api";
import { uploadImage } from "@/lib/upload";
import { hivesApi } from "@/features/hives/api";
import { submitInspection } from "./submit";

type StepId = "entrance" | "frame" | "brood" | "queen" | "stores";
type VisionOut = VisionResult & { observationId: string };

type StepPhoto = { attachmentId: string; analysis?: VisionOut; analyzing: boolean };

const STEPS: { id: StepId; icon: string }[] = [
  { id: "entrance", icon: "🚪" },
  { id: "frame", icon: "🖼️" },
  { id: "brood", icon: "🐛" },
  { id: "queen", icon: "👑" },
  { id: "stores", icon: "🍯" },
];

export default function SmartInspectionPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const hive = useQuery({ queryKey: ["hive", id], queryFn: () => hivesApi.get(id), enabled: !!id });

  const [stepIdx, setStepIdx] = useState(0);
  const [photos, setPhotos] = useState<Record<StepId, StepPhoto[]>>({
    entrance: [], frame: [], brood: [], queen: [], stores: [],
  });
  const [strength, setStrength] = useState<ColonyStrength | "">("");
  const [queenSeen, setQueenSeen] = useState<boolean | null>(null);
  const [honey, setHoney] = useState<Level | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const step = STEPS[stepIdx]!;
  const isReview = stepIdx >= STEPS.length;

  const allAttachmentIds = useMemo(
    () => Object.values(photos).flat().map((p) => p.attachmentId),
    [photos],
  );
  const aiObservations = useMemo(
    () =>
      Object.values(photos)
        .flat()
        .map((p) => p.analysis)
        .filter((a): a is VisionOut => !!a),
    [photos],
  );

  async function onPick(file: File) {
    const sid = step.id;
    try {
      const { attachmentId } = await uploadImage(file, { category: sid === "queen" ? "queen" : "hive", hiveId: id });
      setPhotos((p) => ({ ...p, [sid]: [...p[sid], { attachmentId, analyzing: true }] }));
      const analysis = await api<VisionOut>("/ai/vision/analyze", {
        method: "POST",
        body: { attachmentId, hiveId: id, step: sid },
      });
      setPhotos((p) => ({
        ...p,
        [sid]: p[sid].map((x) => (x.attachmentId === attachmentId ? { ...x, analysis, analyzing: false } : x)),
      }));
    } catch {
      setPhotos((p) => ({
        ...p,
        [sid]: p[sid].map((x) => ({ ...x, analyzing: false })),
      }));
    }
  }

  async function finish() {
    setSubmitting(true);
    try {
      const payload: InspectionCreate = {
        hiveId: id,
        method: "camera",
        colonyStrength: strength || null,
        queenSeen,
        storesHoney: honey || null,
        notes: notes.trim() || undefined,
        attachmentIds: allAttachmentIds.length ? allAttachmentIds : undefined,
        observations: aiObservations.map((o) => ({
          key: `vision:${o.subject}`,
          value: {
            observation: o.observation,
            confidence: o.confidence,
            toVerify: o.toVerify,
          },
          source: "ai",
        })),
      };
      const { offline } = await submitInspection(payload);
      navigate(`/hives/${id}`, { state: { flash: offline ? "savedOffline" : "saved" } });
    } finally {
      setSubmitting(false);
    }
  }

  if (hive.isLoading) return <p className="p-8 text-sm text-muted">{t("common.loading")}</p>;

  return (
    <div className="mx-auto max-w-xl p-4 md:p-8">
      <h1 className="font-display text-xl font-semibold">
        🐝 {t("smart.title")} — {t("hives.number")} {hive.data?.number}
      </h1>

      {/* progression */}
      <div className="mt-4 flex gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full ${
              i < stepIdx ? "bg-honey" : i === stepIdx && !isReview ? "bg-honey/50" : "bg-border"
            }`}
          />
        ))}
      </div>

      {!isReview ? (
        <div className="mt-6">
          <div className="text-3xl">{step.icon}</div>
          <h2 className="mt-2 font-display text-lg font-semibold">{t(`smart.step.${step.id}.title`)}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t(`smart.step.${step.id}.hint`)}</p>

          {/* champ rapide contextuel */}
          {step.id === "entrance" && (
            <Field label={t("hives.strength")}>
              <select
                className="input"
                value={strength}
                onChange={(e) => setStrength(e.target.value as ColonyStrength | "")}
              >
                <option value="">—</option>
                {COLONY_STRENGTH.map((s) => (
                  <option key={s} value={s}>{t(`strength.${s}`, s)}</option>
                ))}
              </select>
            </Field>
          )}
          {step.id === "queen" && (
            <Field label={t("inspection.queenSeen")}>
              <div className="flex gap-2">
                {([["yes", true], ["no", false]] as const).map(([k, v]) => (
                  <button
                    key={k}
                    className={`rounded-lg px-3 py-1.5 text-sm ${queenSeen === v ? "bg-honey text-white" : "border border-border"}`}
                    onClick={() => setQueenSeen(v)}
                  >
                    {k === "yes" ? t("common.confirm") : t("common.cancel")}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {step.id === "stores" && (
            <Field label={t("inspection.honey")}>
              <select className="input" value={honey} onChange={(e) => setHoney(e.target.value as Level | "")}>
                <option value="">—</option>
                {LEVEL.map((l) => (
                  <option key={l} value={l}>{t(`level.${l}`, l)}</option>
                ))}
              </select>
            </Field>
          )}

          {/* photos de l'étape */}
          <div className="mt-4 space-y-2">
            {photos[step.id].map((p) => (
              <div key={p.attachmentId} className="card p-3 text-sm">
                {p.analyzing && <p className="text-muted">{t("vision.analyzing")}</p>}
                {p.analysis && (
                  <>
                    <p className="label-mono text-attn">{t("vision.resultTitle")}</p>
                    <p className="mt-1">{p.analysis.observation}</p>
                    {p.analysis.toVerify && (
                      <p className="mt-1 text-muted">▸ {t("vision.toVerify")}: {p.analysis.toVerify}</p>
                    )}
                  </>
                )}
              </div>
            ))}
            <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>
              📷 {t("smart.addPhoto")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPick(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          <div className="mt-6 flex justify-between">
            <button
              className="btn-ghost"
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
            >
              {t("smart.back")}
            </button>
            <button className="btn-primary" onClick={() => setStepIdx((i) => i + 1)}>
              {stepIdx === STEPS.length - 1 ? t("smart.review") : t("smart.next")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">{t("smart.reviewTitle")}</h2>
          <div className="card p-4 text-sm">
            <Row k={t("hives.strength")} v={strength ? t(`strength.${strength}`, strength) : "—"} />
            <Row k={t("hiveDetail.queen")} v={queenSeen == null ? "—" : queenSeen ? "✓" : "✗"} />
            <Row k={t("inspection.honey")} v={honey ? t(`level.${honey}`, honey) : "—"} />
            <Row k={t("smart.photos")} v={String(allAttachmentIds.length)} />
            <Row k={t("smart.aiNotes")} v={String(aiObservations.length)} />
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder={t("inspection.notes")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <p className="label-mono text-muted">{t("smart.disclaimer")}</p>
          <div className="flex justify-between">
            <button className="btn-ghost" onClick={() => setStepIdx(STEPS.length - 1)}>
              {t("smart.back")}
            </button>
            <button className="btn-primary" onClick={finish} disabled={submitting}>
              {t("common.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block text-sm">
      <span className="label-mono">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
