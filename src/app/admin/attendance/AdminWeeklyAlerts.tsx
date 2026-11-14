"use client";

import Link from "next/link";
import { Clock, TrendingDown, Mail, FileCheck, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import UserAvatar from "@/components/common/UserAvatar";

export type AlertType =
  | "open-shift"
  | "missing-hours"
  | "credit-only"
  | "pending-request"
  | "extra-activity";

export type AlertChipTone =
  | "amber" | "rose" | "emerald" | "sky" | "slate" | "indigo" | "violet" | "teal";

export type EnrichedAlertItem = {
  id: string;
  uid: string;
  level: "warning" | "info";
  source: "hours" | "requests";
  alertType: AlertType;
  title: string;
  description: string;
  personName?: string;
  personPhotoURL?: string;
  personAvatarUrl?: string;
  personProfilePhoto?: string;
  personArea?: string;
  chips?: { label: string; value: string; tone?: AlertChipTone }[];
  progressBar?: { pct: number };
  actionLabel?: string;
  actionHref?: string;
};

// ----- Ordered groups (most urgent first) -----
const ALERT_TYPE_ORDER: AlertType[] = [
  "open-shift",
  "missing-hours",
  "pending-request",
  "credit-only",
  "extra-activity",
];

type ColorKey = "rose" | "amber" | "violet" | "sky" | "teal";

type GroupConfig = {
  label: string;
  description: string;
  color: ColorKey;
  icon: LucideIcon;
};

const GROUP_CONFIG: Record<AlertType, GroupConfig> = {
  "open-shift": {
    label: "Fichajes abiertos",
    description: "Jornadas iniciadas sin salida registrada",
    color: "rose",
    icon: Clock,
  },
  "missing-hours": {
    label: "Déficit de horas",
    description: "Por debajo de la meta semanal",
    color: "amber",
    icon: TrendingDown,
  },
  "pending-request": {
    label: "Solicitudes pendientes",
    description: "Solicitudes que requieren revisión",
    color: "violet",
    icon: Mail,
  },
  "credit-only": {
    label: "Ajustes sin fichaje",
    description: "Ajustes aprobados sin registro base",
    color: "sky",
    icon: FileCheck,
  },
  "extra-activity": {
    label: "Actividades extra",
    description: "Actividades adicionales registradas",
    color: "teal",
    icon: Zap,
  },
};

const COLOR: Record<ColorKey, {
  headerBg: string;
  headerText: string;
  headerIcon: string;
  border: string;
  badge: string;
  dot: string;
  rowBorder: string;
  action: string;
  progress: string;
}> = {
  rose: {
    headerBg: "bg-rose-50",
    headerText: "text-rose-800",
    headerIcon: "text-rose-500",
    border: "border-rose-200/60",
    badge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    rowBorder: "border-rose-100",
    action: "border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
    progress: "bg-rose-400",
  },
  amber: {
    headerBg: "bg-amber-50",
    headerText: "text-amber-800",
    headerIcon: "text-amber-500",
    border: "border-amber-200/60",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    rowBorder: "border-amber-100",
    action: "border-amber-200 bg-white text-amber-700 hover:bg-amber-50",
    progress: "bg-amber-400",
  },
  violet: {
    headerBg: "bg-violet-50",
    headerText: "text-violet-800",
    headerIcon: "text-violet-500",
    border: "border-violet-200/60",
    badge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
    rowBorder: "border-violet-100",
    action: "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
    progress: "bg-violet-400",
  },
  sky: {
    headerBg: "bg-sky-50",
    headerText: "text-sky-800",
    headerIcon: "text-sky-500",
    border: "border-sky-200/60",
    badge: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
    rowBorder: "border-sky-100",
    action: "border-sky-200 bg-white text-sky-700 hover:bg-sky-50",
    progress: "bg-sky-400",
  },
  teal: {
    headerBg: "bg-teal-50",
    headerText: "text-teal-800",
    headerIcon: "text-teal-500",
    border: "border-teal-200/60",
    badge: "bg-teal-100 text-teal-700",
    dot: "bg-teal-500",
    rowBorder: "border-teal-100",
    action: "border-teal-200 bg-white text-teal-700 hover:bg-teal-50",
    progress: "bg-teal-400",
  },
};

const CHIP_CLASS: Record<AlertChipTone, string> = {
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
  indigo: "bg-indigo-100 text-indigo-700",
  violet: "bg-violet-100 text-violet-700",
  teal: "bg-teal-100 text-teal-700",
};

function PersonRow({ alert, color }: { alert: EnrichedAlertItem; color: ColorKey }) {
  const c = COLOR[color];
  const pct = alert.progressBar?.pct ?? null;

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border bg-white px-4 py-3 shadow-[0_2px_8px_rgba(17,24,39,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(17,24,39,0.08)] ${c.rowBorder}`}
    >
      <div className="flex items-center gap-3">
        <UserAvatar
          name={alert.personName ?? ""}
          photoURL={alert.personPhotoURL}
          avatarUrl={alert.personAvatarUrl}
          profilePhoto={alert.personProfilePhoto}
          sizeClassName="h-9 w-9 shrink-0"
        />
        <div className="min-w-0 flex-1">
          {alert.personName ? (
            <p className="truncate text-sm font-semibold text-slate-900">{alert.personName}</p>
          ) : null}
          {alert.personArea ? (
            <p className="truncate text-xs text-slate-500">{alert.personArea}</p>
          ) : null}
        </div>
        {alert.actionHref ? (
          <Link
            href={alert.actionHref}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-200 hover:-translate-y-0.5 ${c.action}`}
          >
            {alert.actionLabel ?? "Ver"} →
          </Link>
        ) : null}
      </div>

      {/* Mini progress bar — only for missing-hours */}
      {pct !== null ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-emerald-400" : pct >= 60 ? c.progress : "bg-rose-400"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-slate-500">{pct}%</span>
        </div>
      ) : null}

      {/* Chips */}
      {alert.chips && alert.chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {alert.chips.map((chip) => (
            <span
              key={`${chip.label}-${chip.value}`}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP_CLASS[chip.tone ?? "slate"]}`}
            >
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AlertGroup({ type, alerts }: { type: AlertType; alerts: EnrichedAlertItem[] }) {
  const config = GROUP_CONFIG[type];
  const c = COLOR[config.color];
  const Icon = config.icon;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-[0_4px_16px_rgba(17,24,39,0.06)] ${c.border}`}
    >
      <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${c.headerBg} ${c.border}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${c.badge}`}>
            <Icon size={16} className={c.headerIcon} />
          </div>
          <div>
            <p className={`text-sm font-semibold ${c.headerText}`}>{config.label}</p>
            <p className="text-[11px] text-slate-500">{config.description}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${c.badge}`}>
          {alerts.length} {alerts.length === 1 ? "persona" : "personas"}
        </span>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {alerts.map((alert) => (
          <PersonRow key={alert.id} alert={alert} color={config.color} />
        ))}
      </div>
    </div>
  );
}

