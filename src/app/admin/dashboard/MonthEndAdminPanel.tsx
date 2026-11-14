"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Plus, Trash2, GripVertical, Settings } from "lucide-react";
import {
  useMonthEndTasks,
  useAllMonthEndChecks,
  addMonthEndTask,
  updateMonthEndTask,
  deleteMonthEndTask,
} from "@/services/firebase/monthEnd";
import { getCurrentPeriod } from "@/lib/monthEnd/utils";
import type { UserProfile } from "@/services/firebase/types";

interface Props {
  users: UserProfile[];
}

export default function MonthEndAdminPanel({ users }: Props) {
  const period = getCurrentPeriod();
  const allTasks = useMonthEndTasks();
  const allChecks = useAllMonthEndChecks(period);
  const [expanded, setExpanded] = useState(false);
  const [configArea, setConfigArea] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);

  const areas = [...new Set(
    users
      .filter((u) => u.active && u.role !== "client" && u.area)
      .map((u) => u.area as string)
  )].sort();

  const checksByTaskId = new Map(allChecks.map((c) => [c.taskId, c]));

  const areaStats = areas.map((area) => {
    const tasks = allTasks.filter((t) => t.area === area && t.active);
    const done = tasks.filter((t) => checksByTaskId.has(t.id)).length;
    return { area, total: tasks.length, done };
  });

  const handleAddTask = async () => {
    if (!newTitle.trim() || !configArea) return;
    setAdding(true);
    const areaTaskCount = allTasks.filter((t) => t.area === configArea).length;
    await addMonthEndTask({
      area: configArea,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      active: true,
      order: areaTaskCount,
    });
    setNewTitle("");
    setNewDesc("");
    setAdding(false);
  };

  const [periodDisplay] = period.split("-").reverse();
  const [yearStr, monthStr] = period.split("-");
  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const monthLabel = `${monthNames[parseInt(monthStr) - 1]} ${yearStr}`;

  const configAreaTasks = configArea ? allTasks.filter((t) => t.area === configArea) : [];

  return (
    <div className="rounded-2xl border border-violet-100 bg-white shadow-[0_8px_24px_rgba(124,58,237,0.07)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Cierre de mes — {monthLabel}</p>
            <p className="text-xs text-slate-500">
              {areaStats.filter((s) => s.total > 0 && s.done === s.total).length}/{areaStats.filter((s) => s.total > 0).length} áreas completadas
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4">
          {/* Estado por área */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {areaStats.filter((s) => s.total > 0).map(({ area, total, done }) => {
              const allDone = done === total;
              return (
                <div
                  key={area}
                  className={`rounded-xl border p-3 ${allDone ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50"}`}
                >
                  <p className="text-xs font-semibold text-slate-700">{area}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                      <div
                        className={`h-1.5 rounded-full transition-all ${allDone ? "bg-emerald-500" : "bg-violet-500"}`}
                        style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${allDone ? "text-emerald-600" : "text-slate-500"}`}>
                      {done}/{total}
                    </span>
                  </div>
                  {allDone && (
                    <p className="mt-1 text-[10px] text-emerald-600">
                      ✓ {allChecks.find((c) => allTasks.find((t) => t.id === c.taskId && t.area === area))?.completedByName ?? "Listo"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Configurar área */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600">Configurar tareas por área</p>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {areas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setConfigArea(configArea === area ? null : area)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    configArea === area
                      ? "border-violet-300 bg-violet-100 text-violet-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>

            {configArea && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">{configArea}</p>
                <ul className="mb-3 space-y-1.5">
                  {configAreaTasks.length === 0 && (
                    <p className="text-xs text-slate-400">Sin tareas. Agrega la primera abajo.</p>
                  )}
                  {configAreaTasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2">
                      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${task.active ? "text-slate-700" : "text-slate-400 line-through"}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-[11px] text-slate-400">{task.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => void updateMonthEndTask(task.id, { active: !task.active })}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100"
                        >
                          {task.active ? "Ocultar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteMonthEndTask(task.id)}
                          className="rounded p-1 text-rose-400 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Agregar nueva tarea */}
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Título de la tarea"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-400"
                    onKeyDown={(e) => e.key === "Enter" && void handleAddTask()}
                  />
                  <input
                    type="text"
                    placeholder="Descripción (opcional)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-400"
                  />
                  <button
                    type="button"
                    disabled={!newTitle.trim() || adding}
                    onClick={() => void handleAddTask()}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {adding ? "Agregando..." : "Agregar tarea"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
