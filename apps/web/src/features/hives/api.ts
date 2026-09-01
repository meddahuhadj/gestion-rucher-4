import type { Hive, HiveCreate, HiveListQuery, HiveUpdate } from "@moumen/shared";
import { api } from "@/lib/api";

export type HiveCounts = {
  total: number;
  byStatus: Record<string, number>;
};

export const hivesApi = {
  list: (q: Partial<HiveListQuery> = {}) =>
    api<{ data: Hive[] }>("/hives", { query: q as Record<string, unknown> }).then(
      (r) => r.data,
    ),
  counts: () => api<HiveCounts>("/hives/counts"),
  get: (id: string) => api<Hive>(`/hives/${id}`),
  create: (body: HiveCreate) => api<Hive>("/hives", { method: "POST", body }),
  update: (id: string, body: HiveUpdate) =>
    api<Hive>(`/hives/${id}`, { method: "PATCH", body }),
  archive: (id: string, reason: string) =>
    api<Hive>(`/hives/${id}/archive`, { method: "POST", body: { reason } }),
};
