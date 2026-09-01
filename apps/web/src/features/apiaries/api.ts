import type { Apiary, ApiaryCreate, ApiaryUpdate } from "@moumen/shared";
import { api } from "@/lib/api";

export const apiariesApi = {
  list: () => api<{ data: Apiary[] }>("/apiaries").then((r) => r.data),
  get: (id: string) => api<Apiary>(`/apiaries/${id}`),
  create: (body: ApiaryCreate) =>
    api<Apiary>("/apiaries", { method: "POST", body }),
  update: (id: string, body: ApiaryUpdate) =>
    api<Apiary>(`/apiaries/${id}`, { method: "PATCH", body }),
  remove: (id: string) =>
    api<{ id: string; deleted: true }>(`/apiaries/${id}`, { method: "DELETE" }),
};
