import { config } from "../config.js";
import { AppError } from "./errors.js";

/**
 * Accès Supabase Storage (bucket privé) via l'API REST + clé service_role.
 * Le client ne reçoit que des URL signées à courte durée — §14/§27.
 */

const BUCKET = "apiary-media";

function base() {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(
      "internal",
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants — le stockage est indisponible.",
    );
  }
  return {
    url: config.SUPABASE_URL.replace(/\/$/, ""),
    key: config.SUPABASE_SERVICE_ROLE_KEY,
  };
}

const authHeaders = (key: string) => ({
  authorization: `Bearer ${key}`,
  apikey: key,
});

/** URL signée pour un upload direct depuis le client (PUT). */
export async function createSignedUploadUrl(path: string): Promise<{
  uploadUrl: string;
  token: string;
  path: string;
}> {
  const { url, key } = base();
  const res = await fetch(
    `${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`,
    { method: "POST", headers: authHeaders(key) },
  );
  if (!res.ok) {
    throw new AppError("internal", `Storage sign upload a échoué (${res.status})`);
  }
  const data = (await res.json()) as { url: string; token: string };
  return {
    uploadUrl: `${url}/storage/v1${data.url}`,
    token: data.token,
    path,
  };
}

/** URL signée de lecture, valable `expiresIn` secondes. */
export async function createSignedDownloadUrl(
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const { url, key } = base();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...authHeaders(key), "content-type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) {
    throw new AppError("internal", `Storage sign download a échoué (${res.status})`);
  }
  const data = (await res.json()) as { signedURL: string };
  return `${url}/storage/v1${data.signedURL}`;
}

/** Télécharge l'objet et renvoie octets + type MIME (pour l'analyse Vision). */
export async function fetchObject(
  path: string,
): Promise<{ base64: string; mime: string }> {
  const signed = await createSignedDownloadUrl(path, 120);
  const res = await fetch(signed);
  if (!res.ok) throw new AppError("not_found", "Fichier introuvable dans le stockage");
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    base64: buf.toString("base64"),
    mime: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

export const STORAGE_BUCKET = BUCKET;
