"use client";

import Link from "next/link";
import UserAvatar from "@/components/common/UserAvatar";

type SubjectUser = {
  uid: string;
  email?: string;
  displayName?: string;
  name?: string;
  fullName?: string;
  photoURL?: string;
  avatarUrl?: string;
  profilePhoto?: string;
  position?: string;
};

type SubjectChipTone = "indigo" | "emerald" | "amber" | "rose" | "slate";

type SubjectChip = {
  label: string;
  value: string;
  tone?: SubjectChipTone;
};

type SubjectActionTone = "primary" | "secondary" | "neutral";

type SubjectAction = {
  label: string;
  href: string;
  tone?: SubjectActionTone;
};

const chipToneClass: Record<SubjectChipTone, string> = {
  indigo: "bg-indigo-100 text-indigo-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
};

const actionToneClass: Record<SubjectActionTone, string> = {
  primary: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
  secondary: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  neutral: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
};

const getUserDisplayName = (user: SubjectUser) =>
  user.displayName || user.fullName || user.name || user.email || "Colaborador";

type AdminAttendanceWorkspaceSubjectProps = {
  user: SubjectUser;
  weekLabel: string;
  title?: string;
  description?: string;
  secondaryMeta?: string[];
  chips?: SubjectChip[];
  actions?: SubjectAction[];
};

export default function AdminAttendanceWorkspaceSubject({
  user,
  weekLabel,
  title = "Colaborador seleccionado",
  description,
  secondaryMeta = [],
  chips = [],
  actions = [],
}: AdminAttendanceWorkspaceSubjectProps) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <UserAvatar
            name={getUserDisplayName(user)}
            photoURL={user.photoURL}
            avatarUrl={user.avatarUrl}
            profilePhoto={user.profilePhoto}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</p>
            <p className="truncate text-lg font-semibold text-slate-900">{getUserDisplayName(user)}</p>
            <p className="text-sm text-slate-500">
              {user.position || "Sin puesto asignado"} · {weekLabel}
            </p>
            {secondaryMeta.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500">{secondaryMeta.join(" · ")}</p>
            ) : null}
            {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
          </div>
        </div>

        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                key={`${action.label}-${action.href}`}
                href={action.href}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 ${actionToneClass[action.tone ?? "neutral"]}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={`${chip.label}-${chip.value}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${chipToneClass[chip.tone ?? "slate"]}`}
            >
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
