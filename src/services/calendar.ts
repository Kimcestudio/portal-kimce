import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/services/firebase/client";

export type CalendarHolidayKind = "HOLIDAY" | "DAY_OFF";
export type CalendarAbsenceType = "VACATION" | "PERMIT";

export type CalendarHolidayRecord = {
  id: string;
  date: string;
  name: string;
  kind: CalendarHolidayKind;
};

export type CalendarEventRecord = {
  id: string;
  date: string;
  title: string;
  description?: string;
};

export type CalendarAbsenceRecord = {
  id: string;
  uid: string;
  personName: string;
  dateStart: string;
  dateEnd: string;
  type: CalendarAbsenceType;
  status: "APPROVED";
  reason?: string;
};

const holidaysRef = collection(db, "calendarHolidays");
const eventsRef = collection(db, "calendarEvents");
const requestsRef = collection(db, "hourRequests");

function normalizeDate(value: unknown) {
  if (typeof value === "string") return value.slice(0, 10);
  return "";
}

function mapRequestType(type: unknown): CalendarAbsenceType | null {
  const normalized = typeof type === "string" ? type.toUpperCase() : "";
  if (normalized === "VACACIONES") return "VACATION";
  if (["DIA_LIBRE", "PERMISO_HORAS", "MEDICO", "HOURS", "PERMISO"].includes(normalized)) return "PERMIT";
  return null;
}

export function subscribeCalendarHolidays(onChange: (items: CalendarHolidayRecord[]) => void) {
  const holidaysQuery = query(holidaysRef, orderBy("date", "asc"));
  return onSnapshot(holidaysQuery, (snapshot) => {
    const next = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as DocumentData;
      return {
        id: docSnap.id,
        date: normalizeDate(data.date),
        name: (data.name as string) ?? "Dia calendario",
        kind: ((data.kind as CalendarHolidayKind | undefined) ?? "HOLIDAY"),
      } satisfies CalendarHolidayRecord;
    });
    onChange(next.filter((item) => item.date));
  });
}

export function subscribeCalendarEvents(onChange: (items: CalendarEventRecord[]) => void) {
  const calendarEventsQuery = query(eventsRef, orderBy("date", "asc"));
  return onSnapshot(calendarEventsQuery, (snapshot) => {
    const next = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as DocumentData;
      return {
        id: docSnap.id,
        date: normalizeDate(data.date),
        title: (data.title as string) ?? "Evento interno",
        description: (data.description as string | undefined) ?? "",
      } satisfies CalendarEventRecord;
    });
    onChange(next.filter((item) => item.date));
  });
}

export function subscribeApprovedAbsences(onChange: (items: CalendarAbsenceRecord[]) => void) {
  return onSnapshot(requestsRef, (snapshot) => {
    const next = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as DocumentData;
        const status = typeof data.status === "string" ? data.status.toUpperCase() : "";
        if (status !== "APPROVED") return null;

        const absenceType = mapRequestType(data.type);
        if (!absenceType) return null;

        const startDate = normalizeDate(data.date);
        const endDate = normalizeDate(data.endDate) || startDate;
        const uid = (data.uid as string | undefined) ?? "";
        if (!uid || !startDate) return null;

        return {
          id: docSnap.id,
          uid,
          personName: (data.userName as string | undefined) ?? (data.displayName as string | undefined) ?? uid,
          dateStart: startDate,
          dateEnd: endDate,
          type: absenceType,
          status: "APPROVED",
          reason: (data.reason as string | undefined) ?? "",
        } satisfies CalendarAbsenceRecord;
      })
      .filter(Boolean) as CalendarAbsenceRecord[];

    onChange(next);
  });
}

export async function createCalendarHoliday(input: Omit<CalendarHolidayRecord, "id">) {
  await addDoc(holidaysRef, input);
}

export async function createCalendarEvent(input: Omit<CalendarEventRecord, "id">) {
  await addDoc(eventsRef, input);
}

export async function deleteCalendarHoliday(id: string) {
  await deleteDoc(doc(holidaysRef, id));
}

export async function deleteCalendarEvent(id: string) {
  await deleteDoc(doc(eventsRef, id));
}
