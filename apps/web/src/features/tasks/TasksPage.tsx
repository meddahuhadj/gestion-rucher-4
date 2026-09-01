import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TaskListQuery, TaskPriority } from "@moumen/shared";
import { fmtDate } from "@/lib/format";
import { tasksApi } from "./api";

type Scope = NonNullable<TaskListQuery["scope"]>;
const SCOPES: Scope[] = ["overdue", "today", "week", "all"];

const PRIO_TONE: Record<TaskPriority, string> = {
  urgent: "text-danger",
  high: "text-attn",
  normal: "text-ink-soft",
  low: "text-muted",
};

export default function TasksPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [scope, setScope] = useState<Scope>("week");
  const [title, setTitle] = useState("");

  const tasks = useQuery({
    queryKey: ["tasks", scope],
    queryFn: () => tasksApi.list({ scope }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  async function add() {
    if (!title.trim()) return;
    await tasksApi.create({ title: title.trim(), type: "custom", priority: "normal" });
    setTitle("");
    void refresh();
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="font-display text-2xl font-semibold">{t("nav.tasks")}</h1>

      <div className="mt-4 flex flex-wrap gap-1 text-sm">
        {SCOPES.map((s) => (
          <button
            key={s}
            className={`rounded-lg px-3 py-1.5 ${scope === s ? "bg-honey-wash text-honey-ink" : "text-muted"}`}
            onClick={() => setScope(s)}
          >
            {t(`tasks.scope.${s}`)}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          className="input"
          placeholder={t("tasks.newPlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn-primary" disabled={!title.trim()}>
          {t("common.add")}
        </button>
      </form>

      {tasks.isLoading && <p className="mt-6 text-sm text-muted">{t("common.loading")}</p>}
      {tasks.data?.length === 0 && <p className="mt-6 text-sm text-muted">{t("tasks.empty")}</p>}

      <ul className="mt-4 space-y-2">
        {tasks.data?.map((tk) => (
          <li key={tk.id} className="card flex items-center gap-3 p-3 text-sm">
            <button
              aria-label={t("tasks.done")}
              className="h-5 w-5 flex-none rounded-full border border-border hover:border-ok"
              onClick={async () => {
                await tasksApi.complete(tk.id);
                void refresh();
              }}
            />
            <div className="flex-1">
              <div className={tk.status === "done" ? "line-through opacity-60" : ""}>{tk.title}</div>
              <div className="label-mono mt-0.5">
                <span className={PRIO_TONE[tk.priority]}>{t(`taskPriority.${tk.priority}`, tk.priority)}</span>
                {tk.dueAt ? ` · ${fmtDate(tk.dueAt)}` : ""}
                {` · ${t(`taskType.${tk.type}`, tk.type)}`}
                {tk.status === "done" && tk.completedByName
                  ? ` · ✓ ${tk.completedByName}`
                  : tk.author
                    ? ` · ${tk.author}`
                    : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