// ----- Summary strip (integrated at top of groups section) -----
function SummaryStrip({ grouped }: { grouped: Map<AlertType, EnrichedAlertItem[]> }) {
  const activeTypes = ALERT_TYPE_ORDER.filter((t) => (grouped.get(t)?.length ?? 0) > 0);
  if (activeTypes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/60 bg-white px-4 py-3 shadow-[0_2px_8px_rgba(17,24,39,0.04)]">
      <span className="text-xs font-semibold text-slate-400">Resumen</span>
      <span className="h-3 w-px bg-slate-200" />
      {activeTypes.map((type) => {
        const count = grouped.get(type)?.length ?? 0;
        const config = GROUP_CONFIG[type];
        const c = COLOR[config.color];
        const Icon = config.icon;
        return (
          <span
            key={type}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.badge}`}
          >
            <Icon size={11} />
            {config.label}
            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold leading-none">
              {count}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ----- Main export -----
type AdminWeeklyAlertsProps = {
  alerts: EnrichedAlertItem[];
  loading?: boolean;
};

export default function AdminWeeklyAlerts({ alerts, loading }: AdminWeeklyAlertsProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
        {[1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  const grouped = new Map<AlertType, EnrichedAlertItem[]>();
  for (const alert of alerts) {
    const list = grouped.get(alert.alertType) ?? [];
    list.push(alert);
    grouped.set(alert.alertType, list);
  }

  const activeTypes = ALERT_TYPE_ORDER.filter((t) => (grouped.get(t)?.length ?? 0) > 0);

  if (activeTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-700">Sin alertas esta semana</p>
        <p className="mt-1 text-xs text-slate-400">Asistencia y solicitudes están al día.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SummaryStrip grouped={grouped} />
      {activeTypes.map((type) => (
        <AlertGroup key={type} type={type} alerts={grouped.get(type)!} />
      ))}
    </div>
  );
}
