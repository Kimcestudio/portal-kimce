import { formatISODate } from "@/lib/attendanceUtils";

export type AttendanceRecordStatus = "OPEN" | "CLOSED";

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  breaks: { startAt: string; endAt: string | null }[];
  notes: string | null;
  totalMinutes: number;
  status: AttendanceRecordStatus;
}

export type ExtraActivityType =
  | "Reunión"
  | "Grabación"
  | "Urgencia"
  | "Evento"
  | "Otro";

export interface ExtraActivity {
  id: string;
  userId: string;
  date: string;
  minutes: number;
  type: ExtraActivityType;
  project?: string;
  note?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface Request {
  id: string;
  userId: string;
  type: "DIA_LIBRE" | "PERMISO_HORAS" | "MEDICO";
  date: string;
  endDate?: string;
  hours?: number;
  reason: string;
  attachmentUrl?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface CorrectionRequest {
  id: string;
  userId: string;
  date: string;
  attendanceId: string;
  proposedChanges: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

type UnifiedItem =
  | (ExtraActivity & { kind: "EXTRA" })
  | (Request & { kind: "REQUEST" })
  | (CorrectionRequest & { kind: "CORRECTION" });

const STORAGE_KEYS = {
  records: "attendance_records",
  extras: "attendance_extras",
  requests: "attendance_requests",
  corrections: "attendance_corrections",
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getStore<T>(key: string, fallback: T) {
  if (typeof window === "undefined") return fallback;
  return safeParse<T>(window.localStorage.getItem(key), fallback);
}

function setStore<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function computeBreakMinutes(record: AttendanceRecord) {
  return record.breaks.reduce((total, current) => {
    if (!current.endAt) return total;
    const start = new Date(current.startAt).getTime();
    const end = new Date(current.endAt).getTime();
    return total + Math.max(0, Math.round((end - start) / 60000));
  }, 0);
}

function updateRecord(record: AttendanceRecord) {
  const records = getStore<AttendanceRecord[]>(STORAGE_KEYS.records, []);
  const next = records.filter((item) => item.id !== record.id);
  next.push(record);
  setStore(STORAGE_KEYS.records, next);
  return record;
}

export function getTodayRecord(userId: string, dateISO: string) {
  const records = getStore<AttendanceRecord[]>(STORAGE_KEYS.records, []);
  return records.find((record) => record.userId === userId && record.date === dateISO) ?? null;
}

export function createCheckIn(userId: string, now: Date) {
  const dateISO = formatISODate(now);
  const existing = getTodayRecord(userId, dateISO);
  if (existing) return existing;
  const record: AttendanceRecord = {
    id: `${userId}_${dateISO}`,
    userId,
    date: dateISO,
    checkInAt: now.toISOString(),
    checkOutAt: null,
    breaks: [],
    notes: null,
    totalMinutes: 0,
    status: "OPEN",
  };
  return updateRecord(record);
}

export function startBreak(userId: string, now: Date) {
  const dateISO = formatISODate(now);
  const record = getTodayRecord(userId, dateISO);
  if (!record || record.checkOutAt) return record;
  const hasOpenBreak = record.breaks.some((item) => !item.endAt);
  if (hasOpenBreak) return record;
  record.breaks.push({ startAt: now.toISOString(), endAt: null });
  return updateRecord(record);
}

export function endBreak(userId: string, now: Date) {
  const dateISO = formatISODate(now);
  const record = getTodayRecord(userId, dateISO);
  if (!record) return record;
  const openBreak = record.breaks.find((item) => !item.endAt);
  if (!openBreak) return record;
  openBreak.endAt = now.toISOString();
  return updateRecord(record);
}

export function checkOut(userId: string, now: Date) {
  const dateISO = formatISODate(now);
  const record = getTodayRecord(userId, dateISO);
  if (!record || record.checkOutAt) return record;
  const openBreak = record.breaks.find((item) => !item.endAt);
  if (openBreak) return record;
  record.checkOutAt = now.toISOString();
  const workedMinutes = Math.round(
    (new Date(record.checkOutAt).getTime() - new Date(record.checkInAt ?? record.checkOutAt).getTime()) /
      60000
  );
  const breakMinutes = computeBreakMinutes(record);
  record.totalMinutes = Math.max(0, workedMinutes - breakMinutes);
  record.status = "CLOSED";
  return updateRecord(record);
}

export function saveNote(userId: string, dateISO: string, note: string) {
  const record = getTodayRecord(userId, dateISO);
  if (!record) return null;
  record.notes = note;
  return updateRecord(record);
}

export function listRecordsForWeek(userId: string, weekStartISO: string) {
  const records = getStore<AttendanceRecord[]>(STORAGE_KEYS.records, []);
  return records.filter((record) => record.userId === userId && record.date >= weekStartISO);
}

export function createExtraActivity(
  userId: string,
  payload: Omit<ExtraActivity, "id" | "userId" | "status" | "createdAt">
) {
  const extras = getStore<ExtraActivity[]>(STORAGE_KEYS.extras, []);
  const record: ExtraActivity = {
    ...payload,
    id: `${userId}_${Date.now()}`,
    userId,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  extras.unshift(record);
  setStore(STORAGE_KEYS.extras, extras);
  return record;
}

export function listRecentExtras(userId: string, limit = 6) {
  const extras = getStore<ExtraActivity[]>(STORAGE_KEYS.extras, []);
  return extras.filter((extra) => extra.userId === userId).slice(0, limit);
}

export function createRequest(
  userId: string,
  payload: Omit<Request, "id" | "userId" | "status" | "createdAt">
) {
  const requests = getStore<Request[]>(STORAGE_KEYS.requests, []);
  const record: Request = {
    ...payload,
    id: `${userId}_${Date.now()}`,
    userId,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  requests.unshift(record);
  setStore(STORAGE_KEYS.requests, requests);
  return record;
}

export function listRecentRequests(userId: string, limit = 6) {
  const requests = getStore<Request[]>(STORAGE_KEYS.requests, []);
  return requests.filter((req) => req.userId === userId).slice(0, limit);
}

export function createCorrectionRequest(
  userId: string,
  payload: Omit<CorrectionRequest, "id" | "userId" | "status" | "createdAt">
) {
  const corrections = getStore<CorrectionRequest[]>(STORAGE_KEYS.corrections, []);
  const record: CorrectionRequest = {
    ...payload,
    id: `${userId}_${Date.now()}`,
    userId,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  corrections.unshift(record);
  setStore(STORAGE_KEYS.corrections, corrections);
  return record;
}

export function listRecentCorrections(userId: string, limit = 6) {
  const corrections = getStore<CorrectionRequest[]>(STORAGE_KEYS.corrections, []);
  return corrections.filter((item) => item.userId === userId).slice(0, limit);
}

export function listUnifiedRecent(userId: string, limit = 6): UnifiedItem[] {
  const extras = listRecentExtras(userId, limit).map((item) => ({ ...item, kind: "EXTRA" as const }));
  const requests = listRecentRequests(userId, limit).map((item) => ({ ...item, kind: "REQUEST" as const }));
  const corrections = listRecentCorrections(userId, limit).map((item) => ({
    ...item,
    kind: "CORRECTION" as const,
  }));
  const merged = [...extras, ...requests, ...corrections];
  return merged
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
