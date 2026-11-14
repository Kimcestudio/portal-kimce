"use client";

import { CheckCircle2, Circle, ClipboardList } from "lucide-react";
import {
  useMonthEndTasks,
  useMonthEndChecks,
  completeMonthEndCheck,
  uncompleteMonthEndCheck,
} from "@/services/firebase/monthEnd";
import { getCurrentPeriod } from "@/lib/monthEnd/utils";
import type { UserProfile } from "@/services/firebase/types";

interface Props {
  user: UserProfile;
}

export default function MonthEndChecklistCard({ user }: Props) {
  const area = user.area ?? "";
  const period = getCurrentPeriod();
  const tasks = useMonthEndTasks(area);
  const checks = useMonthEndChecks(area, period);

  if (!tasks.length) return null;

  const checkByTaskId = new Map(checks.map((c) => [c.taskId, c]));
  const allDone = tasks.every((t) => checkByTaskId.has(t.id));

  if (allDone) return null;

  const doneCount = tasks.filter((t) => checkByTaskId.has(t.id)).length;

  const toggle = async (taskId: string) => {
    const existing = checkByTaskId.get(taskId);
    if (existing) {
      await uncompleteMonthEndCheck(existing.id);
    } else {
      await completeMonthEndCheck(taskId, area, period, user.uid, user.displayName);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-[0_8px_24px_rgba(245,158,11,0.12)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Cierre de mes — {area}</p>
            <p className="text-xs text-slate-500">Tareas pendientes antes de cerrar el mes</p>
          </div>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
          {doneCount}/{tasks.length}
        </span>
      </div>

      {/* progress bar */}
      <div className="mb-4 h-1.5 w-full rounded-full bg-amber-100">
        <div
          className="h-1.5 rounded-full bg-amber-500 transition-all duration-500"
          style={{ width: `${tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0}%` }}
        />
      </div>

      <ul className="space-y-2">
        {tasks.map((task) => {
          const done = checkByTaskId.has(task.id);
          const check = checkByTaskId.get(task.id);
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => void toggle(task.id)}
                className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-amber-100/60"
              >
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-700"}`}>
                    {task.title}
                  </p>
                  {task.description && !done && (
                    <p className="mt-0.5 text-xs text-slate-400">{task.description}</p>
                  )}
                  {done && check && (
                    <p className="mt-0.5 text-xs text-emerald-600">
                      Completado por {check.completedByName}
                    </p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
