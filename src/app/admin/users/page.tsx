"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { atomicUserWrite } from "@/lib/user/syncProfile";
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
import Modal from "@/components/attendance/Modal";
import UserAvatar from "@/components/common/UserAvatar";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/services/firebase/client";
import type { UserProfile, WorkSchedule } from "@/services/firebase/types";
import { deleteCollaborator, upsertCollaborator } from "@/services/finance";
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

type OrgTeamRecord = {
  id: string;
  name: string;
};

type OrgConfirmModalState = {
  open: boolean;
  title: string;
  lines: string[];
  confirmLabel: string;
  tone: "indigo" | "amber";
  onConfirm: (() => Promise<void> | void) | null;
};

type DetailTab = "personal" | "laboral" | "activos" | "personalizados";
type MonitorSourceView = "hours" | "requests" | "attendance";

const formatStatusLabel = (isActive?: boolean) => (isActive === false ? "Inactivo" : "Activo");
const getRecordTime = (value?: string) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const badgeStyles = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-rose-50 text-rose-700 border border-rose-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
};

const orgConfirmToneStyles = {
  indigo: {
    panel: "border-indigo-200 bg-indigo-50/70",
    badge: "bg-indigo-100 text-indigo-700",
    button: "bg-indigo-600 hover:bg-indigo-700",
  },
  amber: {
    panel: "border-amber-200 bg-amber-50/80",
    badge: "bg-amber-100 text-amber-800",
    button: "bg-amber-600 hover:bg-amber-700",
  },
} as const;

const detailTabs: Array<{ id: DetailTab; label: string }> = [
  { id: "personal", label: "Personal" },
  { id: "laboral", label: "Laboral" },
  { id: "activos", label: "Activos" },
  { id: "personalizados", label: "Personalizados" },
];

function buildDirectoryPayload(user: FirestoreUser, payload: Record<string, unknown>) {
  return {
    uid: user.uid,
    email: (payload.email as string | undefined) ?? user.email ?? "",
    displayName: (payload.displayName as string | undefined) ?? user.displayName ?? "Usuario",
    photoURL: user.photoURL ?? "",
    role: (payload.role as UserProfile["role"] | undefined) ?? user.role ?? "collab",
    position: (payload.position as string | undefined) ?? user.position ?? "",
    area: (payload.area as string | undefined) ?? (user.area ?? null),
    workScheduleId:
      (payload.workScheduleId as string | undefined) ?? user.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID,
    active:
      (payload.active as boolean | undefined) ??
      (payload.isActive as boolean | undefined) ??
      user.active ??
      user.isActive ??
      true,
    approved: (payload.approved as boolean | undefined) ?? user.approved ?? false,
    isActive:
      (payload.isActive as boolean | undefined) ??
      (payload.active as boolean | undefined) ??
      user.isActive ??
      user.active ??
      true,
    birthDate: (payload.birthDate as string | undefined) ?? user.birthDate ?? "",
    employmentStartDate:
      (payload.employmentStartDate as string | undefined) ?? user.employmentStartDate ?? "",
    updatedAt: serverTimestamp(),
  };
}

