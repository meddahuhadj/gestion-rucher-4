import type { NotificationKind, Severity } from "@moumen/shared";
import { api } from "@/lib/api";

export type Overview = {
  hives: { live: number; byStatus: Record<string, number> };
  inspections: { last30d: number; last7d: number };
  tasks: { overdue: number; dueToday: number; upcoming: number };
  production: { year: number; totalKg: number; bestHive: { hiveNumber: number; totalKg: number } | null };
  finance: { currency: "DZD"; month: { revenue: number; expense: number; profit: number } };
  alerts: { total: number; bySeverity: Record<string, number> };
};

export type AlertItem = {
  id: string;
  kind: NotificationKind;
  severity: Severity;
  title: string;
  body: string | null;
  hiveId: string | null;
  readAt: string | null;
  createdAt: string;
};

export const dashboardApi = {
  overview: () => api<Overview>("/analytics/overview"),
  alerts: () => api<{ data: AlertItem[] }>("/notifications", { query: { unread: true } }).then((r) => r.data),
  scan: () => api<{ generated: number }>("/notifications/scan", { method: "POST" }),
  markRead: (id: string) => api(`/notifications/${id}/read`, { method: "POST" }),
};
