"use client";

import Link from "next/link";
import { collection, onSnapshot, type DocumentData } from "firebase/firestore";
import { ArrowRight, CalendarDays, Settings, ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/services/firebase/client";
import type { UserProfile } from "@/services/firebase/types";

type DirectoryAdminView = UserProfile & {
  lastSeenAt?: string;
};

function normalizeTimestamp(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  const candidate = value as { toDate?: () => Date };
  if (candidate.toDate) return candidate.toDate().toISOString();
  return null;
}

function isRecentlyOnline(person: DirectoryAdminView) {
  if (person.onlineStatus !== "online" || !person.lastSeenAt) return false;
  const lastSeen = new Date(person.lastSeenAt).getTime();
  if (Number.isNaN(lastSeen)) return false;
  return Date.now() - lastSeen <= 5 * 60 * 1000;
}

export default function AdminManagePage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<DirectoryAdminView[]>([]);

  useEffect(() => {
    const usersRef = collection(db, "userDirectory");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            uid: (data.uid ?? docSnap.id) as string,
            email: (data.email ?? "") as string,
            displayName: (data.displayName ?? "Usuario") as string,
            photoURL: (data.photoURL ?? "") as string,
            role: (data.role ?? "collab") as UserProfile["role"],
            position: (data.position ?? "") as string,
            area: (data.area ?? null) as string | null,
            active: (data.active ?? data.isActive ?? true) as boolean,
            approved: (data.approved ?? false) as boolean,
            isActive: (data.isActive ?? data.active ?? true) as boolean,
            onlineStatus: (data.onlineStatus ?? "offline") as "online" | "offline",
            lastSeenAt: (normalizeTimestamp(data.lastSeenAt) ?? data.lastSeenAt ?? "") as string,
          } satisfies DirectoryAdminView;
        });
        setPeople(next);
      },
      () => setPeople([]),
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const approved = people.filter((person) => person.approved === true);
    const active = approved.filter((person) => person.isActive !== false);
    const pending = people.filter((person) => person.approved !== true);
    const online = active.filter((person) => isRecentlyOnline(person));
    const roles = new Set(people.map((person) => person.role));
    const areas = new Set(
      people
        .map((person) => (person.area ?? person.position ?? "").trim())
        .filter(Boolean),
    );
    const incomplete = approved.filter(
      (person) =>
        !person.displayName?.trim() ||
        !person.email?.trim() ||
        !person.position?.trim() ||
        !(person.area ?? "").trim(),
    );

    return {
      total: people.length,
      active: active.length,
      pending: pending.length,
      online: online.length,
      roles: roles.size,
      areas: areas.size,
      incomplete: incomplete.length,
    };
  }, [people]);

  const pendingPeople = useMemo(
    () =>
      people
        .filter((person) => person.approved !== true)
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, 8),
    [people],
  );

  const onlineNow = useMemo(
    () =>
      people
        .filter((person) => person.approved === true && person.isActive !== false && isRecentlyOnline(person))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, 8),
    [people],
  );

  const areaBreakdown = useMemo(() => {
    const grouped = new Map<string, number>();
    people
      .filter((person) => person.approved === true && person.isActive !== false)
      .forEach((person) => {
        const key = (person.area ?? person.position ?? "").trim() || "Sin asignar";
        grouped.set(key, (grouped.get(key) ?? 0) + 1);
      });

    return Array.from(grouped.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [people]);

  const quickActions = [
    {
      href: "/admin/users",
      icon: Users,
      title: "Usuarios y roles",
      description: "Editar fichas, roles, organigrama y datos base del directorio.",
    },
    {
      href: "/admin/requests",
      icon: UserCheck,
      title: "Aprobaciones",
      description: "Revisar solicitudes pendientes que afectan horas y calendario.",
    },
    {
      href: "/admin/calendar",
      icon: CalendarDays,
      title: "Calendario global",
      description: "Crear feriados, días libres y eventos visibles para el equipo.",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Gestión del equipo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Vista administrativa para monitorear estructura, accesos y salud del directorio.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
            >
              <Settings className="h-4 w-4" />
              Abrir usuarios y roles
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Personas</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.total}</p>
          <p className="mt-1 text-sm text-slate-500">{metrics.active} activas en directorio</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">Pendientes</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{metrics.pending}</p>
          <p className="mt-1 text-sm text-slate-500">Usuarios aún no aprobados</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Conectados</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{metrics.online}</p>
          <p className="mt-1 text-sm text-slate-500">Disponibles ahora para coordinar</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">Ficha por revisar</p>
          <p className="mt-2 text-3xl font-semibold text-rose-700">{metrics.incomplete}</p>
          <p className="mt-1 text-sm text-slate-500">Perfiles aprobados con datos incompletos</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Acciones clave</h3>
                <p className="text-sm text-slate-500">Entradas rápidas a los módulos donde realmente se gestiona el equipo.</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-2xl border border-slate-200/70 p-4 transition hover:border-violet-200 hover:bg-violet-50/30"
                  >
                    <div className="flex items-center gap-2 text-violet-600">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-semibold">{item.title}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-violet-600">
                      Abrir módulo <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900">Carga por área</h3>
              <p className="text-sm text-slate-500">Resumen rápido para entender cómo está repartido el equipo activo.</p>
            </div>

            <div className="space-y-3">
              {areaBreakdown.length ? (
                areaBreakdown.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500">Colaboradores activos</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200/80 px-4 py-6 text-sm text-slate-500">
                  Aún no hay suficiente data en el directorio para mostrar áreas.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              <h3 className="text-base font-semibold text-slate-900">Pendientes de aprobación</h3>
            </div>

            <div className="space-y-3">
              {pendingPeople.length ? (
                pendingPeople.map((person) => (
                  <div key={person.uid} className="rounded-xl border border-slate-200/70 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{person.displayName}</p>
                    <p className="mt-1 text-xs text-slate-500">{person.email || "Sin correo"}</p>
                    <p className="mt-1 text-xs text-slate-500">{person.position || "Sin puesto"}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200/80 px-4 py-6 text-sm text-slate-500">
                  No hay accesos pendientes por aprobar.
                </div>
              )}
            </div>

            <Link
              href="/admin/requests"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700"
            >
              Revisar solicitudes <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-500" />
              <h3 className="text-base font-semibold text-slate-900">Conectados ahora</h3>
            </div>

            <div className="space-y-3">
              {onlineNow.length ? (
                onlineNow.map((person) => (
                  <div key={person.uid} className="rounded-xl border border-slate-200/70 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{person.displayName}</p>
                    <p className="mt-1 text-xs text-slate-500">{person.position || "Sin puesto"}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200/80 px-4 py-6 text-sm text-slate-500">
                  No hay colaboradores marcados como conectados ahora.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
