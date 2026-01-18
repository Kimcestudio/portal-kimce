import { formatISODate, getWeekStartMonday } from "@/lib/attendanceUtils";
import type { AdminAttendanceRecord, FinanceSettings, RequestRecord, UserProfile } from "@/services/firebase/types";
import {
  getCollection,
  getFinanceSettings,
  setAttendanceRecords,
  setCollection,
  setFinanceSettings,
} from "@/services/firebase/db";

const defaultUsers: UserProfile[] = [
  {
    uid: "collab-1",
    email: "alondra@demo.com",
    displayName: "Alondra Ruiz",
    photoURL:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=120&q=80",
    role: "collab",
    position: "Diseñadora UX",
    active: true,
  },
  {
    uid: "admin-1",
    email: "admin@demo.com",
    displayName: "Carlos Méndez",
    photoURL:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80",
    role: "admin",
    position: "Head of Operations",
    active: true,
  },
  {
    uid: "collab-2",
    email: "diego@demo.com",
    displayName: "Diego Rivera",
    photoURL:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
    role: "collab",
    position: "Project Manager",
    active: true,
  },
];

const defaultRequests: RequestRecord[] = [
  {
    id: "req-1",
    type: "Vacaciones",
    date: "2026-01-20",
    reason: "Descanso familiar",
    status: "PENDING",
    createdBy: "collab-1",
    createdAt: "2026-01-10T09:15:00.000Z",
  },
  {
    id: "req-2",
    type: "Permiso",
    date: "2026-01-22",
    hours: 2,
    reason: "Cita médica",
    status: "APPROVED",
    createdBy: "collab-2",
    createdAt: "2026-01-09T13:30:00.000Z",
    reviewedBy: "admin-1",
    reviewedAt: "2026-01-10T08:10:00.000Z",
  },
];

function buildAttendanceSeed() {
  const weekStart = getWeekStartMonday(new Date());
  const makeDay = (userId: string, offset: number, totalMinutes: number, note?: string): AdminAttendanceRecord => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    const checkIn = new Date(date);
    checkIn.setHours(9, 5, 0, 0);
    const checkOut = new Date(date);
    checkOut.setHours(18, 0, 0, 0);
    return {
      id: `${userId}_${formatISODate(date)}`,
      userId,
      date: formatISODate(date),
      checkInAt: checkIn.toISOString(),
      checkOutAt: checkOut.toISOString(),
      breaks: [
        {
          startAt: new Date(date.setHours(13, 30, 0, 0)).toISOString(),
          endAt: new Date(date.setHours(14, 0, 0, 0)).toISOString(),
        },
      ],
      notes: note ?? null,
      totalMinutes,
      status: "CLOSED",
    };
  };

  return [
    makeDay("collab-1", 0, 450, "Entrega de prototipos."),
    makeDay("collab-1", 1, 420),
    makeDay("collab-1", 2, 480),
    makeDay("collab-2", 0, 480, "Planeación semanal."),
    makeDay("collab-2", 1, 480),
    makeDay("collab-2", 2, 510),
  ];
}

export function seedFirebaseData() {
  if (typeof window === "undefined") return;
  if (getCollection<UserProfile>("users").length === 0) {
    setCollection("users", defaultUsers);
  }
  if (getCollection<RequestRecord>("requests").length === 0) {
    setCollection("requests", defaultRequests);
  }
  if (getCollection<AdminAttendanceRecord>("attendance").length === 0) {
    setAttendanceRecords(buildAttendanceSeed());
  }
  const financeSettings = getFinanceSettings();
  if (!financeSettings.financeKey && !financeSettings.financeKeyHash) {
    const defaults: FinanceSettings = { financeKey: "9021" };
    setFinanceSettings(defaults);
  }
}
