import type { Attachment } from "@moumen/shared";
import { api } from "@/lib/api";

export const attachmentsApi = {
  /** Métadonnées + URL signée de lecture (`url`), valable ~1h. */
  get: (id: string) => api<Attachment>(`/attachments/${id}`),
};
