"use client";

import Link from "next/link";
import { collection, onSnapshot, query, where, type DocumentData } from "firebase/firestore";
import {
  AlertCircle, AlertTriangle, ArrowRight, CalendarDays,
  CheckCircle2, Clock, LogIn, ShieldCheck, Timer,
  TrendingDown, TrendingUp, UserCheck, Users, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/services/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAdminHoursMonitor } from "@/app/admin/hours/useAdminHoursMonitor";
import {
  minutesToHHMM,
  type AdminHoursSummaryRow,
} from "@/lib/attendanceUtils";

// ── Constants ──────────────────────────────────────────────────────────────
const LATE_AFTER = "09:30"; // umbral local HH:MM para detectar tardanza

const DAY_MAP: Record<number, "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"> = {
  0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat",
};
const DAY_LABELS: Record<string, string> = {
  mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom",
};

const AREA_COLORS: Record<string, string> = {
  "Diseño":      "#7c3aed",
  "Audiovisual": "#2563eb",
  "Estrategia":  "#0891b2",
  "CM":          "#16a34a",
};
function areaColor(area?: string | null) { return AREA_COLORS[area ?? ""] ?? "#6b7280"; }

// ── Types ──────────────────────────────────────────────────────────────────
type TodayStatus = "active" | "late" | "completed" | "absent" | "off" | "pending";

const STATUS_CFG: Record<TodayStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:    { label: "En jornada",  color: "#16a34a", bg: "#dcfce7", dot: "#22c55e" },
  late:      { label: "Tardanza",    color: "#d97706", bg: "#fef3c7", dot: "#f59e0b" },
  completed: { label: "Completó",    color: "#2563eb", bg: "#dbeafe", dot: "#3b82f6" },
  absent:    { label: "Ausente",     color: "#dc2626", bg: "#fee2e2", dot: "#ef4444" },
  off:       { label: "Día libre",   color: "#6b7280", bg: "#f1f5f9", dot: "#94a3b8" },
  pending:   { label: "Por iniciar", color: "#7c3aed", bg: "#ede9fe", dot: "#a78bfa" },
};

type TodayEntry = { clockInTs: string | null; hasClockOut: boolean };
type AlertMeta  = { label: string; value: string; color?: string };
type EnrichedAlert = {
  id:          string;
  uid:         string;
  level:       "warning" | "info";
  title:       string;
  description: string;
  person?:     { name: string; area?: string | null; photoURL?: string };
  meta?:       AlertMeta[];
};

// ── Helpers ────────────────────────────────────────────────────────────────
function todayKey() { return new Date().toISOString().slice(0, 10); }

function localHHMM(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function localHHMMFromISO(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtTimeISO(iso: string) {
  try { return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }); }
  catch { return "--:--"; }
}
function fmtDate() {
  return new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}
function normalizeTs(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  const v = value as { toDate?: () => Date };
  if (v.toDate) return v.toDate().toISOString();
  return null;
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}
function pctColor(pct: number) {
  if (pct >= 100) return "#10b981";
  if (pct >= 70)  return "#4f46e5";
  if (pct >= 40)  return "#f59e0b";
  return "#ef4444";
}

function getDisplayName(user: AdminHoursSummaryRow["user"]) {
  return user.displayName || user.fullName || user.name || user.email || "Colaborador";
}
function getUserArea(user: AdminHoursSummaryRow["user"]): string | null | undefined {
  return user.area ?? user.position ?? undefined;
}
function getUserPhoto(user: AdminHoursSummaryRow["user"]): string | undefined {
  return user.photoURL || user.avatarUrl || user.profilePhoto || undefined;
}

