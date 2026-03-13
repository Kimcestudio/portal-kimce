"use client";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  List,
  Mail,
  MessageCircle,
  Network,
  Plus,
  Pencil,
  Minus,
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
import { upsertCollaborator } from "@/services/finance";
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
  orgNodeType?: "root" | "leader" | "member";
  orgParentId?: string;
  orgTeam?: string;
};

type FirestoreTimestamp = {
  toDate?: () => Date;
  toMillis?: () => number;
};

type DetailTab = "personal" | "laboral" | "activos" | "personalizados";

const formatStatusLabel = (isActive?: boolean) => (isActive === false ? "Inactivo" : "Activo");

const badgeStyles = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-rose-50 text-rose-700 border border-rose-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
};

const detailTabs: Array<{ id: DetailTab; label: string }> = [
  { id: "personal", label: "Personal" },
  { id: "laboral", label: "Laboral" },
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
  const [orgZoom, setOrgZoom] = useState(100);
  const [orgPan, setOrgPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgLeaderFilter, setOrgLeaderFilter] = useState<string>("all");
  const [orgContractFilter, setOrgContractFilter] = useState<"all" | "indefinido" | "plazo_fijo" | "inactivo">("all");
  const [collapsedLeaders, setCollapsedLeaders] = useState<Set<string>>(new Set());
  const [focusedOrgNodeId, setFocusedOrgNodeId] = useState<string | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const orgNodeRefs = useRef<Record<string, HTMLElement | null>>({});

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
    employmentStartDate: "",
    contractEndDate: "",
    contractIndefinite: false,
    phone: "",
    maritalStatus: "Soltero",
    gender: "No especificado",
    bankName: "Banco de Crédito del Perú",
    accountType: "Cuenta sueldo",
    accountNumber: "**** **** 2456",
    cci: "002-2456-7890-1234",
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
            birthDate: data.birthDate ?? "",
            employmentStartDate: data.employmentStartDate ?? "",
            contractEndDate: data.contractEndDate ?? "",
            contractIndefinite: data.contractIndefinite ?? false,
            phone: data.phone ?? "",
            maritalStatus: data.maritalStatus ?? "",
            gender: data.gender ?? "",
            bankName: data.bankName ?? "",
            accountType: data.accountType ?? "",
            accountNumber: data.accountNumber ?? "",
            cci: data.cci ?? "",
            orgNodeType: (data.orgNodeType as FirestoreUser["orgNodeType"]) ?? undefined,
            orgParentId: data.orgParentId ?? "",
            orgTeam: data.orgTeam ?? "",
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

  const filteredUsersBase = useMemo(() => {
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
      });
  }, [sortedUsers, search, areaFilter, statusFilter]);

  const filteredUsers = useMemo(() => filteredUsersBase.slice(0, perPage), [filteredUsersBase, perPage]);

  const orgChart = useMemo(() => {
    const byRole = new Map<string, FirestoreUser[]>();
    filteredUsersBase.forEach((member) => {
      const key = member.role === "admin" ? "Administración" : "Colaboradores";
      const list = byRole.get(key) ?? [];
      list.push(member);
      byRole.set(key, list);
    });
    return [...byRole.entries()];
  }, [filteredUsersBase]);

  const orgUsers = useMemo(() => {
    return filteredUsersBase.filter((item) => {
      const matchesNodeSearch =
        orgSearch.trim().length === 0
          ? true
          : `${item.displayName} ${item.position ?? ""} ${item.orgTeam ?? ""}`
              .toLowerCase()
              .includes(orgSearch.toLowerCase());
      const matchesLeader = orgLeaderFilter === "all" ? true : (item.orgParentId ?? "") === orgLeaderFilter || item.uid === orgLeaderFilter;
      const matchesContract =
        orgContractFilter === "all"
          ? true
          : orgContractFilter === "indefinido"
            ? item.contractIndefinite === true
            : orgContractFilter === "plazo_fijo"
              ? item.contractIndefinite !== true
              : item.isActive === false;
      return matchesNodeSearch && matchesLeader && matchesContract;
    });
  }, [filteredUsersBase, orgContractFilter, orgLeaderFilter, orgSearch]);

  const organigramData = useMemo(() => {
    if (orgUsers.length === 0) {
      return { root: null as FirestoreUser | null, leaders: [] as FirestoreUser[], team: [] as FirestoreUser[] };
    }

    const rootCandidate =
      orgUsers.find((item) => item.orgNodeType === "root") ??
      orgUsers.find((item) => item.role === "admin") ??
      orgUsers.find((item) => /ceo|director|gerente/i.test(item.position ?? "")) ??
      orgUsers[0];

    const remaining = orgUsers.filter((item) => item.uid !== rootCandidate.uid);
    const leadersByConfig = remaining.filter((item) => item.orgNodeType === "leader");
    const leaders = leadersByConfig.length > 0 ? leadersByConfig.slice(0, 3) : remaining.slice(0, 3);
    const leaderIds = new Set(leaders.map((item) => item.uid));
    const team = remaining
      .filter((item) => !leaderIds.has(item.uid))
      .sort((a, b) => (a.orgParentId ?? "").localeCompare(b.orgParentId ?? ""))
      .slice(0, 6);

    return { root: rootCandidate, leaders, team };
  }, [orgUsers]);

  useEffect(() => {
    if (viewMode !== "organigrama") return;
    if (!orgSearch.trim()) {
      setFocusedOrgNodeId(null);
      return;
    }
    const target = orgUsers.find((item) =>
      `${item.displayName} ${item.position ?? ""} ${item.orgTeam ?? ""}`
        .toLowerCase()
        .includes(orgSearch.toLowerCase()),
    );
    if (!target) return;
    setFocusedOrgNodeId(target.uid);
    const node = orgNodeRefs.current[target.uid];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [orgSearch, orgUsers, viewMode]);

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
      birthDate: selectedUser.birthDate ?? "",
      employmentStartDate: selectedUser.employmentStartDate ?? "",
      contractEndDate: selectedUser.contractEndDate ?? "",
      contractIndefinite: selectedUser.contractIndefinite ?? false,
      phone: selectedUser.phone ?? "",
      maritalStatus: selectedUser.maritalStatus ?? "Soltero",
      gender: selectedUser.gender ?? "No especificado",
      bankName: selectedUser.bankName ?? "Banco de Crédito del Perú",
      accountType: selectedUser.accountType ?? "Cuenta sueldo",
      accountNumber: selectedUser.accountNumber ?? "**** **** 2456",
      cci: selectedUser.cci ?? "002-2456-7890-1234",
    });
  }, [selectedUser]);

  const saveDetailProfile = async () => {
    if (!selectedUser) return;
    await updateUserDoc(selectedUser.uid, {
      displayName: detailForm.displayName.trim() || selectedUser.displayName,
      email: detailForm.email.trim() || selectedUser.email,
      position: detailForm.position.trim(),
      birthDate: detailForm.birthDate,
      employmentStartDate: detailForm.employmentStartDate,
      contractEndDate: detailForm.contractIndefinite ? "" : detailForm.contractEndDate,
      contractIndefinite: detailForm.contractIndefinite,
      phone: detailForm.phone,
      maritalStatus: detailForm.maritalStatus,
      gender: detailForm.gender,
      bankName: detailForm.bankName,
      accountType: detailForm.accountType,
      accountNumber: detailForm.accountNumber,
      cci: detailForm.cci,
    });

    await upsertCollaborator(selectedUser.uid, {
      nombreCompleto: detailForm.displayName.trim() || selectedUser.displayName,
      correo: detailForm.email.trim() || selectedUser.email,
      rolPuesto: detailForm.position.trim(),
      tipoPago: "MENSUAL",
      montoBase: 0,
      moneda: "PEN",
      cuentaPagoPreferida: "LUIS",
      inicioContrato: detailForm.employmentStartDate ? new Date(detailForm.employmentStartDate).toISOString() : "",
      finContrato:
        detailForm.contractIndefinite || !detailForm.contractEndDate
          ? null
          : new Date(detailForm.contractEndDate).toISOString(),
      contratoIndefinido: detailForm.contractIndefinite,
      activo: selectedUser.isActive ?? true,
      isActive: selectedUser.isActive ?? true,
      userId: selectedUser.uid,
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

  const deleteUser = async (uid: string, displayName: string) => {
    const confirmed = window.confirm(`¿Eliminar al usuario ${displayName}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "users", uid));
      setToast({ message: "Usuario eliminado correctamente.", tone: "success" });
      setError(null);
    } catch (err) {
      console.error("[admin/users] Error deleting user", err);
      const message = err instanceof Error ? err.message : "No se pudo eliminar el usuario.";
      setError(message);
      setToast({ message, tone: "error" });
    }
  };

  const getUserStatus = (item: FirestoreUser): "active" | "inactive" | "pending" => {
    if (item.approved !== true) return "pending";
    if (item.isActive === false) return "inactive";
    return "active";
  };

  const getUserStatusLabel = (item: FirestoreUser) => {
    const status = getUserStatus(item);
    if (status === "pending") return "PENDIENTE";
    if (status === "inactive") return "INACTIVO";
    return "ACTIVO";
  };

  const toggleActive = (uid: string, nextValue: boolean) => updateUserDoc(uid, { isActive: nextValue });
  const updateRole = (uid: string, role: UserProfile["role"]) => updateUserDoc(uid, { role });
  const updatePosition = (uid: string, position: string) => updateUserDoc(uid, { position });
  const updateWorkSchedule = (uid: string, workScheduleId: string) => updateUserDoc(uid, { workScheduleId });
  const approveUser = (uid: string) => updateUserDoc(uid, { approved: true, isActive: true });
  const updateOrgNode = (
    uid: string,
    patch: Partial<Pick<FirestoreUser, "orgNodeType" | "orgParentId" | "orgTeam">>,
  ) => updateUserDoc(uid, patch as Record<string, unknown>);

  const membersByLeader = useMemo(() => {
    const map = new Map<string, FirestoreUser[]>();
    organigramData.leaders.forEach((leader) => map.set(leader.uid, []));
    organigramData.team.forEach((member) => {
      const key = member.orgParentId && map.has(member.orgParentId) ? member.orgParentId : organigramData.leaders[0]?.uid;
      if (!key) return;
      const list = map.get(key) ?? [];
      list.push(member);
      map.set(key, list);
    });
    return map;
  }, [organigramData.leaders, organigramData.team]);

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
              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                  <label className="text-xs font-semibold text-slate-600">
                    Buscar nodo
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      placeholder="Nombre, cargo o equipo"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Líder
                    <select className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" value={orgLeaderFilter} onChange={(e) => setOrgLeaderFilter(e.target.value)}>
                      <option value="all">Todos</option>
                      {organigramData.leaders.map((leader) => <option key={leader.uid} value={leader.uid}>{leader.displayName}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Contrato/Estado
                    <select className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" value={orgContractFilter} onChange={(e) => setOrgContractFilter(e.target.value as "all" | "indefinido" | "plazo_fijo" | "inactivo")}>
                      <option value="all">Todos</option>
                      <option value="indefinido">Indefinido</option>
                      <option value="plazo_fijo">Plazo fijo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </label>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Organigrama</h3>
                    <p className="text-xs text-slate-500">Vista jerárquica navegable, con edición de líderes/equipos y reasignación.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600" onClick={() => setCollapsedLeaders(new Set())}>Expandir todo</button>
                    <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600" onClick={() => setCollapsedLeaders(new Set(organigramData.leaders.map((leader) => leader.uid)))}>Contraer todo</button>
                    <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600" onClick={() => { setOrgZoom(100); setOrgPan({ x: 0, y: 0 }); }}>Centrar</button>
                    <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600" onClick={() => { setOrgZoom(85); setOrgPan({ x: 0, y: 0 }); }}>Ajustar vista</button>
                    <button type="button" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600" onClick={() => setOrgZoom((prev) => Math.max(70, prev - 10))}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-12 text-center text-xs font-semibold text-slate-500">{orgZoom}%</span>
                    <button type="button" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600" onClick={() => setOrgZoom((prev) => Math.min(140, prev + 10))}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {organigramData.root ? (
                  <div
                    className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 ${isPanning ? "cursor-grabbing" : "cursor-grab"} select-none`}
                    onMouseDown={(event) => {
                      setIsPanning(true);
                      panStartRef.current = { x: event.clientX - orgPan.x, y: event.clientY - orgPan.y };
                    }}
                    onMouseMove={(event) => {
                      if (!isPanning || !panStartRef.current) return;
                      setOrgPan({ x: event.clientX - panStartRef.current.x, y: event.clientY - panStartRef.current.y });
                    }}
                    onMouseUp={() => { setIsPanning(false); panStartRef.current = null; }}
                    onMouseLeave={() => { setIsPanning(false); panStartRef.current = null; }}
                    onWheel={(event) => {
                      event.preventDefault();
                      setOrgZoom((prev) => Math.max(60, Math.min(150, prev + (event.deltaY < 0 ? 5 : -5))));
                    }}
                  >
                    <div className="mx-auto min-w-[980px] origin-top" style={{ transform: `translate(${orgPan.x}px, ${orgPan.y}px) scale(${orgZoom / 100})` }}>
                      <div className="flex justify-center">
                        <article ref={(el) => { orgNodeRefs.current[organigramData.root!.uid] = el; }} className={`w-64 rounded-xl border bg-white p-3 shadow-sm ${focusedOrgNodeId === organigramData.root.uid ? "border-indigo-500 ring-2 ring-indigo-100" : "border-indigo-200"}`}>
                          <div className="mb-2 h-1 rounded-full bg-indigo-400" />
                          <div className="flex items-center gap-2">
                            <UserAvatar name={organigramData.root.displayName} photoURL={organigramData.root.photoURL} sizeClassName="h-10 w-10" />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{organigramData.root.displayName}</p>
                              <p className="text-xs text-slate-500">{organigramData.root.position || "Dirección"}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-end gap-2 text-slate-500">
                            <button type="button" title="Asignar como raíz" className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600" onClick={() => updateOrgNode(organigramData.root!.uid, { orgNodeType: "root", orgParentId: "" })}>RAÍZ</button>
                            <button type="button" title="Editar" className="hover:text-indigo-600" onClick={() => { setSelectedUserId(organigramData.root?.uid ?? null); setDetailTab("personal"); }}><Pencil className="h-4 w-4" /></button>
                          </div>
                        </article>
                      </div>

                      <div className="mx-auto h-10 w-px bg-slate-300" />
                      <div className="mx-auto h-px w-[70%] bg-slate-300" />

                      <div className="mt-2 grid grid-cols-3 gap-6">
                        {organigramData.leaders.map((leader) => {
                          const members = membersByLeader.get(leader.uid) ?? [];
                          const collapsed = collapsedLeaders.has(leader.uid);
                          return (
                            <div key={leader.uid} className="flex flex-col items-center">
                              <div className="h-8 w-px bg-slate-300" />
                              <article ref={(el) => { orgNodeRefs.current[leader.uid] = el; }} className={`w-64 rounded-xl border bg-white p-3 shadow-sm ${focusedOrgNodeId === leader.uid ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                                const memberUid = e.dataTransfer.getData("memberUid");
                                if (!memberUid) return;
                                updateOrgNode(memberUid, { orgNodeType: "member", orgParentId: leader.uid, orgTeam: leader.orgTeam ?? "" });
                              }}>
                                <div className="mb-2 h-1 rounded-full bg-indigo-300" />
                                <div className="flex items-center gap-2">
                                  <UserAvatar name={leader.displayName} photoURL={leader.photoURL} sizeClassName="h-9 w-9" />
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{leader.displayName}</p>
                                    <p className="text-xs text-slate-500">{leader.position || "Equipo"}</p>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center justify-end gap-2 text-slate-500">
                                  <button type="button" className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px]" onClick={() => setCollapsedLeaders((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(leader.uid)) next.delete(leader.uid); else next.add(leader.uid);
                                    return next;
                                  })}>{collapsed ? "Expandir" : "Contraer"}</button>
                                  <select className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600" value={leader.orgTeam ?? ""} onChange={(event) => updateOrgNode(leader.uid, { orgNodeType: "leader", orgTeam: event.target.value, orgParentId: organigramData.root?.uid ?? "" })}>
                                    <option value="">Sin equipo</option>
                                    {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                                  </select>
                                  <button type="button" title="Editar" className="hover:text-indigo-600" onClick={() => { setSelectedUserId(leader.uid); setDetailTab("personal"); }}><Pencil className="h-4 w-4" /></button>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-400">A cargo: {members.length}</p>
                              </article>

                              {!collapsed && members.length > 0 ? (
                                <>
                                  <div className="h-6 w-px bg-slate-300" />
                                  <div className="grid grid-cols-1 gap-2">
                                    {members.map((member) => (
                                      <article
                                        key={member.uid}
                                        ref={(el) => { orgNodeRefs.current[member.uid] = el; }}
                                        draggable
                                        onDragStart={(e) => e.dataTransfer.setData("memberUid", member.uid)}
                                        className={`w-56 rounded-xl border bg-white p-2.5 shadow-sm ${focusedOrgNodeId === member.uid ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}
                                      >
                                        <div className="mb-2 h-1 rounded-full bg-indigo-200" />
                                        <div className="flex items-center gap-2">
                                          <UserAvatar name={member.displayName} photoURL={member.photoURL} sizeClassName="h-8 w-8" />
                                          <div>
                                            <p className="line-clamp-1 text-xs font-semibold text-slate-900">{member.displayName}</p>
                                            <p className="line-clamp-1 text-[11px] text-slate-500">{member.position || "Colaborador"}</p>
                                          </div>
                                        </div>
                                        <div className="mt-2 flex flex-col gap-1">
                                          <select className="w-full rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-600" value={member.orgParentId ?? ""} onChange={(event) => updateOrgNode(member.uid, { orgNodeType: "member", orgParentId: event.target.value })}>
                                            <option value="">Sin líder</option>
                                            {organigramData.leaders.map((l) => <option key={l.uid} value={l.uid}>{l.displayName}</option>)}
                                          </select>
                                          <select className="w-full rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-600" value={member.orgTeam ?? ""} onChange={(event) => updateOrgNode(member.uid, { orgNodeType: "member", orgTeam: event.target.value })}>
                                            <option value="">Sin equipo</option>
                                            {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                                          </select>
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                </>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Sin usuarios para este filtro.</p>
                )}

                {orgChart.length > 0 ? (
                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {orgChart.map(([group, members]) => (
                      <div key={group} className="rounded-xl border border-indigo-100 bg-white px-3 py-2">
                        <p className="text-xs font-semibold text-indigo-700">{group}</p>
                        <p className="text-xs text-slate-500">{members.length} integrante(s)</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!loading && viewMode !== "organigrama" ? (
              <div className={`mt-5 ${viewMode === "cuadricula" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "space-y-3"}`}>
                {filteredUsers.map((item) => (
                  <article key={item.uid} className="rounded-xl border border-slate-300/70 bg-white p-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${badgeStyles[getUserStatus(item)]}`}>
                        {getUserStatusLabel(item)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col items-center text-center">
                      <UserAvatar name={item.displayName} photoURL={item.photoURL} sizeClassName="h-16 w-16" />
                      <p className="mt-2 line-clamp-2 text-xl leading-tight text-slate-700">{item.displayName}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{item.position || "Sin área asignada"}</p>
                      <p className="text-xs text-slate-400">{item.email}</p>
                    </div>

                    <div className="mt-3.5 flex items-center justify-center gap-3 text-slate-500">
                      <button type="button" title="Mensajes" className="hover:text-indigo-600" onClick={() => setToast({ message: "Mensajería próximamente.", tone: "success" })}>
                        <MessageCircle className="h-4.5 w-4.5" />
                      </button>
                      <button type="button" title="Documentos" className="hover:text-indigo-600" onClick={() => setToast({ message: "Documentos próximamente.", tone: "success" })}>
                        <FileText className="h-4.5 w-4.5" />
                      </button>
                      <button type="button" title="Historial" className="hover:text-indigo-600" onClick={() => { setSelectedUserId(item.uid); setDetailTab("activos"); }}>
                        <Clock3 className="h-4.5 w-4.5" />
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
                        <Pencil className="h-4.5 w-4.5" />
                      </button>
                      <button type="button" title="Desactivar" className="hover:text-amber-600" onClick={() => toggleActive(item.uid, item.isActive === false)}>
                        <UserX className="h-4.5 w-4.5" />
                      </button>
                      {item.approved !== true ? (
                        <button type="button" title="Admitir" className="text-emerald-500 hover:text-emerald-600" onClick={() => approveUser(item.uid)}>
                          <UserPlus className="h-4.5 w-4.5" />
                        </button>
                      ) : null}
                      <button type="button" title="Eliminar" className="text-rose-400 hover:text-rose-500" onClick={() => void deleteUser(item.uid, item.displayName)}>
                        <Trash2 className="h-4.5 w-4.5" />
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
                      <UserAvatar name={selectedUser.displayName} photoURL={selectedUser.photoURL} sizeClassName="h-14 w-14" />
                      <div>
                        <h3 className="text-3xl leading-tight text-slate-700">{detailForm.displayName || selectedUser.displayName}</h3>
                        <p className="text-base text-slate-400">Actualiza información del empleado</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" className="rounded-full border-2 border-teal-300 px-5 py-1 text-sm font-semibold text-teal-500" onClick={() => setSelectedUserId(null)}>
                        CANCELAR
                      </button>
                      <button type="button" className="rounded-full bg-teal-400 px-5 py-1 text-sm font-semibold text-white" onClick={() => void saveDetailProfile()}>
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
                        className={`border-b-4 pb-2 text-base font-semibold ${detailTab === tab.id ? "border-indigo-500 text-indigo-500" : "border-transparent text-slate-600"}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                    {detailTab === "personal" ? (
                      <div>
                        <h4 className="mb-2 text-2xl font-semibold text-slate-700">Información personal</h4>
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
                          <label className="text-base font-semibold text-slate-600">Inicio de contrato
                            <input type="date" className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.employmentStartDate} onChange={(e) => setDetailForm((prev) => ({ ...prev, employmentStartDate: e.target.value }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Contrato indefinido
                            <select className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.contractIndefinite ? "yes" : "no"} onChange={(e) => setDetailForm((prev) => ({ ...prev, contractIndefinite: e.target.value === "yes", contractEndDate: e.target.value === "yes" ? "" : prev.contractEndDate }))}>
                              <option value="yes">Sí</option>
                              <option value="no">No</option>
                            </select>
                          </label>
                          <label className="text-base font-semibold text-slate-600">Fin de contrato
                            <input type="date" className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.contractEndDate} onChange={(e) => setDetailForm((prev) => ({ ...prev, contractEndDate: e.target.value }))} disabled={detailForm.contractIndefinite} />
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

                        <h5 className="pt-2 text-xl font-semibold text-slate-700">Datos bancarios</h5>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="text-base font-semibold text-slate-600">Banco
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.bankName} onChange={(e) => setDetailForm((prev) => ({ ...prev, bankName: e.target.value }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Tipo de cuenta
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.accountType} onChange={(e) => setDetailForm((prev) => ({ ...prev, accountType: e.target.value }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">Número de cuenta
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.accountNumber} onChange={(e) => setDetailForm((prev) => ({ ...prev, accountNumber: e.target.value }))} />
                          </label>
                          <label className="text-base font-semibold text-slate-600">CCI
                            <input className="mt-1.5 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-base" value={detailForm.cci} onChange={(e) => setDetailForm((prev) => ({ ...prev, cci: e.target.value }))} />
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
