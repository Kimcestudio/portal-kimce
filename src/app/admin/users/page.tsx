"use client";

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  List,
  Mail,
  Network,
  Pencil,
  Search,
  Settings,
  Sparkles,
  Table2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import UserAvatar from "@/components/common/UserAvatar";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/services/firebase/client";
import type { UserProfile, WorkSchedule } from "@/services/firebase/types";
import {
  DEFAULT_WORK_SCHEDULES,
  DEFAULT_WORK_SCHEDULE_ID,
} from "@/services/firebase/workSchedules";

type FirestoreUser = UserProfile & {
  approved?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  workScheduleId?: string;
};

type FirestoreTimestamp = {
  toDate?: () => Date;
  toMillis?: () => number;
};

type DetailTab = "personal" | "empleo" | "pago" | "eventos" | "documentos" | "kardex" | "timeline" | "notas";

const formatStatusLabel = (isActive?: boolean) => (isActive === false ? "Inactivo" : "Activo");

const badgeStyles = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-rose-50 text-rose-700 border border-rose-200",
};

const detailTabs: Array<{ id: DetailTab; label: string }> = [
  { id: "personal", label: "Personal" },
  { id: "empleo", label: "Empleo" },
  { id: "pago", label: "Pago" },
  { id: "eventos", label: "Eventos" },
  { id: "documentos", label: "Documentos" },
  { id: "kardex", label: "Kardex" },
  { id: "timeline", label: "Línea de tiempo" },
  { id: "notas", label: "Notas" },
];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [workSchedulesLoading, setWorkSchedulesLoading] = useState(true);
  const [positionEdits, setPositionEdits] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const [topTab, setTopTab] = useState<"empleados" | "ia" | "config">("empleados");
  const [viewMode, setViewMode] = useState<"lista" | "cuadricula" | "organigrama">("cuadricula");
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending">("all");
  const [perPage, setPerPage] = useState<number>(8);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("personal");

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const nextUsers = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          const toTimestamp = (value: unknown) => value as FirestoreTimestamp | undefined;
          const createdAt = toTimestamp(data.createdAt)?.toDate?.()?.toISOString() ?? data.createdAt;
          const updatedAt = toTimestamp(data.updatedAt)?.toDate?.()?.toISOString() ?? data.updatedAt;
          return {
            uid: data.uid ?? docSnap.id,
            email: data.email ?? "",
            displayName: data.displayName ?? "Usuario",
            photoURL: data.photoURL ?? "",
            role: (data.role as UserProfile["role"]) ?? "collab",
            position: data.position ?? "",
            workScheduleId: data.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID,
            active: data.active ?? data.isActive ?? true,
            approved: data.approved,
            isActive: data.isActive,
            createdAt,
            updatedAt,
          };
        });
        setUsers(nextUsers);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[admin/users] Error loading users", err);
        const message = err?.message ?? "No se pudieron cargar los usuarios.";
        const code = err?.code ? ` (${err.code})` : "";
        setError(`${message}${code}`);
        setToast({ message: `${message}${code}`, tone: "error" });
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const schedulesRef = collection(db, "workSchedules");
    const unsubscribe = onSnapshot(
      schedulesRef,
      async (snapshot) => {
        if (snapshot.empty) {
          try {
            await Promise.all(
              DEFAULT_WORK_SCHEDULES.map((schedule) =>
                setDoc(
                  doc(db, "workSchedules", schedule.id),
                  {
                    name: schedule.name,
                    weeklyMinutes: schedule.weeklyMinutes,
                    days: schedule.days,
                  },
                  { merge: true }
                )
              )
            );
          } catch (seedError) {
            console.error("[admin/users] Error seeding work schedules", seedError);
            const message =
              seedError instanceof Error
                ? seedError.message
                : "No se pudieron crear las jornadas.";
            setToast({ message, tone: "error" });
          }
        }
        const nextSchedules = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            id: docSnap.id,
            name: data.name ?? "Sin nombre",
            weeklyMinutes: typeof data.weeklyMinutes === "number" ? data.weeklyMinutes : 0,
            days: (data.days as WorkSchedule["days"]) ?? DEFAULT_WORK_SCHEDULES[0].days,
          };
        });
        setWorkSchedules(nextSchedules);
        setWorkSchedulesLoading(false);
      },
      (err) => {
        console.error("[admin/users] Error loading work schedules", err);
        const message = err?.message ?? "No se pudieron cargar las jornadas.";
        const code = err?.code ? ` (${err.code})` : "";
        setToast({ message: `${message}${code}`, tone: "error" });
        setWorkSchedulesLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user?.role]);

  const sortedUsers = useMemo(() => {
    const getSortableValue = (item: FirestoreUser) => {
      if (item.createdAt) {
        const createdAtMs = Date.parse(item.createdAt);
        if (!Number.isNaN(createdAtMs)) return createdAtMs;
      }
      return item.email.toLowerCase();
    };
    return [...users].sort((a, b) => {
      const aValue = getSortableValue(a);
      const bValue = getSortableValue(b);
      if (typeof aValue === "number" && typeof bValue === "number") return bValue - aValue;
      if (typeof aValue === "string" && typeof bValue === "string") return aValue.localeCompare(bValue);
      return 0;
    });
  }, [users]);

  const scheduleOptions = useMemo(
    () => (workSchedules.length > 0 ? workSchedules : DEFAULT_WORK_SCHEDULES),
    [workSchedules]
  );

  const areaOptions = useMemo(() => {
    const areas = sortedUsers.map((item) => (item.position ?? "").trim()).filter(Boolean);
    return [...new Set(areas)];
  }, [sortedUsers]);

  const filteredUsers = useMemo(() => {
    return sortedUsers
      .filter((item) => {
        const matchesSearch =
          item.displayName.toLowerCase().includes(search.toLowerCase()) ||
          item.email.toLowerCase().includes(search.toLowerCase());
        const matchesArea = areaFilter === "all" || (item.position ?? "") === areaFilter;
        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "pending"
              ? item.approved !== true
              : statusFilter === "active"
                ? item.isActive !== false
                : item.isActive === false;
        return matchesSearch && matchesArea && matchesStatus;
      })
      .slice(0, perPage);
  }, [sortedUsers, search, areaFilter, statusFilter, perPage]);

  const orgChart = useMemo(() => {
    const byRole = new Map<string, FirestoreUser[]>();
    filteredUsers.forEach((member) => {
      const key = member.role === "admin" ? "Administración" : "Colaboradores";
      const list = byRole.get(key) ?? [];
      list.push(member);
      byRole.set(key, list);
    });
    return [...byRole.entries()];
  }, [filteredUsers]);

  const selectedUser = useMemo(
    () => (selectedUserId ? sortedUsers.find((item) => item.uid === selectedUserId) ?? null : null),
    [selectedUserId, sortedUsers],
  );

  const updateUserDoc = async (uid: string, payload: Record<string, unknown>) => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      setToast({ message: "Cambios guardados.", tone: "success" });
      setError(null);
    } catch (err) {
      console.error("[admin/users] Error updating user", err);
      const message = err instanceof Error ? err.message : "No se pudieron guardar los cambios.";
      setError(message);
      setToast({ message, tone: "error" });
    }
  };

  const toggleActive = (uid: string, nextValue: boolean) => updateUserDoc(uid, { isActive: nextValue });
  const updateRole = (uid: string, role: UserProfile["role"]) => updateUserDoc(uid, { role });
  const updatePosition = (uid: string, position: string) => updateUserDoc(uid, { position });
  const updateWorkSchedule = (uid: string, workScheduleId: string) => updateUserDoc(uid, { workScheduleId });
  const approveUser = (uid: string) => updateUserDoc(uid, { approved: true, isActive: true });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          No tienes permisos para ver esta sección.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap gap-6 border-b border-slate-200 pb-3">
          {[
            { key: "empleados", label: "Empleados", icon: Users },
            { key: "ia", label: "Asistente de IA", icon: Sparkles },
            { key: "config", label: "Configuración", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = topTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTopTab(tab.key as "empleados" | "ia" | "config")}
                className={`inline-flex items-center gap-2 border-b-2 pb-2 text-sm font-semibold transition ${
                  active ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {topTab !== "empleados" ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
            {topTab === "ia" ? "Próximamente: panel de asistente IA para RRHH." : "Próximamente: configuración avanzada de usuarios y roles."}
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Empleados</h2>
                <p className="text-sm text-slate-500">{sortedUsers.length} empleados en total</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "lista", label: "Lista", icon: List },
                  { key: "cuadricula", label: "Cuadrícula", icon: Table2 },
                  { key: "organigrama", label: "Organigrama", icon: Network },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = viewMode === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setViewMode(item.key as "lista" | "cuadricula" | "organigrama")}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </button>
                  );
                })}
                <button className="ml-1 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)]">
                  <UserPlus className="h-4 w-4" /> AGREGAR EMPLEADO
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-semibold text-slate-600">
                Buscar
                <span className="mt-1 flex items-center rounded-xl border border-slate-200 px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    className="ml-2 w-full bg-transparent text-sm font-normal outline-none"
                    placeholder="Nombre o correo"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </span>
              </label>

              <label className="text-xs font-semibold text-slate-600">
                Área
                <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                  <option value="all">Todas</option>
                  {areaOptions.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-600">
                Estado
                <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive" | "pending")}>
                  <option value="all">Todos</option>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="pending">Pendiente</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-600">
                Por página
                <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                  {[8, 12, 24, 50].map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
            {toast ? (
              <div className={`mt-3 rounded-xl border px-4 py-2 text-xs font-semibold ${toast.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {toast.message}
              </div>
            ) : null}

            {loading ? <p className="mt-4 text-sm text-slate-500">Cargando usuarios...</p> : null}

            {!loading && viewMode === "organigrama" ? (
              <div className="mt-5 space-y-4">
                {orgChart.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Sin usuarios para este filtro.</p> : null}
                {orgChart.map(([group, members]) => (
                  <div key={group} className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
                    <h3 className="text-sm font-semibold text-indigo-800">{group}</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {members.map((member) => (
                        <article key={member.uid} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={member.displayName} photoURL={member.photoURL} sizeClassName="h-10 w-10" />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{member.displayName}</p>
                              <p className="text-xs text-slate-500">{member.position || "Sin área"}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && viewMode !== "organigrama" ? (
              <div className={`mt-5 ${viewMode === "cuadricula" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "space-y-3"}`}>
                {filteredUsers.map((item) => (
                  <article key={item.uid} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(17,24,39,0.05)]">
                    <div className="flex items-center justify-between">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.isActive === false ? badgeStyles.inactive : badgeStyles.active}`}>
                        {formatStatusLabel(item.isActive)}
                      </span>
                      <div className="flex items-center gap-1">
                        <select
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px]"
                          value={item.role ?? "collab"}
                          onChange={(event) => updateRole(item.uid, event.target.value as UserProfile["role"])}
                        >
                          <option value="admin">Admin</option>
                          <option value="collab">Colab</option>
                        </select>
                        <button
                          type="button"
                          className="rounded-lg border border-indigo-200 bg-indigo-50 p-1.5 text-indigo-600 hover:bg-indigo-100"
                          onClick={() => {
                            setSelectedUserId(item.uid);
                            setDetailTab("personal");
                          }}
                          aria-label="Editar usuario"
                          title="Editar usuario"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col items-center text-center">
                      <UserAvatar name={item.displayName} photoURL={item.photoURL} sizeClassName="h-16 w-16" />
                      <p className="mt-2 text-lg font-semibold text-slate-900">{item.displayName}</p>
                      <p className="text-xs text-slate-500">{item.email}</p>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        placeholder="Área / puesto"
                        value={positionEdits[item.uid] ?? item.position ?? ""}
                        onChange={(event) => setPositionEdits((prev) => ({ ...prev, [item.uid]: event.target.value }))}
                        onBlur={(event) => {
                          const nextValue = event.target.value.trim();
                          if ((item.position ?? "") === nextValue) return;
                          updatePosition(item.uid, nextValue);
                        }}
                      />

                      <select
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        value={item.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID}
                        onChange={(event) => updateWorkSchedule(item.uid, event.target.value)}
                        disabled={workSchedulesLoading}
                      >
                        {scheduleOptions.map((schedule) => (
                          <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                        Activo
                        <input
                          className="peer sr-only"
                          type="checkbox"
                          checked={item.isActive !== false}
                          onChange={(event) => toggleActive(item.uid, event.target.checked)}
                        />
                        <span className="flex h-5 w-9 items-center rounded-full bg-slate-200 p-0.5 transition peer-checked:bg-emerald-500">
                          <span className="h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                        </span>
                      </label>
                      {item.approved !== true ? (
                        <button className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700" type="button" onClick={() => approveUser(item.uid)}>
                          Aprobar
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}

                {filteredUsers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No hay usuarios para los filtros seleccionados.</p>
                ) : null}
              </div>
            ) : null}

            {selectedUser ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setSelectedUserId(null)}>
                <section
                  className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/40 p-5 shadow-[0_24px_48px_rgba(15,23,42,0.24)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <UserAvatar name={selectedUser.displayName} photoURL={selectedUser.photoURL} sizeClassName="h-20 w-20" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-3xl font-semibold text-indigo-950">{selectedUser.displayName}</h3>
                          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                            {selectedUser.role === "admin" ? "Administrador" : "Empleado"}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                          <p className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-indigo-500" />{selectedUser.email || "Sin correo"}</p>
                          <p className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-indigo-500" />{selectedUser.position || "Sin área"}</p>
                          <p className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-indigo-500" />{formatStatusLabel(selectedUser.isActive)}</p>
                          <p className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-indigo-500" />{selectedUser.createdAt?.slice(0, 10) ?? "Sin fecha"}</p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500"
                      onClick={() => setSelectedUserId(null)}
                    >
                      <X className="mr-1 inline h-3.5 w-3.5" /> Cerrar
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                    {detailTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDetailTab(tab.id)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${detailTab === tab.id ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    {detailTab === "personal" ? (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <h4 className="text-xl font-semibold text-slate-900">INFORMACIÓN BÁSICA</h4>
                          <Pencil className="h-4 w-4 text-indigo-500" />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-sm font-semibold text-slate-600">Nombre
                            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" value={selectedUser.displayName ?? ""} readOnly />
                          </label>
                          <label className="text-sm font-semibold text-slate-600">Correo corporativo
                            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" value={selectedUser.email ?? ""} readOnly />
                          </label>
                          <label className="text-sm font-semibold text-slate-600">Área / Puesto
                            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" value={selectedUser.position ?? ""} readOnly />
                          </label>
                          <label className="text-sm font-semibold text-slate-600">Rol
                            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" value={selectedUser.role === "admin" ? "Administrador" : "Colaborador"} readOnly />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                        Contenido de la pestaña <strong>{detailTabs.find((t) => t.id === detailTab)?.label}</strong> preparado para integrar datos reales.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
