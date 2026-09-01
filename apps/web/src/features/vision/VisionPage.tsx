import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { VisionResult } from "@moumen/shared";
import { api } from "@/lib/api";
import { uploadImage } from "@/lib/upload";
import { useAppContext } from "@/store/appContext";

type Analysis = VisionResult & { observationId: string };
type Phase = "idle" | "camera" | "uploading" | "analyzing" | "done" | "error";

const CONF_LABEL: Record<VisionResult["confidence"], string> = {
  low: "faible",
  medium: "moyenne",
  high: "élevée",
};

export default function VisionPage() {
  const { t } = useTranslation();
  const hiveId = useAppContext((s) => s.currentHiveId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<Analysis | null>(null);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((tk) => tk.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("camera");
    } catch {
      setError(t("vision.cameraDenied"));
      setPhase("error");
    }
  }

  async function analyzeBlob(blob: Blob) {
    try {
      setPhase("uploading");
      const { attachmentId } = await uploadImage(blob, {
        category: "hive",
        hiveId: hiveId ?? undefined,
      });
      setPhase("analyzing");
      const res = await api<Analysis>("/ai/vision/analyze", {
        method: "POST",
        body: { attachmentId, hiveId: hiveId ?? undefined },
      });
      setResult(res);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopCamera();
    setPhase("idle");
    canvas.toBlob((b) => b && void analyzeBlob(b), "image/jpeg", 0.9);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">📷 {t("vision.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("vision.disclaimer")}</p>

      <div className="mt-4 space-y-3">
        {phase === "camera" && (
          <div className="overflow-hidden rounded-2xl border border-border bg-black">
            <video ref={videoRef} playsInline muted className="w-full" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {phase !== "camera" ? (
            <button className="btn-primary" onClick={startCamera}>
              {t("vision.openCamera")}
            </button>
          ) : (
            <button className="btn-primary" onClick={capture}>
              {t("vision.capture")}
            </button>
          )}

          <label className="btn-ghost cursor-pointer">
            {t("vision.upload")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void analyzeBlob(f);
              }}
            />
          </label>
        </div>

        {(phase === "uploading" || phase === "analyzing") && (
          <p className="text-sm text-muted">
            {phase === "uploading" ? t("vision.uploading") : t("vision.analyzing")}
          </p>
        )}
        {phase === "error" && <p className="text-sm text-danger">{error}</p>}

        {result && phase === "done" && (
          <div className="card space-y-3 p-4">
            <div className="label-mono text-attn">{t("vision.resultTitle")}</div>
            <Row label={t("vision.observation")} value={result.observation} />
            <Row label={t("vision.confidence")} value={CONF_LABEL[result.confidence]} />
            {result.interpretation && (
              <Row label={t("vision.interpretation")} value={result.interpretation} />
            )}
            {result.toVerify && <Row label={t("vision.toVerify")} value={result.toVerify} />}
            {result.recommendation && (
              <Row label={t("vision.recommendation")} value={result.recommendation} />
            )}
            <p className="label-mono text-muted">{t("vision.humanCheck")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-mono">{label}</div>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
