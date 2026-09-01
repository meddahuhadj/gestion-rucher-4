import type { Task, TaskCreate, TaskListQuery } from "@moumen/shared";
import { api } from "@/lib/api";

export const tasksApi = {
  list: (q: Partial<TaskListQuery> = {}) =>
    api<{ data: Task[] }>("/tasks", { query: q as Record<string, unknown> }).then((r) => r.data),
  create: (body: TaskCreate) => api<Task>("/tasks", { method: "POST", body }),
  complete: (id: string) => api<Task>(`/tasks/${id}/complete`, { method: "POST" }),
  update: (id: string, body: Partial<Task>) =>
    api<Task>(`/tasks/${id}`, { method: "PATCH", body }),
};
