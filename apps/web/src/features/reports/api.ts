import { useSessionStore } from "@/store/session";

const BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:4000/api/v1" : "/api/v1");

export const REPORT_KINDS = [
  "hives",
  "inspections",
  "harvests",
  "expenses",
  "revenues",
  "tasks",
  "treatments",
  "queens",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export type ReportRange = { from?: string; to?: string; sep?: "," | ";" };

/** Télécharge un CSV signé et déclenche l'enregistrement côté navigateur. */
export async function downloadReport(kind: ReportKind, range: ReportRange = {}) {
  const { token, debugUser } = useSessionStore.getState();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  else if (debugUser) headers["x-debug-user"] = debugUser;

  const url = new URL(`${BASE}/reports/${kind}.csv`);
  if (range.from) url.searchParams.set("from", range.from);
  if (range.to) url.searchParams.set("to", range.to);
  if (range.sep) url.searchParams.set("sep", range.sep);

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `moumen_${kind}.csv`;

  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