function getDashboardDataIssues(user: FirestoreUser) {
  const issues: string[] = [];

  if (!user.displayName?.trim()) issues.push("Sin nombre");
  if (!user.email?.trim()) issues.push("Sin correo");
  if (!user.position?.trim()) issues.push("Sin area/puesto");
  if (!user.workScheduleId?.trim()) issues.push("Sin jornada");
  if (!user.birthDate?.trim()) issues.push("Sin cumpleanos");
  if (!user.employmentStartDate?.trim()) issues.push("Sin fecha de ingreso");
  if (user.approved !== true) issues.push("Pendiente de aprobacion");
  if (user.isActive === false) issues.push("Inactivo");

  return issues;
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [orgTeams, setOrgTeams] = useState<OrgTeamRecord[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [workSchedulesLoading, setWorkSchedulesLoading] = useState(true);
  const [positionEdits, setPositionEdits] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [syncingDirectory, setSyncingDirectory] = useState(false);

  const [topTab, setTopTab] = useState<"empleados" | "ia" | "config">("empleados");
  const [viewMode, setViewMode] = useState<"lista" | "cuadricula" | "organigrama">("cuadricula");
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending">("all");
  const [perPage, setPerPage] = useState<number>(8);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgLeaderFilter, setOrgLeaderFilter] = useState<string>("all");
  const [orgContractFilter, setOrgContractFilter] = useState<"all" | "indefinido" | "plazo_fijo" | "inactivo">("all");
  const [organigramView, setOrganigramView] = useState<"editor" | "mapa">("editor");
  const [collapsedLeaders, setCollapsedLeaders] = useState<Set<string>>(new Set());
  const [focusedOrgNodeId, setFocusedOrgNodeId] = useState<string | null>(null);
  const [draggedOrgNodeId, setDraggedOrgNodeId] = useState<string | null>(null);
  const [dragOverOrgTargetId, setDragOverOrgTargetId] = useState<string | null>(null);
  const orgNodeRefs = useRef<Record<string, HTMLElement | null>>({});
  const [newOrgTeamName, setNewOrgTeamName] = useState("");
  const [orgConfirmModal, setOrgConfirmModal] = useState<OrgConfirmModalState>({
    open: false,
    title: "",
    lines: [],
    confirmLabel: "Confirmar",
    tone: "indigo",
    onConfirm: null,
  });
  const [orgConfirming, setOrgConfirming] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("personal");
  const [detailForm, setDetailForm] = useState({
    displayName: "",
    email: "",
    position: "",
    workScheduleId: DEFAULT_WORK_SCHEDULE_ID,
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

  const monitorSourceParam = searchParams.get("from");
  const monitorWeekParam = searchParams.get("week");
  const monitorUserParam = searchParams.get("user");

  const monitorSourceView: MonitorSourceView | null =
    monitorSourceParam === "hours" ||
    monitorSourceParam === "requests" ||
    monitorSourceParam === "attendance"
      ? monitorSourceParam
      : null;

  const monitorReturnHref =
    monitorSourceView && monitorWeekParam && monitorUserParam
      ? `/admin/${monitorSourceView}?user=${encodeURIComponent(monitorUserParam)}&week=${encodeURIComponent(
          monitorWeekParam,
        )}`
      : null;

  const monitorReturnLabel =
    monitorSourceView === "hours"
      ? "Volver a Asistencia"
      : monitorSourceView === "requests"
        ? "Volver a Solicitudes"
        : monitorSourceView === "attendance"
          ? "Volver a Alertas"
          : "Volver al monitoreo";

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const userParam = searchParams.get("user");
    const tabParam = searchParams.get("tab");

    if (userParam) {
      setSelectedUserId(userParam);
    }

    if (tabParam === "personal" || tabParam === "laboral" || tabParam === "activos" || tabParam === "personalizados") {
      setDetailTab(tabParam);
    }
  }, [searchParams]);

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
    const teamsRef = collection(db, "orgTeams");
    const unsubscribe = onSnapshot(
      teamsRef,
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as DocumentData;
            return {
              id: docSnap.id,
              name: (data.name ?? "") as string,
            } satisfies OrgTeamRecord;
          })
          .filter((item) => item.name.trim())
          .sort((a, b) => a.name.localeCompare(b.name));
        setOrgTeams(next);
      },
      (err) => {
        console.error("[admin/users] Error loading org teams", err);
        setOrgTeams([]);
      },
    );
    return () => unsubscribe();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const schedulesRef = collection(db, "workSchedules");
    const unsubscribe = onSnapshot(
      schedulesRef,
      async (snapshot) => {
        const existingIds = new Set(snapshot.docs.map((docSnap) => docSnap.id));
        const missingSchedules = DEFAULT_WORK_SCHEDULES.filter((schedule) => !existingIds.has(schedule.id));

        if (snapshot.empty || missingSchedules.length > 0) {
          try {
            await Promise.all(
              (snapshot.empty ? DEFAULT_WORK_SCHEDULES : missingSchedules).map((schedule) =>
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

  const orgTeamOptions = useMemo(() => {
    const existingTeamNames = sortedUsers.map((item) => (item.orgTeam ?? "").trim()).filter(Boolean);
    const catalogNames = orgTeams.map((item) => item.name.trim()).filter(Boolean);
    return [...new Set([...catalogNames, ...existingTeamNames, ...areaOptions])].sort((a, b) => a.localeCompare(b));
  }, [areaOptions, orgTeams, sortedUsers]);

  const dashboardAudit = useMemo(() => {
    const relevantUsers = sortedUsers.filter((item) => item.role === "collab");
    const incomplete = relevantUsers
      .map((item) => ({
        ...item,
        issues: getDashboardDataIssues(item),
      }))
      .filter((item) => item.issues.length > 0);

    const readyCount = relevantUsers.length - incomplete.length;

    return {
      total: relevantUsers.length,
      readyCount,
      incomplete,
    };
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
      return {
        root: null as FirestoreUser | null,
        leaders: [] as FirestoreUser[],
        team: [] as FirestoreUser[],
      };
    }

    const configuredRoots = [...orgUsers]
      .filter((item) => item.orgNodeType === "root")
      .sort(
        (a, b) =>
          getRecordTime(b.updatedAt ?? b.createdAt) - getRecordTime(a.updatedAt ?? a.createdAt),
      );

    const rootCandidate =
      configuredRoots[0] ??
      orgUsers.find((item) => item.role === "admin") ??
      orgUsers.find((item) => /ceo|director|gerente/i.test(item.position ?? "")) ??
      orgUsers[0];

    const remaining = orgUsers.filter((item) => item.uid !== rootCandidate.uid);
    const leadersByConfig = remaining.filter(
      (item) => item.orgNodeType === "leader" || item.orgNodeType === "root",
    );
    const fallbackLeaders = remaining.filter(
      (item) =>
        (item.orgParentId ?? "") === rootCandidate.uid ||
        /lider|lead|coordinador|jefe|gerente/i.test(item.position ?? ""),
    );
    const leaders =
      (leadersByConfig.length > 0 ? leadersByConfig : fallbackLeaders).slice(0, 6);
    const leaderIds = new Set(leaders.map((item) => item.uid));

    const team = remaining
      .filter((item) => !leaderIds.has(item.uid))
      .sort((a, b) => (a.orgParentId ?? "").localeCompare(b.orgParentId ?? ""))
      .slice(0, 60);

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
      workScheduleId: selectedUser.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID,
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
      workScheduleId: detailForm.workScheduleId || DEFAULT_WORK_SCHEDULE_ID,
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
      const currentUser = users.find((item) => item.uid === uid);
      if (!currentUser) {
        throw new Error("No se encontró el usuario seleccionado.");
      }
      await atomicUserWrite(uid, payload, buildDirectoryPayload(currentUser, payload));
      setToast({ message: "Cambios guardados.", tone: "success" });
      setError(null);
    } catch (err) {
      console.error("[admin/users] Error updating user", err);
      const message = err instanceof Error ? err.message : "No se pudieron guardar los cambios.";
      setError(message);
      setToast({ message, tone: "error" });
    }
  };

  const syncUserDirectory = async () => {
    if (users.length === 0) {
      setToast({ message: "No hay usuarios para sincronizar.", tone: "error" });
      return;
    }

    try {
      setSyncingDirectory(true);
      let batch = writeBatch(db);
      let operations = 0;

      for (const item of users) {
        const ref = doc(db, "userDirectory", item.uid);
        batch.set(ref, buildDirectoryPayload(item, {}), { merge: true });
        operations += 1;

        if (operations === 400) {
          await batch.commit();
          batch = writeBatch(db);
          operations = 0;
        }
      }

      if (operations > 0) {
        await batch.commit();
      }

      setToast({
        message: `Directorio público sincronizado para ${users.length} usuario(s).`,
        tone: "success",
      });
    } catch (err) {
      console.error("[admin/users] Error syncing userDirectory", err);
      const message =
        err instanceof Error ? err.message : "No se pudo sincronizar el directorio público.";
      setToast({ message, tone: "error" });
    } finally {
      setSyncingDirectory(false);
    }
  };

  const deleteUser = async (uid: string, displayName: string) => {
    const confirmed = window.confirm(`¿Eliminar al usuario ${displayName}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", uid));
      batch.delete(doc(db, "userDirectory", uid));
      await batch.commit();
      await deleteCollaborator(uid);
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

  const promoteToLeader = async (member: FirestoreUser) => {
    const rootUid = organigramData.root?.uid ?? "";
    if (!rootUid) return;
    await updateOrgNode(member.uid, {
      orgNodeType: "leader",
      orgParentId: rootUid,
      orgTeam: member.orgTeam ?? member.position ?? "",
    });
  };

  const moveLeaderTeam = async (fromLeaderUid: string, toLeaderUid: string) => {
    if (!fromLeaderUid || !toLeaderUid || fromLeaderUid === toLeaderUid) return;

    const members = membersByLeader.get(fromLeaderUid) ?? [];
    if (members.length === 0) {
      setToast({ message: "Ese líder no tiene integrantes para mover.", tone: "error" });
      return;
    }

    try {
      const targetLeader = organigramData.leaders.find((item) => item.uid === toLeaderUid) ?? null;
      const targetTeam = targetLeader?.orgTeam ?? "";

      for (const member of members) {
        await updateOrgNode(member.uid, {
          orgNodeType: "member",
          orgParentId: toLeaderUid,
          orgTeam: targetTeam || member.orgTeam || "",
        });
      }

      setToast({
        message: `Se movieron ${members.length} integrante(s) al nuevo líder.`,
        tone: "success",
      });
    } catch (err) {
      console.error("[admin/users] Error moving team between leaders", err);
      setToast({
        message: err instanceof Error ? err.message : "No se pudo mover el equipo completo.",
        tone: "error",
      });
    }
  };

  const createOrgTeam = async () => {
    const normalized = newOrgTeamName.trim();
    if (!normalized) {
      setToast({ message: "Escribe un nombre para el equipo.", tone: "error" });
      return;
    }
    if (orgTeamOptions.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      setToast({ message: "Ese equipo ya existe.", tone: "error" });
      return;
    }

    try {
      await addDoc(collection(db, "orgTeams"), {
        name: normalized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewOrgTeamName("");
      setToast({ message: "Equipo creado correctamente.", tone: "success" });
    } catch (err) {
      console.error("[admin/users] Error creating org team", err);
      setToast({
        message: err instanceof Error ? err.message : "No se pudo crear el equipo.",
        tone: "error",
      });
    }
  };

  const deleteOrgTeam = async (teamName: string) => {
    const affectedUsers = users.filter((item) => (item.orgTeam ?? "").trim() === teamName);
    if (affectedUsers.length > 0) {
      setToast({
        message: "No puedes eliminar un equipo que aún está asignado a personas.",
        tone: "error",
      });
      return;
    }

    const target = orgTeams.find((item) => item.name === teamName);
    if (!target) return;

    try {
      await deleteDoc(doc(db, "orgTeams", target.id));
      setToast({ message: "Equipo eliminado.", tone: "success" });
    } catch (err) {
      console.error("[admin/users] Error deleting org team", err);
      setToast({
        message: err instanceof Error ? err.message : "No se pudo eliminar el equipo.",
        tone: "error",
      });
    }
  };

  const closeOrgConfirmModal = () => {
    if (orgConfirming) return;
    setOrgConfirmModal({
      open: false,
      title: "",
      lines: [],
      confirmLabel: "Confirmar",
      tone: "indigo",
      onConfirm: null,
    });
  };

  const openOrgConfirmModal = (payload: Omit<OrgConfirmModalState, "open">) => {
    setOrgConfirmModal({
      open: true,
      ...payload,
    });
  };

  const handleConfirmOrgAction = async () => {
    if (!orgConfirmModal.onConfirm) return;
    try {
      setOrgConfirming(true);
      await orgConfirmModal.onConfirm();
      closeOrgConfirmModal();
    } finally {
      setOrgConfirming(false);
    }
  };

  const assignSingleRoot = async (member: FirestoreUser) => {
    const previousRoots = users.filter((item) => item.orgNodeType === "root" && item.uid !== member.uid);

    try {
      const batch = writeBatch(db);

      for (const previousRoot of previousRoots) {
        batch.update(doc(db, "users", previousRoot.uid), {
          orgNodeType: "leader",
          orgParentId: member.uid,
          updatedAt: serverTimestamp(),
        });
        batch.set(
          doc(db, "userDirectory", previousRoot.uid),
          buildDirectoryPayload(previousRoot, {
            orgNodeType: "leader",
            orgParentId: member.uid,
          }),
          { merge: true },
        );
      }

      batch.update(doc(db, "users", member.uid), {
        orgNodeType: "root",
        orgParentId: "",
        updatedAt: serverTimestamp(),
      });
      batch.set(
        doc(db, "userDirectory", member.uid),
        buildDirectoryPayload(member, {
          orgNodeType: "root",
          orgParentId: "",
        }),
        { merge: true },
      );

      await batch.commit();

      setToast({
        message:
          previousRoots.length > 0
            ? `${member.displayName} ahora es la raíz principal. La raíz anterior quedó reasignada.`
            : `${member.displayName} ahora es la raíz principal.`,
        tone: "success",
      });
      setError(null);
    } catch (err) {
      console.error("[admin/users] Error assigning single root", err);
      const message = err instanceof Error ? err.message : "No se pudo actualizar la raíz del organigrama.";
      setError(message);
      setToast({ message, tone: "error" });
    }
  };

  const handleMapDropToRoot = async () => {
    if (!draggedOrgNodeId) return;
    const target = users.find((item) => item.uid === draggedOrgNodeId);
    setDragOverOrgTargetId(null);
    setDraggedOrgNodeId(null);
    if (!target) return;
    await confirmSetRoot(target);
  };

  const handleMapDropToLeader = async (leader: FirestoreUser) => {
    if (!draggedOrgNodeId || draggedOrgNodeId === leader.uid) return;

    const dragged = users.find((item) => item.uid === draggedOrgNodeId);
    setDragOverOrgTargetId(null);
    setDraggedOrgNodeId(null);

    if (!dragged) return;

    if (dragged.orgNodeType === "leader") {
      openOrgConfirmModal({
        title: "Reasignar líder",
        confirmLabel: "Mover bajo este líder",
        tone: "amber",
        lines: [
          `Vas a mover a ${dragged.displayName} debajo de ${leader.displayName}.`,
          "Seguirá conservando a su equipo actual hasta que decidas redistribuirlo.",
        ],
        onConfirm: async () => {
          await updateOrgNode(dragged.uid, {
            orgNodeType: "member",
            orgParentId: leader.uid,
            orgTeam: leader.orgTeam ?? dragged.orgTeam ?? "",
          });
        },
      });
      return;
    }

    await updateOrgNode(dragged.uid, {
      orgNodeType: "member",
      orgParentId: leader.uid,
      orgTeam: leader.orgTeam ?? dragged.orgTeam ?? "",
    });
  };

  const confirmSetRoot = async (member: FirestoreUser) => {
    if (member.orgNodeType === "root") {
      setToast({ message: `${member.displayName} ya es el nodo raíz actual.`, tone: "success" });
      return;
    }

    const currentRootName = organigramData.root?.displayName ?? "Sin raíz definida";
    const currentLeaderName =
      organigramData.leaders.find((leader) => leader.uid === member.orgParentId)?.displayName ??
      (member.orgParentId ? "Otro líder" : "Sin líder asignado");
    openOrgConfirmModal({
      title: "Confirmar cambio de raíz",
      confirmLabel: "Convertir en raíz",
      tone: "indigo",
      lines: [
        `Vas a convertir a ${member.displayName} en nodo raíz.`,
        `Raíz actual: ${currentRootName}`,
        `Ubicación actual: ${member.orgNodeType === "leader" ? "Líder" : "Miembro"}${member.orgNodeType === "member" ? ` bajo ${currentLeaderName}` : ""}`,
        "Esto cambiará la referencia principal del organigrama.",
        "La raíz anterior dejará de ser raíz automáticamente para evitar duplicados.",
      ],
      onConfirm: async () => {
        await assignSingleRoot(member);
      },
    });
  };

  const confirmDemoteLeader = async (leader: FirestoreUser) => {
    const teamMembers = membersByLeader.get(leader.uid) ?? [];
    const targetRootName = organigramData.root?.displayName ?? "la raíz actual";
    openOrgConfirmModal({
      title: "Confirmar cambio de líder",
      confirmLabel: "Bajar a miembro",
      tone: "amber",
      lines: [
        `Vas a bajar a ${leader.displayName} de líder a miembro.`,
        `Nuevo reporte: ${targetRootName}`,
        teamMembers.length > 0
          ? `Integrantes actualmente a cargo: ${teamMembers.length}. Seguirán asignados hasta que los reubiques.`
          : "No tiene integrantes asignados.",
      ],
      onConfirm: async () => {
        await updateOrgNode(leader.uid, {
          orgNodeType: "member",
          orgParentId: organigramData.root?.uid ?? "",
        });
      },
    });
  };

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

  const unassignedOrgMembers = useMemo(
    () =>
      organigramData.team.filter(
        (member) =>
          !member.orgParentId || !organigramData.leaders.some((leader) => leader.uid === member.orgParentId),
      ),
    [organigramData.leaders, organigramData.team],
  );

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
    <div className="flex flex-col gap-3">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      {/* ── Top toolbar: tabs + add ── */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "empleados", label: "Empleados", icon: Users },
          { key: "ia", label: "Asistente IA", icon: Sparkles },
          { key: "config", label: "Configuración", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = topTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTopTab(tab.key as "empleados" | "ia" | "config")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-400">{sortedUsers.length} usuarios</span>
          <button className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700">
            <UserPlus className="h-3.5 w-3.5" /> Agregar empleado
          </button>
        </div>
      </div>

      {topTab !== "empleados" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            {topTab === "ia" ? "Próximamente: panel de asistente IA para RRHH." : "Próximamente: configuración avanzada de usuarios y roles."}
          </div>
        </div>
      ) : (
        <>
          {/* ── Compact filters toolbar ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
              <Search className="h-3 w-3 shrink-0 text-slate-400" />
              <input
                className="w-44 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Nombre o correo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 outline-none"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <option value="all">Todas las áreas</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>

            {(["all", "active", "inactive", "pending"] as const).map((s) => {
              const labels = { all: "Todos", active: "Activos", inactive: "Inactivos", pending: "Pendientes" };
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    statusFilter === s
                      ? "bg-slate-800 text-white"
                      : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {labels[s]}
                </button>
              );
            })}

            <select
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 outline-none"
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
            >
              {[8, 12, 24, 50].map((count) => (
                <option key={count} value={count}>{count} por página</option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-1">
              {[
                { key: "lista", icon: List },
                { key: "cuadricula", icon: Table2 },
                { key: "organigrama", icon: Network },
              ].map((item) => {
                const Icon = item.icon;
                const active = viewMode === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setViewMode(item.key as "lista" | "cuadricula" | "organigrama")}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                      active ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Audit / toast ── */}
          {dashboardAudit.incomplete.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    {dashboardAudit.incomplete.length} con datos faltantes
                  </span>
                  <p className="text-xs text-amber-800">
                    {dashboardAudit.readyCount} de {dashboardAudit.total} colaboradores listos para el dashboard
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void syncUserDirectory()}
                  disabled={syncingDirectory}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                >
                  {syncingDirectory ? "Sincronizando..." : "Sincronizar directorio"}
                </button>
              </div>
              <div className="divide-y divide-amber-100 border-t border-amber-200">
                {dashboardAudit.incomplete.slice(0, 6).map((item) => (
                  <button
                    key={item.uid}
                    type="button"
                    onClick={() => { setSelectedUserId(item.uid); setDetailTab("personal"); }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-amber-100/50"
                  >
                    <p className="text-xs font-semibold text-slate-800">{item.displayName || item.email || item.uid}</p>
                    <span className="text-[11px] text-amber-700">{item.issues.join(" · ")}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                Todos los colaboradores tienen los datos mínimos para el dashboard
              </span>
              <button
                type="button"
                onClick={() => void syncUserDirectory()}
                disabled={syncingDirectory}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {syncingDirectory ? "Sincronizando..." : "Sincronizar directorio"}
              </button>
            </div>
          )}

          {toast ? (
            <div className={`rounded-lg border px-4 py-2 text-xs font-semibold ${toast.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {toast.message}
            </div>
          ) : null}
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}

          {loading ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <p className="px-5 py-10 text-center text-sm text-slate-400">Cargando usuarios...</p>
            </div>
          ) : null}

          {!loading && viewMode === "organigrama" ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
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
                    <p className="text-xs text-slate-500">
                      {organigramView === "editor"
                        ? "Editor de estructura por roles, líderes y equipos. Menos mover nodos, más asignar bien."
                        : "Vista tipo mapa para entender rápido la estructura y las relaciones del equipo."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                      {[
                        { key: "editor", label: "Editor" },
                        { key: "mapa", label: "Mapa" },
                      ].map((item) => {
                        const active = organigramView === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setOrganigramView(item.key as "editor" | "mapa")}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              active ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                    {organigramView === "editor" ? (
                      <>
                        <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600" onClick={() => setCollapsedLeaders(new Set())}>Expandir equipos</button>
                        <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600" onClick={() => setCollapsedLeaders(new Set(organigramData.leaders.map((leader) => leader.uid)))}>Contraer equipos</button>
                      </>
                    ) : null}
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                      1 raíz · {organigramData.leaders.length} líderes · {organigramData.team.length} miembros
                    </div>
                  </div>
                </div>

                <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="min-w-[240px] flex-1 text-xs font-semibold text-slate-600">
                      Crear equipo o unidad
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                        value={newOrgTeamName}
                        onChange={(e) => setNewOrgTeamName(e.target.value)}
                        placeholder="Ej. Producción audiovisual"
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                      onClick={() => void createOrgTeam()}
                    >
                      Crear equipo
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {orgTeamOptions.length > 0 ? (
                      orgTeamOptions.map((team) => {
                        const assignedCount = users.filter((item) => (item.orgTeam ?? "").trim() === team).length;
                        const isCatalogTeam = orgTeams.some((item) => item.name === team);
                        return (
                          <div key={team} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            <span>{team}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500">{assignedCount}</span>
                            {isCatalogTeam ? (
                              <button
                                type="button"
                                className="text-rose-500 hover:text-rose-600"
                                onClick={() => void deleteOrgTeam(team)}
                                title="Eliminar equipo"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-500">Aún no hay equipos creados.</p>
                    )}
                  </div>
                </div>

                {organigramData.root ? (
                  organigramView === "editor" ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={organigramData.root.displayName} photoURL={organigramData.root.photoURL} sizeClassName="h-12 w-12" />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{organigramData.root.displayName}</p>
                            <p className="text-xs text-slate-500">{organigramData.root.position || "Dirección"}</p>
                            <p className="mt-1 text-[11px] font-medium text-indigo-600">Nodo raíz</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            title="Editar"
                            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                            onClick={() => {
                              setSelectedUserId(organigramData.root?.uid ?? null);
                              setDetailTab("personal");
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            title="Asignar como raíz"
                            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                            onClick={() => void confirmSetRoot(organigramData.root!)}
                          >
                            Marcar raíz
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                          onClick={() => {
                            setSelectedUserId(organigramData.root?.uid ?? null);
                            setDetailTab("laboral");
                          }}
                        >
                          Editar estructura
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      {organigramData.leaders.map((leader) => {
                        const members = (membersByLeader.get(leader.uid) ?? []).sort((a, b) =>
                          a.displayName.localeCompare(b.displayName),
                        );
                        const collapsed = collapsedLeaders.has(leader.uid);

                        return (
                          <section
                            key={leader.uid}
                            ref={(el) => {
                              orgNodeRefs.current[leader.uid] = el;
                            }}
                            className={`rounded-2xl border bg-slate-50/40 p-4 ${
                              focusedOrgNodeId === leader.uid ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <UserAvatar name={leader.displayName} photoURL={leader.photoURL} sizeClassName="h-11 w-11" />
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{leader.displayName}</p>
                                  <p className="text-xs text-slate-500">{leader.position || "Líder"}</p>
                                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                                    {members.length} integrante(s) a cargo
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                                  onClick={() =>
                                    setCollapsedLeaders((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(leader.uid)) next.delete(leader.uid);
                                      else next.add(leader.uid);
                                      return next;
                                    })
                                  }
                                >
                                  {collapsed ? "Expandir" : "Contraer"}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                                  onClick={() => {
                                    setSelectedUserId(leader.uid);
                                    setDetailTab("personal");
                                  }}
                                >
                                  Editar
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                                onClick={() => void confirmSetRoot(leader)}
                              >
                                Convertir en raíz
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                onClick={() => {
                                  setSelectedUserId(leader.uid);
                                  setDetailTab("laboral");
                                }}
                              >
                                Abrir ficha laboral
                              </button>
                            </div>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <label className="text-[11px] font-semibold text-slate-600">
                                Equipo
                                <select
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                                  value={leader.orgTeam ?? ""}
                                  onChange={(event) =>
                                    updateOrgNode(leader.uid, {
                                      orgNodeType: "leader",
                                      orgTeam: event.target.value,
                                      orgParentId: organigramData.root?.uid ?? "",
                                    })
                                  }
                                >
                                  <option value="">Sin equipo</option>
                                  {orgTeamOptions.map((area) => (
                                    <option key={area} value={area}>
                                      {area}
                                    </option>
                                  ))}
                                  </select>
                                </label>

                              <label className="text-[11px] font-semibold text-slate-600">
                                Tipo de nodo
                                <select
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                                  value={leader.orgNodeType ?? "leader"}
                                  onChange={(event) =>
                                    updateOrgNode(leader.uid, {
                                      orgNodeType: event.target.value as FirestoreUser["orgNodeType"],
                                      orgParentId:
                                        event.target.value === "root" ? "" : organigramData.root?.uid ?? "",
                                    })
                                  }
                                >
                                  <option value="leader">Líder</option>
                                  <option value="member">Miembro</option>
                                  <option value="root">Raíz</option>
                                  </select>
                                </label>
                            </div>

                            {organigramData.leaders.length > 1 ? (
                              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                                <label className="text-[11px] font-semibold text-slate-600">
                                  Mover todo el equipo a otro líder
                                  <select
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                                    defaultValue=""
                                    onChange={(event) => {
                                      const targetUid = event.target.value;
                                      if (!targetUid) return;
                                      void moveLeaderTeam(leader.uid, targetUid);
                                      event.target.value = "";
                                    }}
                                  >
                                    <option value="">Seleccionar líder</option>
                                    {organigramData.leaders
                                      .filter((item) => item.uid !== leader.uid)
                                      .map((item) => (
                                        <option key={item.uid} value={item.uid}>
                                          {item.displayName}
                                        </option>
                                      ))}
                                  </select>
                                </label>
                                <div className="flex items-end">
                                  <button
                                    type="button"
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                                    onClick={() => void confirmDemoteLeader(leader)}
                                  >
                                    Bajar a miembro
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                                  onClick={() => void confirmDemoteLeader(leader)}
                                >
                                  Bajar a miembro
                                </button>
                              </div>
                            )}

                            {!collapsed ? (
                              <div className="mt-4 space-y-2">
                                {members.length > 0 ? (
                                  members.map((member) => (
                                    <article
                                      key={member.uid}
                                      ref={(el) => {
                                        orgNodeRefs.current[member.uid] = el;
                                      }}
                                      className={`rounded-xl border bg-white px-3 py-3 ${
                                        focusedOrgNodeId === member.uid
                                          ? "border-indigo-400 ring-2 ring-indigo-100"
                                          : "border-slate-200"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                          <UserAvatar name={member.displayName} photoURL={member.photoURL} sizeClassName="h-9 w-9" />
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900">{member.displayName}</p>
                                            <p className="truncate text-xs text-slate-500">{member.position || "Colaborador"}</p>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600"
                                          onClick={() => {
                                            setSelectedUserId(member.uid);
                                            setDetailTab("personal");
                                          }}
                                        >
                                          Editar
                                        </button>
                                      </div>

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                          onClick={() => void promoteToLeader(member)}
                                        >
                                          Promover a líder
                                        </button>
                                        <button
                                          type="button"
                                          className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                                          onClick={() => void confirmSetRoot(member)}
                                        >
                                          Convertir en raíz
                                        </button>
                                      </div>

                                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <label className="text-[11px] font-semibold text-slate-600">
                                          Líder
                                          <select
                                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700"
                                            value={member.orgParentId ?? ""}
                                            onChange={(event) =>
                                              updateOrgNode(member.uid, {
                                                orgNodeType: "member",
                                                orgParentId: event.target.value,
                                              })
                                            }
                                          >
                                            <option value="">Sin líder</option>
                                            {organigramData.leaders.map((item) => (
                                              <option key={item.uid} value={item.uid}>
                                                {item.displayName}
                                              </option>
                                            ))}
                                          </select>
                                        </label>

                                        <label className="text-[11px] font-semibold text-slate-600">
                                          Equipo
                                          <select
                                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700"
                                            value={member.orgTeam ?? ""}
                                            onChange={(event) =>
                                              updateOrgNode(member.uid, {
                                                orgNodeType: "member",
                                                orgTeam: event.target.value,
                                              })
                                            }
                                          >
                                            <option value="">Sin equipo</option>
                                            {orgTeamOptions.map((area) => (
                                              <option key={area} value={area}>
                                                {area}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      </div>
                                    </article>
                                  ))
                                ) : (
                                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                                    Este líder todavía no tiene integrantes asignados.
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </section>
                        );
                      })}
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-amber-900">Sin asignación clara</h4>
                          <p className="text-xs text-amber-800">
                            Personas sin líder definido o fuera de los filtros actuales de liderazgo.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
                          {unassignedOrgMembers.length}
                        </span>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {unassignedOrgMembers.length > 0 ? (
                          unassignedOrgMembers.map((member) => (
                            <article key={member.uid} className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                              <div className="flex items-center gap-3">
                                <UserAvatar name={member.displayName} photoURL={member.photoURL} sizeClassName="h-9 w-9" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{member.displayName}</p>
                                  <p className="truncate text-xs text-slate-500">{member.position || "Colaborador"}</p>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-2">
                                <label className="text-[11px] font-semibold text-slate-600">
                                  Asignar líder
                                  <select
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700"
                                    value={member.orgParentId ?? ""}
                                    onChange={(event) =>
                                      updateOrgNode(member.uid, {
                                        orgNodeType: "member",
                                        orgParentId: event.target.value,
                                      })
                                    }
                                  >
                                    <option value="">Sin líder</option>
                                    {organigramData.leaders.map((leader) => (
                                      <option key={leader.uid} value={leader.uid}>
                                        {leader.displayName}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700"
                                    onClick={() => void promoteToLeader(member)}
                                  >
                                    Promover a líder
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-xs font-semibold text-indigo-600"
                                    onClick={() => void confirmSetRoot(member)}
                                  >
                                    Hacer raíz
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-600"
                                    onClick={() => {
                                      setSelectedUserId(member.uid);
                                      setDetailTab("personal");
                                    }}
                                  >
                                    Abrir ficha
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-amber-200 bg-white px-4 py-6 text-sm text-amber-800 md:col-span-2 xl:col-span-3">
                            Todo el equipo filtrado ya tiene una asignación visible dentro del organigrama.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  ) : (
                    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex justify-center">
                        <div
                          ref={(el) => {
                            orgNodeRefs.current[organigramData.root!.uid] = el;
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDragOverOrgTargetId(`root:${organigramData.root!.uid}`);
                          }}
                          onDragLeave={() => setDragOverOrgTargetId((prev) => (prev === `root:${organigramData.root!.uid}` ? null : prev))}
                          onDrop={(event) => {
                            event.preventDefault();
                            void handleMapDropToRoot();
                          }}
                          className={`w-full max-w-md rounded-2xl border bg-indigo-50/70 p-4 text-center transition ${
                            focusedOrgNodeId === organigramData.root!.uid
                              ? "border-indigo-400 ring-2 ring-indigo-100"
                              : "border-indigo-200"
                          } ${
                            dragOverOrgTargetId === `root:${organigramData.root!.uid}` ? "scale-[1.02] border-indigo-500 ring-2 ring-indigo-200" : ""
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <UserAvatar
                              name={organigramData.root.displayName}
                              photoURL={organigramData.root.photoURL}
                              sizeClassName="h-14 w-14"
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{organigramData.root.displayName}</p>
                              <p className="text-xs text-slate-500">{organigramData.root.position || "Dirección"}</p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-indigo-700">
                              Nodo raíz
                            </span>
                            <button
                              type="button"
                              className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                              onClick={() => {
                                setSelectedUserId(organigramData.root?.uid ?? null);
                                setDetailTab("personal");
                              }}
                            >
                              Abrir ficha
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <div className="h-8 w-px bg-indigo-200" />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {organigramData.leaders.map((leader) => {
                          const members = (membersByLeader.get(leader.uid) ?? []).sort((a, b) =>
                            a.displayName.localeCompare(b.displayName),
                          );
                          const teamsForLeader = new Map<string, FirestoreUser[]>();
                          members.forEach((member) => {
                            const key = member.orgTeam?.trim() || "Sin equipo";
                            const list = teamsForLeader.get(key) ?? [];
                            list.push(member);
                            teamsForLeader.set(key, list);
                          });
                          const groupedTeams = [...teamsForLeader.entries()].sort(([a], [b]) =>
                            a.localeCompare(b),
                          );

                          return (
                            <section
                              key={leader.uid}
                              ref={(el) => {
                                orgNodeRefs.current[leader.uid] = el;
                              }}
                              onDragOver={(event) => {
                                event.preventDefault();
                                setDragOverOrgTargetId(`leader:${leader.uid}`);
                              }}
                              onDragLeave={() => setDragOverOrgTargetId((prev) => (prev === `leader:${leader.uid}` ? null : prev))}
                              onDrop={(event) => {
                                event.preventDefault();
                                void handleMapDropToLeader(leader);
                              }}
                              className={`rounded-2xl border bg-slate-50/50 p-4 transition ${
                                focusedOrgNodeId === leader.uid
                                  ? "border-indigo-400 ring-2 ring-indigo-100"
                                  : "border-slate-200"
                              } ${
                                dragOverOrgTargetId === `leader:${leader.uid}` ? "scale-[1.01] border-indigo-400 ring-2 ring-indigo-100" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div
                                  className="flex cursor-grab items-center gap-3"
                                  draggable
                                  onDragStart={() => setDraggedOrgNodeId(leader.uid)}
                                  onDragEnd={() => {
                                    setDraggedOrgNodeId(null);
                                    setDragOverOrgTargetId(null);
                                  }}
                                >
                                  <UserAvatar
                                    name={leader.displayName}
                                    photoURL={leader.photoURL}
                                    sizeClassName="h-11 w-11"
                                  />
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{leader.displayName}</p>
                                    <p className="text-xs text-slate-500">{leader.position || "Líder"}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                                  onClick={() => {
                                    setSelectedUserId(leader.uid);
                                    setDetailTab("personal");
                                  }}
                                >
                                  Ver
                                </button>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                  {leader.orgTeam?.trim() || "Sin equipo"}
                                </span>
                                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                                  {members.length} integrante(s)
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                  {groupedTeams.length} equipo(s)
                                </span>
                              </div>

                              <div className="mt-4 border-t border-slate-200 pt-4">
                                {members.length > 0 ? (
                                  <div className="relative pt-10">
                                    <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-indigo-200" />
                                    {groupedTeams.length > 1 ? (
                                      <div className="absolute left-[12%] right-[12%] top-6 h-px bg-indigo-200" />
                                    ) : null}

                                    <div className="grid gap-3 xl:grid-cols-2">
                                      {groupedTeams.map(([teamName, teamMembers]) => (
                                        <div
                                          key={`${leader.uid}-${teamName}`}
                                          className="relative rounded-xl border border-slate-200 bg-white p-3"
                                        >
                                          <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 -translate-y-full bg-indigo-200" />

                                          <div className="mb-3 flex items-center justify-between gap-2">
                                            <div>
                                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                                                {teamName}
                                              </p>
                                              <p className="text-[11px] text-slate-500">
                                                {teamMembers.length} integrante(s)
                                              </p>
                                            </div>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                                              Equipo
                                            </span>
                                          </div>

                                          <div className="space-y-2">
                                            {teamMembers.map((member) => (
                                              <button
                                                key={member.uid}
                                                type="button"
                                                draggable
                                                ref={(el) => {
                                                  orgNodeRefs.current[member.uid] = el;
                                                }}
                                                onDragStart={() => setDraggedOrgNodeId(member.uid)}
                                                onDragEnd={() => {
                                                  setDraggedOrgNodeId(null);
                                                  setDragOverOrgTargetId(null);
                                                }}
                                                onClick={() => {
                                                  setSelectedUserId(member.uid);
                                                  setDetailTab("personal");
                                                }}
                                                className={`flex w-full cursor-grab items-center justify-between rounded-xl border bg-white px-3 py-2 text-left transition hover:border-indigo-300 ${
                                                  focusedOrgNodeId === member.uid
                                                    ? "border-indigo-400 ring-2 ring-indigo-100"
                                                    : "border-slate-200"
                                                }`}
                                              >
                                                <div className="flex min-w-0 items-center gap-3">
                                                  <UserAvatar
                                                    name={member.displayName}
                                                    photoURL={member.photoURL}
                                                    sizeClassName="h-8 w-8"
                                                  />
                                                  <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-800">
                                                      {member.displayName}
                                                    </p>
                                                    <p className="truncate text-[11px] text-slate-500">
                                                      {member.position || "Colaborador"}
                                                    </p>
                                                  </div>
                                                </div>
                                                <span className="ml-3 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                                                  Ver
                                                </span>
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                                    Este líder no tiene integrantes asignados.
                                  </div>
                                )}
                              </div>
                            </section>
                          );
                        })}
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-amber-900">Sin asignación clara</h4>
                            <p className="text-xs text-amber-800">
                              Personas que aún no cuelgan de un líder visible en esta estructura.
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
                            {unassignedOrgMembers.length}
                          </span>
                        </div>

                        {unassignedOrgMembers.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {unassignedOrgMembers.map((member) => (
                              <button
                                key={member.uid}
                                type="button"
                                draggable
                                ref={(el) => {
                                  orgNodeRefs.current[member.uid] = el;
                                }}
                                onDragStart={() => setDraggedOrgNodeId(member.uid)}
                                onDragEnd={() => {
                                  setDraggedOrgNodeId(null);
                                  setDragOverOrgTargetId(null);
                                }}
                                onClick={() => {
                                  setSelectedUserId(member.uid);
                                  setDetailTab("personal");
                                }}
                                className={`rounded-full border bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-amber-300 ${
                                  focusedOrgNodeId === member.uid
                                    ? "border-amber-400 ring-2 ring-amber-100"
                                    : "border-amber-200"
                                }`}
                              >
                                {member.displayName}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl border border-dashed border-amber-200 bg-white px-4 py-4 text-sm text-amber-800">
                            Todo el equipo filtrado ya tiene una asignación visible dentro del mapa.
                          </p>
                        )}
                      </div>
                    </div>
                  )
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

          {!loading && viewMode === "lista" ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {filteredUsers.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">No hay usuarios para los filtros seleccionados.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredUsers.map((item) => (
                    <div key={item.uid} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                      <UserAvatar name={item.displayName} photoURL={item.photoURL} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.displayName}</p>
                        <p className="truncate text-xs text-slate-400">{item.position || "Sin área"} · {item.email}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badgeStyles[getUserStatus(item)]}`}>
                        {getUserStatusLabel(item)}
                      </span>
                      <div className="flex shrink-0 items-center gap-2 text-slate-400">
                        <button type="button" title="Mensajes" className="transition hover:text-indigo-600" onClick={() => setToast({ message: "Mensajería próximamente.", tone: "success" })}><MessageCircle className="h-4 w-4" /></button>
                        <button type="button" title="Editar" className="transition hover:text-indigo-600" onClick={() => { setSelectedUserId(item.uid); setDetailTab("personal"); }}><Pencil className="h-4 w-4" /></button>
                        <button type="button" title={item.isActive === false ? "Activar" : "Desactivar"} className="transition hover:text-amber-600" onClick={() => toggleActive(item.uid, item.isActive === false)}><UserX className="h-4 w-4" /></button>
                        {item.approved !== true ? (
                          <button type="button" title="Aprobar" className="text-emerald-500 transition hover:text-emerald-600" onClick={() => approveUser(item.uid)}><UserPlus className="h-4 w-4" /></button>
                        ) : null}
                        <button type="button" title="Eliminar" className="text-rose-400 transition hover:text-rose-600" onClick={() => void deleteUser(item.uid, item.displayName)}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {!loading && viewMode === "cuadricula" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {filteredUsers.length === 0 ? (
                <p className="col-span-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">No hay usuarios para los filtros seleccionados.</p>
              ) : (
                filteredUsers.map((item) => (
                  <article key={item.uid} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between px-3.5 pt-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badgeStyles[getUserStatus(item)]}`}>
                        {getUserStatusLabel(item)}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSelectedUserId(item.uid); setDetailTab("personal"); }}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        Editar
                      </button>
                    </div>
                    <div className="flex flex-col items-center px-3.5 pb-4 pt-3 text-center">
                      <UserAvatar name={item.displayName} photoURL={item.photoURL} sizeClassName="h-14 w-14" />
                      <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-800">{item.displayName}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{item.position || "Sin área"}</p>
                      <p className="text-[11px] text-slate-400">{item.email}</p>
                    </div>
                    <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-3.5 py-2.5 text-slate-400">
                      <button type="button" title="Mensajes" className="transition hover:text-indigo-600" onClick={() => setToast({ message: "Mensajería próximamente.", tone: "success" })}><MessageCircle className="h-4 w-4" /></button>
                      <button type="button" title="Documentos" className="transition hover:text-indigo-600" onClick={() => setToast({ message: "Documentos próximamente.", tone: "success" })}><FileText className="h-4 w-4" /></button>
                      <button type="button" title="Historial" className="transition hover:text-indigo-600" onClick={() => { setSelectedUserId(item.uid); setDetailTab("activos"); }}><Clock3 className="h-4 w-4" /></button>
                      <button type="button" title={item.isActive === false ? "Activar" : "Desactivar"} className="transition hover:text-amber-600" onClick={() => toggleActive(item.uid, item.isActive === false)}><UserX className="h-4 w-4" /></button>
                      {item.approved !== true ? (
                        <button type="button" title="Aprobar" className="text-emerald-500 transition hover:text-emerald-600" onClick={() => approveUser(item.uid)}><UserPlus className="h-4 w-4" /></button>
                      ) : null}
                      <button type="button" title="Eliminar" className="text-rose-400 transition hover:text-rose-600" onClick={() => void deleteUser(item.uid, item.displayName)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {selectedUser ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setSelectedUserId(null)}>
              <section
                className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={selectedUser.displayName} photoURL={selectedUser.photoURL} sizeClassName="h-10 w-10" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{detailForm.displayName || selectedUser.displayName}</p>
                      <p className="text-xs text-slate-400">Editar perfil del empleado</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {monitorReturnHref ? (
                      <Link href={monitorReturnHref} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100">
                        {monitorReturnLabel}
                      </Link>
                    ) : null}
                    <button type="button" onClick={() => setSelectedUserId(null)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                      Cancelar
                    </button>
                    <button type="button" onClick={() => void saveDetailProfile()} className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700">
                      Guardar cambios
                    </button>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex items-center border-b border-slate-200 px-5">
                  {detailTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDetailTab(tab.id)}
                      className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
                        detailTab === tab.id ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Form content */}
                <div className="p-5">
                  {detailTab === "personal" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        { label: "Nombre", value: detailForm.firstName, onChange: (v: string) => setDetailForm((prev) => ({ ...prev, firstName: v, displayName: `${v} ${prev.lastName} ${prev.middleName}`.trim() })) },
                        { label: "Apellido paterno", value: detailForm.lastName, onChange: (v: string) => setDetailForm((prev) => ({ ...prev, lastName: v, displayName: `${prev.firstName} ${v} ${prev.middleName}`.trim() })) },
                        { label: "Apellido materno", value: detailForm.middleName, onChange: (v: string) => setDetailForm((prev) => ({ ...prev, middleName: v, displayName: `${prev.firstName} ${prev.lastName} ${v}`.trim() })) },
                        { label: "Correo", value: detailForm.email, onChange: (v: string) => setDetailForm((prev) => ({ ...prev, email: v })) },
                        { label: "Teléfono", value: detailForm.phone, onChange: (v: string) => setDetailForm((prev) => ({ ...prev, phone: v })) },
                      ].map(({ label, value, onChange }) => (
                        <label key={label} className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-500">{label}</span>
                          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400" value={value} onChange={(e) => onChange(e.target.value)} />
                        </label>
                      ))}
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-500">Fecha de nacimiento</span>
                        <input type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400" value={detailForm.birthDate} onChange={(e) => setDetailForm((prev) => ({ ...prev, birthDate: e.target.value }))} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-500">Estado civil</span>
                        <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400" value={detailForm.maritalStatus} onChange={(e) => setDetailForm((prev) => ({ ...prev, maritalStatus: e.target.value }))}>
                          <option>Soltero</option><option>Casado</option><option>Divorciado</option><option>Viudo</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-500">Género</span>
                        <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400" value={detailForm.gender} onChange={(e) => setDetailForm((prev) => ({ ...prev, gender: e.target.value }))}>
                          <option>Masculino</option><option>Femenino</option><option>No especificado</option>
                        </select>
                      </label>
                    </div>
                  ) : detailTab === "laboral" ? (
                    <div className="space-y-5">
                      <div>
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Información laboral</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-500">Área / puesto</span>
                            <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" value={detailForm.position} onChange={(e) => setDetailForm((prev) => ({ ...prev, position: e.target.value }))} />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-500">Jornada</span>
                            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" value={detailForm.workScheduleId} onChange={(e) => setDetailForm((prev) => ({ ...prev, workScheduleId: e.target.value }))}>
                              {scheduleOptions.map((s) => <option key={s.id} value={s.id}>{s.name} · {Math.round(s.weeklyMinutes / 60)}h/semana</option>)}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-500">Inicio de contrato</span>
                            <input type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" value={detailForm.employmentStartDate} onChange={(e) => setDetailForm((prev) => ({ ...prev, employmentStartDate: e.target.value }))} />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-500">Contrato indefinido</span>
                            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" value={detailForm.contractIndefinite ? "yes" : "no"} onChange={(e) => setDetailForm((prev) => ({ ...prev, contractIndefinite: e.target.value === "yes", contractEndDate: e.target.value === "yes" ? "" : prev.contractEndDate }))}>
                              <option value="yes">Sí</option><option value="no">No</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-500">Fin de contrato</span>
                            <input type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400" value={detailForm.contractEndDate} onChange={(e) => setDetailForm((prev) => ({ ...prev, contractEndDate: e.target.value }))} disabled={detailForm.contractIndefinite} />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-500">Estado</span>
                            <input className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" value={formatStatusLabel(selectedUser.isActive)} readOnly />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-slate-500">Responsable de área</span>
                            <select
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                              value={selectedUser.isAreaLead ? "yes" : "no"}
                              onChange={(e) => void updateUserDoc(selectedUser.uid, { isAreaLead: e.target.value === "yes" })}
                            >
                              <option value="no">No</option>
                              <option value="yes">Sí — ve checklist de cierre de mes</option>
                            </select>
                          </label>
                        </div>
                      </div>
                      <div>
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Datos bancarios</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          {[
                            { label: "Banco", key: "bankName" as const },
                            { label: "Tipo de cuenta", key: "accountType" as const },
                            { label: "Número de cuenta", key: "accountNumber" as const },
                            { label: "CCI", key: "cci" as const },
                          ].map(({ label, key }) => (
                            <label key={key} className="flex flex-col gap-1">
                              <span className="text-xs font-semibold text-slate-500">{label}</span>
                              <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" value={detailForm[key]} onChange={(e) => setDetailForm((prev) => ({ ...prev, [key]: e.target.value }))} />
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                      Contenido de <strong>{detailTabs.find((t) => t.id === detailTab)?.label}</strong> en preparación.
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}

      <Modal title={orgConfirmModal.title} open={orgConfirmModal.open} onClose={closeOrgConfirmModal}>
        <div className="space-y-3">
          <div
            className={`rounded-2xl border p-4 ${orgConfirmToneStyles[orgConfirmModal.tone].panel}`}
          >
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${orgConfirmToneStyles[orgConfirmModal.tone].badge}`}
            >
              {orgConfirmModal.tone === "indigo" ? "Cambio estructural" : "Reasignación de rol"}
            </span>

            <div className="mt-3 space-y-2">
              {orgConfirmModal.lines.map((line) => (
                <p key={line} className="text-sm text-slate-700">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              onClick={closeOrgConfirmModal}
              disabled={orgConfirming}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-70 ${orgConfirmToneStyles[orgConfirmModal.tone].button}`}
              onClick={() => void handleConfirmOrgAction()}
              disabled={orgConfirming}
            >
              {orgConfirming ? "Guardando..." : orgConfirmModal.confirmLabel}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
