import type { VisionAnalyzeRequest, VisionResult } from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { aiProvider } from "../provider/index.js";
import { attachmentsService } from "../../modules/attachments/attachments.service.js";
import { fetchObject } from "../../core/storage.js";
import { AppError } from "../../core/errors.js";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    observation: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    interpretation: { type: "string" },
    toVerify: { type: "string" },
    recommendation: { type: "string" },
  },
  required: ["subject", "observation", "confidence"],
} as const;

const STEP_HINT: Record<string, string> = {
  entrance: "Photo de l'entrée de la ruche (activité, planche d'envol).",
  frame: "Photo d'un cadre.",
  brood: "Photo de la zone de couvain.",
  queen: "Recherche de la reine si elle est visible.",
  stores: "Photo des réserves (miel, pollen).",
};

/**
 * MOUMEN VISION — §7 / §34.
 * Produit une structure PRUDENTE : observation → confiance → interprétation →
 * à vérifier → recommandation. Jamais un diagnostic affirmatif.
 */
export async function analyzeAttachment(
  ctx: AuthUser,
  req: VisionAnalyzeRequest,
): Promise<VisionResult & { observationId: string }> {
  const provider = aiProvider();
  if (!provider.isReady()) {
    throw new AppError("ai_unavailable", "Fournisseur IA non configuré.");
  }

  const attachment = await attachmentsService.getRow(ctx, req.attachmentId);
  if (!attachment.mime.startsWith("image/")) {
    throw new AppError("bad_request", "La pièce jointe n'est pas une image.");
  }

  const { base64, mime } = await fetchObject(attachment.storagePath);

  const prompt = [
    "Tu es un assistant d'observation apicole. Décris UNIQUEMENT ce qui est visible sur l'image.",
    "Interdits : poser un diagnostic, nommer une maladie de façon affirmative, prétendre à une certitude.",
    "Emploie le conditionnel et des termes prudents : « pourrait », « semble », « indice possible ».",
    "Toujours renseigner `toVerify` : les gestes de contrôle humain à faire sur le terrain.",
    req.hint ? `Indication de l'utilisateur : ${req.hint}` : "",
    req.step ? `Étape d'inspection : ${STEP_HINT[req.step] ?? req.step}` : "",
    "Réponds STRICTEMENT au format JSON demandé.",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await provider.analyzeImage({
    imageBase64: base64,
    mimeType: mime,
    prompt,
    responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
  });

  const result: VisionResult = {
    subject: String(raw.subject ?? req.step ?? "ruche"),
    observation: String(raw.observation ?? ""),
    confidence:
      raw.confidence === "high" || raw.confidence === "medium" ? raw.confidence : "low",
    interpretation: raw.interpretation ? String(raw.interpretation) : null,
    toVerify: raw.toVerify ? String(raw.toVerify) : null,
    recommendation: raw.recommendation ? String(raw.recommendation) : null,
  };

  // Stocké à part des données saisies par l'apiculteur — §11.
  const obs = await prisma.aiObservation.create({
    data: {
      ownerId: ctx.dataOwnerId,
      subject: result.subject,
      hiveId: req.hiveId ?? attachment.hiveId ?? null,
      inspectionId: attachment.inspectionId ?? null,
      attachmentId: attachment.id,
      observation: result.observation,
      confidence: result.confidence,
      interpretation: result.interpretation,
      toVerify: result.toVerify,
      model: `${provider.name}:vision`,
      raw: JSON.parse(JSON.stringify(raw)),
    },
  });

  return { ...result, observationId: obs.id };
}
