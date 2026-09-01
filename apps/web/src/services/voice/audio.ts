/**
 * Utilitaires audio pour la session vocale temps réel (§6).
 * Repris et adapté du prototype MOUMEN-ASSISTANT.html.
 */

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function decodeBase64(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** PCM 16 kHz mono à partir d'un buffer Float32 (micro). */
export function floatToPcm16Base64(data: Float32Array): { data: string; mimeType: string } {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    int16[i] = Math.max(-1, Math.min(1, data[i]!)) * 32767;
  }
  return {
    data: encodeBase64(new Uint8Array(int16.buffer)),
    mimeType: "audio/pcm;rate=16000",
  };
}

/** Décode un flux PCM 16 bits (sortie du modèle, 24 kHz) en AudioBuffer. */
export async function pcm16ToAudioBuffer(
  bytes: Uint8Array,
  ctx: AudioContext,
  sampleRate = 24000,
): Promise<AudioBuffer> {
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const buffer = ctx.createBuffer(1, int16.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) channel[i] = int16[i]! / 32768;
  return buffer;
}
