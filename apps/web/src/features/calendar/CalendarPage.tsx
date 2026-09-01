import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { PlanItem, PlannerResult, Task } from "@moumen/shared";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { tasksApi } from "@/features/tasks/api";

export default function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [plan, setPlan] = useState<PlannerResult | null>(null);
  const [planning, setPlanning] = useState(false);
  const [created, setCreated] = useState<Set<number>>(new Set());

  const tasks = useQuery({
    queryKey: ["tasks", "week"],
    queryFn: () => tasksApi.list({ scope: "week" }),
  });

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const tk of tasks.data ?? []) {
      const d = tk.dueAt ? tk.dueAt.slice(0, 10) : t("calendar.noDate");
      const arr = m.get(d);
      if (arr) arr.push(tk);
      else m.set(d, [tk]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks.data, t]);

  async function organise() {
    setPlanning(true);
    setCreated(new Set());
    try {
      setPlan(await api<PlannerResult>("/planner/generate", { method: "POST", body: {} }));
    } finally {
      setPlanning(false);
    }
  }

  async function createFrom(item: PlanItem, idx: number) {
    await tasksApi.create({
      title: item.title,
      type: item.kind === "inspection" ? "inspection" : "custom",
      priority: item.priority,
      hiveId: item.hiveId ?? undefined,
      dueAt: new Date(`${item.day}T08:00:00`).toISOString(),
    });
    setCreated((s) => new Set(s).add(idx));
    void qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{t("nav.calendar")}</h1>
        <button className="btn-primary" onClick={organise} disabled={planning}>
          🧠 {t("calendar.organise")}
        </button>
      </div>

      {/* proposition du planificateur */}
      {plan && (
        <section className="card mt-4 border-honey/40 p-4">
          <p className="text-sm text-ink-soft">{plan.summary}</p>
          <ul className="mt-3 space-y-2">
            {plan.items.map((it, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="label-mono w-20 flex-none">{fmtDate(it.day, { day: "numeric", month: "short" })}</span>
                <span className="flex-1">
                  {it.title}
                  <span className="text-muted"> — {it.reason}</span>
                </span>
                <button
                  className="btn-ghost !px-2 !py-1"
                  disabled={created.has(i)}
                  onClick={() => createFrom(it, i)}
                >
                  {created.has(i) ? "✓" : t("calendar.createTask")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* agenda de la semaine */}
      {tasks.isLoading && <p className="mt-6 text-sm text-muted">{t("common.loading")}</p>}
      <div className="mt-6 space-y-4">
        {byDay.length === 0 && <p className="text-sm text-muted">{t("tasks.empty")}</p>}
        {byDay.map(([day, list]) => (
          <div key={day}>
            <h2 className="label-mono">
              {day.includes("-") ? fmtDate(day, { weekday: "long", day: "numeric", month: "long" }) : day}
            </h2>
            <ul className="mt-1 space-y-1">
              {list.map((tk) => (
                <li
                  key={tk.id}
                  className="card cursor-pointer p-2.5 text-sm hover:border-honey"
                  onClick={() => tk.hiveId && navigate(`/hives/${tk.hiveId}`)}
                >
                  {tk.title}
                  <span className="label-mono ms-2">{t(`taskPriority.${tk.priority}`, tk.priority)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
