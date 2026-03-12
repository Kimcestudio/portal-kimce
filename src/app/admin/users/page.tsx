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
  Clock3,
  FileText,
  List,
  Mail,
  MessageCircle,
  Network,
  Pencil,
  Search,
  Settings,
  Sparkles,
  Table2,
  Trash2,
  UserPlus,
  UserX,
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

type DetailTab = "personal" | "laboral" | "bancaria" | "activos" | "personalizados";

const formatStatusLabel = (isActive?: boolean) => (isActive === false ? "Inactivo" : "Activo");

const badgeStyles = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-rose-50 text-rose-700 border border-rose-200",
};

const detailTabs: Array<{ id: DetailTab; label: string }> = [
  { id: "personal", label: "Personal" },
  { id: "laboral", label: "Laboral" },
  { id: "bancaria", label: "Bancaria" },
  { id: "activos", label: "Activos" },
  { id: "personalizados", label: "Personalizados" },
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
  const [detailForm, setDetailForm] = useState({
    displayName: "",
    email: "",
    position: "",
    firstName: "",
    lastName: "",
    middleName: "",
    birthDate: "",
    phone: "",
    maritalStatus: "Soltero",
    gender: "No especificado",
  });

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

  useEffect(() => {
    if (!selectedUser) return;
    const parts = (selectedUser.displayName ?? "").trim().split(/\s+/);
    setDetailForm({
      displayName: selectedUser.displayName ?? "",
      email: selectedUser.email ?? "",
      position: selectedUser.position ?? "",
      firstName: parts[0] ?? "",
      lastName: parts[1] ?? "",
      middleName: parts.slice(2).join(" "),
      birthDate: (selectedUser as any).birthDate ?? "",
      phone: (selectedUser as any).phone ?? "",
      maritalStatus: (selectedUser as any).maritalStatus ?? "Soltero",
      gender: (selectedUser as any).gender ?? "No especificado",
    });
  }, [selectedUser]);

  const saveDetailProfile = async () => {
    if (!selectedUser) return;
    await updateUserDoc(selectedUser.uid, {
      displayName: detailForm.displayName.trim() || selectedUser.displayName,
      email: detailForm.email.trim() || selectedUser.email,
      position: detailForm.position.trim(),
      birthDate: detailForm.birthDate,
      phone: detailForm.phone,
      maritalStatus: detailForm.maritalStatus,
      gender: detailForm.gender,
    });
  };

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
                  <article key={item.uid} className="rounded-2xl border border-slate-300/70 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-teal-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                        {item.isActive === false ? "INACTIVO" : "ACTIVO"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col items-center text-center">
                      <UserAvatar name={item.displayName} photoURL={item.photoURL} sizeClassName="h-20 w-20" />
                      <p className="mt-2 line-clamp-2 text-2xl leading-tight text-slate-700">{item.displayName}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{item.position || "Sin área asignada"}</p>
                      <p className="text-xs text-slate-400">{item.email}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-4 text-slate-500">
                      <button type="button" title="Mensajes" className="hover:text-indigo-600" onClick={() => setToast({ message: "Mensajería próximamente.", tone: "success" })}>
                        <MessageCircle className="h-5 w-5" />
                      </button>
                      <button type="button" title="Documentos" className="hover:text-indigo-600" onClick={() => setToast({ message: "Documentos próximamente.", tone: "success" })}>
                        <FileText className="h-5 w-5" />
                      </button>
                      <button type="button" title="Historial" className="hover:text-indigo-600" onClick={() => { setSelectedUserId(item.uid); setDetailTab("activos"); }}>
                        <Clock3 className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="hover:text-indigo-600"
                        onClick={() => {
                          setSelectedUserId(item.uid);
                          setDetailTab("personal");
                        }}
                        aria-label="Editar usuario"
                        title="Editar usuario"
                      >
                        <Pencil className="h-5 w-5" />
                      </button>
                      <button type="button" title="Desactivar" className="hover:text-amber-600" onClick={() => toggleActive(item.uid, item.isActive === false)}>
                        <UserX className="h-5 w-5" />
                      </button>
                      <button type="button" title="Eliminar" className="text-rose-400 hover:text-rose-500" onClick={() => setToast({ message: "Eliminación disponible en próxima iteración.", tone: "error" })}>
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </article>
                ))}

                {filteredUsers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No hay usuarios para los filtros seleccionados.</p>
                ) : null}
              </div>
            ) : null}

            {selectedUser ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3" onClick={() => setSelectedUserId(null)}>
                <section
                  className="max-h-[84vh] w-full max-w-4xl overflow-auto rounded-3xl border border-indigo-100 bg-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.25)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <UserAvatar name={selectedUser.displayName} photoURL={selectedUser.photoURL} sizeClassName="h-24 w-24" />
                      <div>
                        <h3 className="text-4xl leading-tight text-slate-700">{detailForm.displayName || selectedUser.displayName}</h3>
                        <p className="text-xl text-slate-400">Actualiza información del empleado</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" className="rounded-full border-2 border-teal-300 px-6 py-1.5 text-base font-semibold text-teal-500" onClick={() => setSelectedUserId(null)}>
                        CANCELAR
                      </button>
                      <button type="button" className="rounded-full bg-teal-400 px-6 py-1.5 text-base font-semibold text-white" onClick={() => void saveDetailProfile()}>
                        ACTUALIZAR EMPLEADO
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-4 border-b border-slate-200 pb-2">
                    {detailTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDetailTab(tab.id)}
                        className={`border-b-4 pb-2 text-lg font-semibold ${detailTab === tab.id ? "border-indigo-500 text-indigo-500" : "border-transparent text-slate-600"}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                    {detailTab === "personal" ? (
                      <div>
                        <h4 className="mb-3 text-3xl font-semibold text-slate-700">Información personal</h4>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="text-base font-semibold text-slate-600">Nombre
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.firstName} onChange={(e) => setDetailForm((prev) => ({ ...prev, firstName: e.target.value, displayName: `${e.target.value} ${prev.lastName} ${prev.middleName}`.trim() }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Apellido paterno
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.lastName} onChange={(e) => setDetailForm((prev) => ({ ...prev, lastName: e.target.value, displayName: `${prev.firstName} ${e.target.value} ${prev.middleName}`.trim() }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Apellido materno
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.middleName} onChange={(e) => setDetailForm((prev) => ({ ...prev, middleName: e.target.value, displayName: `${prev.firstName} ${prev.lastName} ${e.target.value}`.trim() }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Fecha de nacimiento
                            <input type="date" className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.birthDate} onChange={(e) => setDetailForm((prev) => ({ ...prev, birthDate: e.target.value }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Correo
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.email} onChange={(e) => setDetailForm((prev) => ({ ...prev, email: e.target.value }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Teléfono
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.phone} onChange={(e) => setDetailForm((prev) => ({ ...prev, phone: e.target.value }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Estado civil
                            <select className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.maritalStatus} onChange={(e) => setDetailForm((prev) => ({ ...prev, maritalStatus: e.target.value }))}>
                              <option>Soltero</option><option>Casado</option><option>Divorciado</option><option>Viudo</option>
                            </select>
                          </label>
                          <label className="text-base font-semibold text-slate-600">Género
                            <select className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.gender} onChange={(e) => setDetailForm((prev) => ({ ...prev, gender: e.target.value }))}>
                              <option>Masculino</option><option>Femenino</option><option>No especificado</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    ) : detailTab === "laboral" ? (
                      <div className="space-y-4">
                        <h4 className="mb-1 text-3xl font-semibold text-slate-700">Información laboral</h4>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="text-base font-semibold text-slate-600">Área / puesto
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.position} onChange={(e) => setDetailForm((prev) => ({ ...prev, position: e.target.value }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Rol en sistema
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={selectedUser.role === "admin" ? "Administrador" : "Colaborador"} readOnly />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Jornada
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={scheduleOptions.find((s) => s.id === selectedUser.workScheduleId)?.name ?? "Sin jornada"} readOnly />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Estado
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={formatStatusLabel(selectedUser.isActive)} readOnly />
                          </label>
                        </div>

                        <h5 className="pt-2 text-xl font-semibold text-slate-700">Datos salariales (referencial)</h5>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="text-base font-semibold text-slate-600">Tipo de pago
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value="Mensual" readOnly />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Moneda
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value="PEN" readOnly />
                          </label>
                        </div>

                        <h5 className="pt-2 text-xl font-semibold text-slate-700">Contactos laborales</h5>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="text-base font-semibold text-slate-600">Correo corporativo
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.email} onChange={(e) => setDetailForm((prev) => ({ ...prev, email: e.target.value }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Teléfono laboral
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.phone} onChange={(e) => setDetailForm((prev) => ({ ...prev, phone: e.target.value }))} />
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