function getTodayStatus(summary: AdminHoursSummaryRow, entry: TodayEntry, nowHHMM: string): TodayStatus {
  const expectedToday = summary.schedule?.days?.[DAY_MAP[new Date().getDay()]] ?? 0;
  if (expectedToday === 0) return "off";
  if (entry.hasClockOut) return "completed";
  if (entry.clockInTs) return localHHMMFromISO(entry.clockInTs) > LATE_AFTER ? "late" : "active";
  if (nowHHMM > LATE_AFTER) return "absent";
  return "pending";
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ photoURL, name, area, size = 48 }: {
  photoURL?: string; name: string; area?: string | null; size?: number;
}) {
  const color = areaColor(area);
  const sz = `${size}px`;
  if (photoURL) {
    return <img src={photoURL} alt={name} loading="lazy" className="rounded-full object-cover border-2 border-white shadow"
      style={{ width: sz, height: sz, flexShrink: 0 }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white border-2 border-white shadow"
      style={{ width: sz, height: sz, background: color, fontSize: size > 36 ? 14 : 11, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

// ── Team card ──────────────────────────────────────────────────────────────
function TeamCard({ summary, entry }: { summary: AdminHoursSummaryRow; entry: TodayEntry }) {
  const { user } = summary;
  const name     = getDisplayName(user);
  const photoURL = getUserPhoto(user);
  const area     = getUserArea(user);
  const color    = areaColor(area as string);
  const st       = getTodayStatus(summary, entry, localHHMM());
  const cfg      = STATUS_CFG[st];
  const pct      = summary.expectedMinutes > 0
    ? Math.min(100, Math.round(summary.totalMinutes / summary.expectedMinutes * 100)) : 0;

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_4px_16px_rgba(17,24,39,0.06)] flex flex-col gap-3 hover:shadow-[0_8px_24px_rgba(17,24,39,0.11)] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="relative">
          {photoURL
            ? <img src={photoURL} alt={name} loading="lazy" className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md" />
            : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[14px] border-2 border-white shadow-md" style={{ background: color }}>{initials(name)}</div>
          }
          {(st === "active" || st === "late") && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white animate-pulse" style={{ background: cfg.dot }} />
          )}
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-slate-900 truncate leading-tight">{name}</p>
        <p className="text-[11px] text-slate-400 truncate mt-0.5">{area ?? "—"}</p>
      </div>
      {entry.clockInTs ? (
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: st === "late" ? "#d97706" : "#64748b" }}>
          <LogIn size={10} /><span>Entró {fmtTimeISO(entry.clockInTs)}</span>
          {st === "late" && <span className="font-bold">· tarde</span>}
        </div>
      ) : st === "absent" ? (
        <div className="flex items-center gap-1.5 text-[11px] text-red-500 font-semibold"><AlertTriangle size={10} /><span>Sin registro hoy</span></div>
      ) : (
        <div className="text-[11px] text-slate-400">{st === "off" ? "No trabaja hoy" : "Aún no inicia"}</div>
      )}
      {summary.expectedMinutes > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400 font-medium">Semana</span>
            <span className="text-[10px] font-bold text-slate-600">
              {(summary.totalMinutes / 60).toFixed(1)}h / {(summary.expectedMinutes / 60).toFixed(1)}h
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: pctColor(pct) }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-slate-300">{pct}%</span>
            <span className="text-[9px] font-semibold" style={{ color: pctColor(pct) }}>{summary.status}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color = "#111827", urgent = false }: {
  label: string; value: string | number; sub?: string;
  icon: import("lucide-react").LucideIcon; color?: string; urgent?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)] ${urgent ? "ring-2 ring-red-200" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold leading-none" style={{ color }}>{value}</p>
          {sub && <p className="mt-1.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className="rounded-xl p-2.5 mt-0.5" style={{ background: `${color}14` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

// ── Alert row (compact, in the list) ──────────────────────────────────────
function AlertRow({ alert, onSelect }: { alert: EnrichedAlert; onSelect: (id: string) => void }) {
  const isWarning = alert.level === "warning";
  return (
    <button type="button" onClick={() => onSelect(alert.id)}
      className="w-full text-left rounded-xl border border-slate-100 overflow-hidden hover:border-[#7c3aed]/30 hover:shadow-[0_4px_12px_rgba(124,58,237,0.08)] transition-all duration-150 group">
      <div className="p-3 flex items-start gap-2.5">
        {/* icon */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isWarning ? "bg-amber-50" : "bg-sky-50"}`}>
          {isWarning ? <AlertTriangle size={13} className="text-amber-500" /> : <AlertCircle size={13} className="text-sky-400" />}
        </div>
        {/* body */}
        <div className="flex-1 min-w-0">
          {alert.person && (
            <div className="flex items-center gap-1.5 mb-1">
              <Avatar photoURL={alert.person.photoURL} name={alert.person.name} area={alert.person.area} size={18} />
              <span className="text-[11px] font-bold text-slate-700 truncate">{alert.person.name}</span>
              {alert.person.area && <span className="text-[9px] text-slate-400 shrink-0">· {alert.person.area}</span>}
            </div>
          )}
          <p className="text-[12px] font-bold text-slate-900 leading-tight">{alert.title}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug truncate">{alert.description}</p>
        </div>
        {/* ver detalle hint */}
        <span className="text-[10px] font-bold text-[#7c3aed] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
          Detalle →
        </span>
      </div>
    </button>
  );
}

// ── Alert detail modal ─────────────────────────────────────────────────────
function AlertDetailModal({
  alert,
  summary,
  entry,
  onClose,
}: {
  alert: EnrichedAlert;
  summary: AdminHoursSummaryRow | null;
  entry: TodayEntry;
  onClose: () => void;
}) {
  const isWarning = alert.level === "warning";
  const pct = summary && summary.expectedMinutes > 0
    ? Math.min(100, Math.round(summary.totalMinutes / summary.expectedMinutes * 100)) : 0;
  const deficit = summary ? Math.max(0, summary.expectedMinutes - summary.totalMinutes) : 0;

  // Day-by-day breakdown for weekly alerts
  const dayBreakdown = useMemo(() => {
    if (!summary?.weekRecords?.length) return [];
    return [...summary.weekRecords]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => {
        const d = new Date(r.date);
        const dayKey = DAY_MAP[d.getDay()];
        return {
          label: DAY_LABELS[dayKey] ?? dayKey,
          minutes: r.totalMinutes,
          isOpen: r.status === "OPEN",
          date: r.date,
        };
      });
  }, [summary]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* ── Cabecera persona ───────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {alert.person && (
                <>
                  <Avatar photoURL={alert.person.photoURL} name={alert.person.name} area={alert.person.area} size={52} />
                  <div>
                    <p className="text-[16px] font-bold text-slate-900 leading-tight">{alert.person.name}</p>
                    <p className="text-[12px] text-slate-400 mt-0.5">{alert.person.area ?? "Sin área asignada"}</p>
                  </div>
                </>
              )}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Cuerpo scrollable ──────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1">

          {/* Tipo de alerta + descripción */}
          <div className="px-6 py-4 border-b border-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${isWarning ? "bg-amber-50" : "bg-sky-50"}`}>
                {isWarning ? <AlertTriangle size={14} className="text-amber-500" /> : <AlertCircle size={14} className="text-sky-400" />}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isWarning ? "text-amber-600" : "text-sky-500"}`}>
                {isWarning ? "Atención" : "Información"}
              </span>
            </div>
            <p className="text-[15px] font-bold text-slate-900 leading-snug">{alert.title}</p>
            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{alert.description}</p>
          </div>

          {/* Métricas clave */}
          {alert.meta && alert.meta.length > 0 && (
            <div className="px-6 py-4 border-b border-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Datos clave</p>
              <div className="grid grid-cols-2 gap-2">
                {alert.meta.map((m, i) => (
                  <div key={i} className="bg-slate-50 rounded-2xl p-3.5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{m.label}</p>
                    <p className="text-[18px] font-bold mt-1 leading-none" style={{ color: m.color ?? "#111827" }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progreso semanal (para horas faltantes) */}
          {summary && alert.id.startsWith("attendance-missing-") && (
            <div className="px-6 py-4 border-b border-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Progreso semanal</p>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-slate-600 font-medium">
                    {minutesToHHMM(summary.totalMinutes)} de {minutesToHHMM(summary.expectedMinutes)}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: pctColor(pct) }}>{pct}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pctColor(pct) }} />
                </div>
              </div>
              {deficit > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                  <TrendingDown size={14} className="text-red-400 shrink-0" />
                  <span className="text-[12px] font-semibold text-red-600">
                    Faltan <strong>{minutesToHHMM(deficit)}</strong> para completar la semana
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Desglose por día (para horas faltantes y fichajes abiertos) */}
          {dayBreakdown.length > 0 && (
            <div className="px-6 py-4 border-b border-slate-50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Por día esta semana</p>
              <div className="flex gap-2">
                {dayBreakdown.map(({ label, minutes, isOpen, date }) => {
                  const dayPct = summary && summary.schedule
                    ? (() => {
                        const d = new Date(date);
                        const dk = DAY_MAP[d.getDay()];
                        const exp = summary.schedule.days[dk] ?? 0;
                        return exp > 0 ? Math.min(100, Math.round(minutes / exp * 100)) : 0;
                      })()
                    : 0;
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="relative w-full h-16 bg-slate-100 rounded-lg overflow-hidden flex items-end">
                        {minutes > 0 && (
                          <div className="w-full rounded-lg transition-all"
                            style={{
                              height: `${Math.max(10, dayPct)}%`,
                              background: isOpen ? "#f59e0b" : pctColor(dayPct),
                            }} />
                        )}
                        {isOpen && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <AlertTriangle size={12} className="text-amber-500" />
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">{label}</span>
                      <span className="text-[9px] font-semibold text-slate-600">
                        {minutes > 0 ? minutesToHHMM(minutes) : "—"}
                      </span>
                      {isOpen && <span className="text-[8px] text-amber-500 font-bold">Abierto</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Estado de hoy (para ausentes y tardanzas) */}
          {(alert.id.startsWith("late-") || alert.id.startsWith("absent-")) && (
            <div className="px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Registro de hoy</p>
              <div className="rounded-2xl bg-slate-50 p-4 flex flex-col gap-2.5">
                {entry.clockInTs ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#ede9fe] flex items-center justify-center">
                      <LogIn size={13} className="text-[#7c3aed]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Hora de entrada</p>
                      <p className="text-[14px] font-bold text-slate-900">{fmtTimeISO(entry.clockInTs)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                      <AlertTriangle size={13} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Estado</p>
                      <p className="text-[13px] font-bold text-red-600">Sin entrada registrada hoy</p>
                    </div>
                  </div>
                )}
                {!entry.hasClockOut && entry.clockInTs && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Clock size={13} className="text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Jornada</p>
                      <p className="text-[13px] font-bold text-emerald-700">Activa — sin salida aún</p>
                    </div>
                  </div>
                )}
                {entry.hasClockOut && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                      <CheckCircle2 size={13} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Jornada</p>
                      <p className="text-[13px] font-bold text-blue-700">Completada — salida registrada</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 text-[13px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AdminOverviewPage() {
  const today   = todayKey();
  const { user } = useAuth();
  const nowHHMM  = localHHMM();

  const { summaries, weeklyAlerts, globalKpis, loading } = useAdminHoursMonitor(user?.role);

  const [todayEntries,    setTodayEntries]    = useState<Map<string, TodayEntry>>(new Map());
  const [pendingReqs,     setPendingReqs]     = useState(0);
  const [pendingApproval, setPendingApproval] = useState<{ uid: string; displayName: string }[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "timeEntries"), where("dayKey", "==", today));
    return onSnapshot(q, snap => {
      const clockInMap  = new Map<string, string>();
      const clockOutSet = new Set<string>();
      snap.docs.forEach(d => {
        const data = d.data() as DocumentData;
        const uid  = (data.uid ?? data.userId ?? "") as string;
        const type = (data.type ?? "") as string;
        const ts   = (normalizeTs(data.ts) ?? normalizeTs(data.createdAt) ?? "") as string;
        if (!uid || !ts) return;
        if (type === "clock_in") {
          if (!clockInMap.has(uid) || ts < clockInMap.get(uid)!) clockInMap.set(uid, ts);
        } else if (type === "clock_out") { clockOutSet.add(uid); }
      });
      const map = new Map<string, TodayEntry>();
      new Set([...clockInMap.keys(), ...clockOutSet]).forEach(uid =>
        map.set(uid, { clockInTs: clockInMap.get(uid) ?? null, hasClockOut: clockOutSet.has(uid) })
      );
      setTodayEntries(map);
    }, () => setTodayEntries(new Map()));
  }, [today]);

  useEffect(() => {
    const q = query(collection(db, "hourRequests"), where("status", "==", "pending"));
    return onSnapshot(q, snap => setPendingReqs(snap.size), () => setPendingReqs(0));
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "userDirectory"), snap => {
      setPendingApproval(snap.docs
        .filter(d => !d.data().approved)
        .map(d => ({ uid: d.id, displayName: (d.data().displayName ?? "Usuario") as string }))
      );
    }, () => setPendingApproval([]));
  }, []);

  // ── Derived: today statuses ───────────────────────────────────────────
  const statuses = useMemo(() => {
    const counts: Record<TodayStatus, number> = { active: 0, late: 0, completed: 0, absent: 0, off: 0, pending: 0 };
    summaries.forEach(s => {
      counts[getTodayStatus(s, todayEntries.get(s.user.uid) ?? { clockInTs: null, hasClockOut: false }, nowHHMM)]++;
    });
    return counts;
  }, [summaries, todayEntries, nowHHMM]);

  // ── Enriched alerts: TODAY ────────────────────────────────────────────
  const todayEnrichedAlerts = useMemo((): EnrichedAlert[] => {
    const dayKey = DAY_MAP[new Date().getDay()];
    return summaries.flatMap((s): EnrichedAlert[] => {
      const entry   = todayEntries.get(s.user.uid) ?? { clockInTs: null, hasClockOut: false };
      const st      = getTodayStatus(s, entry, nowHHMM);
      const person  = { name: getDisplayName(s.user), area: getUserArea(s.user), photoURL: getUserPhoto(s.user) };

      if (st === "absent") {
        const exp = s.schedule?.days?.[dayKey] ?? 0;
        return [{ id: `absent-${s.user.uid}`, uid: s.user.uid, level: "warning" as const,
          title: "Ausente hoy", description: `${person.name} no ha registrado entrada de reloj.`,
          person, meta: [
            { label: "Área", value: person.area ?? "—" },
            { label: "Jornada esperada hoy", value: minutesToHHMM(exp) },
          ],
        }];
      }
      if (st === "late" && entry.clockInTs) {
        const lateMin = Math.max(0, Math.round(
          (new Date(entry.clockInTs).getTime() - new Date(`${today}T${LATE_AFTER}:00`).getTime()) / 60000
        ));
        return [{ id: `late-${s.user.uid}`, uid: s.user.uid, level: "info" as const,
          title: "Llegada tardía", description: `${person.name} ingresó ${lateMin} min después del inicio esperado.`,
          person, meta: [
            { label: "Ingresó", value: fmtTimeISO(entry.clockInTs) },
            { label: "Esperado", value: LATE_AFTER },
            { label: "Retraso", value: `+${lateMin} min`, color: "#d97706" },
          ],
        }];
      }
      return [];
    });
  }, [summaries, todayEntries, nowHHMM, today]);

  // ── Enriched alerts: WEEK ─────────────────────────────────────────────
  const weekEnrichedAlerts = useMemo((): EnrichedAlert[] => {
    const byUid = new Map(summaries.map(s => [s.user.uid, s]));
    return weeklyAlerts.map(a => {
      const s = byUid.get(a.uid);
      if (!s) return { ...a };
      const person = { name: getDisplayName(s.user), area: getUserArea(s.user), photoURL: getUserPhoto(s.user) };
      let meta: AlertMeta[] | undefined;
      if (a.id.startsWith("attendance-missing-")) {
        const deficit = Math.max(0, s.expectedMinutes - s.totalMinutes);
        const pct     = s.expectedMinutes > 0 ? Math.round(s.totalMinutes / s.expectedMinutes * 100) : 0;
        meta = [
          { label: "Trabajadas",  value: minutesToHHMM(s.totalMinutes) },
          { label: "Esperadas",   value: minutesToHHMM(s.expectedMinutes) },
          { label: "Faltante",    value: minutesToHHMM(deficit), color: "#ef4444" },
          { label: "Cumplimiento",value: `${pct}%`, color: pctColor(pct) },
        ];
      } else if (a.id.startsWith("attendance-open-")) {
        const open = s.weekRecords.filter(r => r.status === "OPEN").length;
        meta = [
          { label: "Fichajes abiertos", value: `${open}`, color: "#d97706" },
          { label: "Estado", value: "Entrada sin cierre" },
        ];
      }
      return { ...a, person, meta };
    });
  }, [weeklyAlerts, summaries]);

  const allAlerts    = useMemo(() => [...todayEnrichedAlerts, ...weekEnrichedAlerts], [todayEnrichedAlerts, weekEnrichedAlerts]);
  const selectedAlert   = useMemo(() => allAlerts.find(a => a.id === selectedAlertId) ?? null, [allAlerts, selectedAlertId]);
  const selectedSummary = useMemo(() => selectedAlert ? summaries.find(s => s.user.uid === selectedAlert.uid) ?? null : null, [selectedAlert, summaries]);
  const selectedEntry   = useMemo(() => (selectedAlert ? todayEntries.get(selectedAlert.uid) : undefined) ?? { clockInTs: null, hasClockOut: false }, [selectedAlert, todayEntries]);

  // ── Hours ranking ─────────────────────────────────────────────────────
  const hoursRanking = useMemo(() =>
    [...summaries].sort((a, b) => b.totalMinutes - a.totalMinutes).map(s => ({
      uid: s.user.uid, name: getDisplayName(s.user),
      pct: s.expectedMinutes > 0 ? Math.min(100, Math.round(s.totalMinutes / s.expectedMinutes * 100)) : 0,
      totalMinutes: s.totalMinutes, expectedMinutes: s.expectedMinutes,
    }))
  , [summaries]);

  const totalWorkedH   = Math.round(globalKpis.totalWorkedMinutes / 60 * 10) / 10;
  const totalExpectedH = Math.round(globalKpis.totalExpectedMinutes / 60 * 10) / 10;

  return (
    <div className="flex flex-col gap-5 p-6 min-h-full bg-[#f8fafc]">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Overview del equipo</h1>
          <p className="text-[13px] text-slate-400 mt-0.5 capitalize">{fmtDate()}</p>
        </div>
        {allAlerts.filter(a => a.level === "warning").length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 shrink-0">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-[12px] font-bold text-amber-700">
              {allAlerts.filter(a => a.level === "warning").length} alertas de atención
            </span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <KpiCard label="Equipo activo"    value={summaries.length}  sub={`${globalKpis.onTrackCount} al día esta semana`} icon={Users} />
        <KpiCard label="Ingresaron hoy"   value={statuses.active + statuses.late + statuses.completed}
          sub={`${statuses.active} en jornada ahora`} icon={LogIn} color="#7c3aed" />
        <KpiCard label="Ausentes hoy"     value={statuses.absent}
          sub={statuses.absent > 0 ? "sin fichaje de entrada" : "todos presentes"} icon={AlertTriangle}
          color={statuses.absent > 0 ? "#dc2626" : "#6b7280"} urgent={statuses.absent > 0} />
        <KpiCard label="Tardanzas hoy"    value={statuses.late}  sub={`umbral: después de ${LATE_AFTER}`} icon={Timer}
          color={statuses.late > 0 ? "#d97706" : "#6b7280"} />
        <KpiCard label="Alertas activas"  value={allAlerts.length} sub={`${pendingReqs} solicitudes pendientes`}
          icon={AlertCircle} color={allAlerts.length > 0 ? "#d97706" : "#6b7280"} />
      </div>

      {/* Cuerpo */}
      <div className="grid xl:grid-cols-[1fr_320px] gap-5">

        {/* Columna principal */}
        <div className="flex flex-col gap-5">

          {/* Team grid */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_16px_rgba(17,24,39,0.06)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2 flex-wrap">
              <Users size={15} className="text-slate-500" />
              <span className="text-[14px] font-bold text-slate-900">Equipo hoy</span>
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {(["active","late","completed","absent","off"] as TodayStatus[]).map(st => {
                  const cnt = statuses[st]; if (cnt === 0) return null;
                  const cfg = STATUS_CFG[st];
                  return (
                    <span key={st} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: cfg.bg, color: cfg.color }}>{cfg.label} {cnt}</span>
                  );
                })}
              </div>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[...Array(6)].map((_, i) => <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-44" />)}
                </div>
              ) : summaries.length === 0 ? (
                <p className="text-[13px] text-slate-400 text-center py-10">Sin colaboradores registrados.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {summaries.map(s => (
                    <TeamCard key={s.user.uid} summary={s}
                      entry={todayEntries.get(s.user.uid) ?? { clockInTs: null, hasClockOut: false }} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Horas semanales */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_16px_rgba(17,24,39,0.06)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
              <TrendingUp size={15} className="text-[#4f46e5]" />
              <span className="text-[14px] font-bold text-slate-900">Horas semanales</span>
              <span className="ml-auto text-[11px] text-slate-400">
                {totalWorkedH}h trabajadas · {totalExpectedH}h esperadas · {globalKpis.completionRate}%
              </span>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {hoursRanking.length === 0
                ? <p className="text-[13px] text-slate-400 text-center py-4">Sin datos de horas esta semana.</p>
                : hoursRanking.map(({ uid, name, pct, totalMinutes, expectedMinutes }) => {
                    const color   = pctColor(pct);
                    const deficit = Math.max(0, expectedMinutes - totalMinutes);
                    return (
                      <div key={uid} className="flex items-center gap-3">
                        <p className="text-[12px] font-semibold text-slate-700 w-32 shrink-0 truncate">{name}</p>
                        <div className="flex-1 min-w-0">
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0 w-28">
                          <span className="text-[11px] font-bold" style={{ color }}>{minutesToHHMM(totalMinutes)}</span>
                          <span className="text-[10px] text-slate-400"> / {minutesToHHMM(expectedMinutes)}</span>
                        </div>
                        {deficit > 0
                          ? <span className="text-[10px] font-bold text-red-400 w-16 text-right shrink-0 flex items-center gap-0.5 justify-end">
                              <TrendingDown size={9} /> {minutesToHHMM(deficit)}
                            </span>
                          : <span className="w-16 flex justify-end shrink-0"><CheckCircle2 size={13} className="text-emerald-500" /></span>
                        }
                      </div>
                    );
                  })
              }
            </div>
          </div>
        </div>

        {/* Sidebar derecha */}
        <div className="flex flex-col gap-5">

          {/* Alertas — agrupadas */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_16px_rgba(17,24,39,0.06)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <span className="text-[14px] font-bold text-slate-900">Alertas</span>
              {allAlerts.length > 0 && (
                <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                  {allAlerts.length}
                </span>
              )}
            </div>
            <div className="p-4 flex flex-col gap-4 max-h-[480px] overflow-y-auto">
              {allAlerts.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
                  <p className="text-[13px] font-semibold text-slate-700">Sin alertas activas</p>
                  <p className="text-[11px] text-slate-400 mt-1">El equipo está al día.</p>
                </div>
              ) : (
                <>
                  {/* Grupo: HOY */}
                  {todayEnrichedAlerts.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Hoy</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">
                          {todayEnrichedAlerts.length}
                        </span>
                      </div>
                      {todayEnrichedAlerts.map(a => <AlertRow key={a.id} alert={a} onSelect={setSelectedAlertId} />)}
                    </div>
                  )}
                  {/* Grupo: SEMANA */}
                  {weekEnrichedAlerts.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Esta semana</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                          {weekEnrichedAlerts.length}
                        </span>
                      </div>
                      {weekEnrichedAlerts.map(a => <AlertRow key={a.id} alert={a} onSelect={setSelectedAlertId} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* En jornada ahora */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_16px_rgba(17,24,39,0.06)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[14px] font-bold text-slate-900">En jornada ahora</span>
              <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                {statuses.active + statuses.late}
              </span>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {statuses.active + statuses.late === 0
                ? <p className="text-[13px] text-slate-400 text-center py-4">Nadie en jornada activa.</p>
                : summaries
                    .filter(s => { const e = todayEntries.get(s.user.uid) ?? { clockInTs: null, hasClockOut: false }; const st = getTodayStatus(s, e, nowHHMM); return st === "active" || st === "late"; })
                    .map(s => {
                      const name    = getDisplayName(s.user);
                      const area    = getUserArea(s.user);
                      const photo   = getUserPhoto(s.user);
                      const entry   = todayEntries.get(s.user.uid) ?? { clockInTs: null, hasClockOut: false };
                      const st      = getTodayStatus(s, entry, nowHHMM);
                      return (
                        <div key={s.user.uid} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                          <Avatar photoURL={photo} name={name} area={area} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-900 truncate">{name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{area ?? "—"}</p>
                          </div>
                          {entry.clockInTs && (
                            <span className={`text-[10px] font-bold shrink-0 ${st === "late" ? "text-amber-500" : "text-emerald-600"}`}>
                              {fmtTimeISO(entry.clockInTs)}
                            </span>
                          )}
                        </div>
                      );
                    })
              }
            </div>
          </div>

          {/* Sin aprobar */}
          {pendingApproval.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_16px_rgba(17,24,39,0.06)] overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <ShieldCheck size={15} className="text-amber-500" />
                <span className="text-[14px] font-bold text-slate-900">Sin aprobar</span>
                <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{pendingApproval.length}</span>
              </div>
              <div className="p-4 flex flex-col gap-1.5">
                {pendingApproval.slice(0, 4).map(p => (
                  <div key={p.uid} className="text-[12px] text-slate-700 px-3 py-2 rounded-lg bg-amber-50/60">{p.displayName}</div>
                ))}
              </div>
              <div className="px-5 pb-4">
                <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#7c3aed] hover:underline">
                  Gestionar en Usuarios <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}

          {/* Accesos rápidos */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_16px_rgba(17,24,39,0.06)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <span className="text-[14px] font-bold text-slate-900">Accesos rápidos</span>
            </div>
            <div className="p-4 flex flex-col gap-1.5">
              {[
                { href: "/admin/requests", icon: UserCheck,    label: "Solicitudes",      color: "#7c3aed" },
                { href: "/admin/hours",    icon: Clock,        label: "Monitor horarios",  color: "#2563eb" },
                { href: "/admin/calendar", icon: CalendarDays, label: "Calendario",        color: "#0891b2" },
                { href: "/admin/users",    icon: Users,        label: "Usuarios y roles",  color: "#16a34a" },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}12`, color }}>
                    <Icon size={13} />
                  </div>
                  <span className="text-[12px] font-semibold text-slate-700 flex-1">{label}</span>
                  <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de detalle de alerta */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          summary={selectedSummary}
          entry={selectedEntry}
          onClose={() => setSelectedAlertId(null)}
        />
      )}
    </div>
  );
}
