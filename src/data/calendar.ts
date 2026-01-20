export type CalendarEventType = "EVENT";
export type AbsenceType = "VACATION" | "PERMIT";

export interface Holiday {
  date: string;
  name: string;
}

export interface CalendarEvent {
  date: string;
  title: string;
  type: CalendarEventType;
}

export interface Absence {
  dateStart: string;
  dateEnd: string;
  personName: string;
  type: AbsenceType;
  status: "APPROVED" | "PENDING";
}

export const holidays: Holiday[] = [
  { date: "2026-01-01", name: "Año Nuevo" },
  { date: "2026-01-06", name: "Reyes" },
  { date: "2026-01-20", name: "Día de la Agencia" },
  { date: "2026-02-14", name: "Día de la Creatividad" },
];

export const events: CalendarEvent[] = [
  { date: "2026-01-08", title: "Townhall Q1", type: "EVENT" },
  { date: "2026-01-15", title: "Workshop de cultura", type: "EVENT" },
  { date: "2026-01-28", title: "Revisión mensual", type: "EVENT" },
];

export const absences: Absence[] = [
  {
    dateStart: "2026-01-10",
    dateEnd: "2026-01-12",
    personName: "Camila López",
    type: "VACATION",
    status: "APPROVED",
  },
  {
    dateStart: "2026-01-18",
    dateEnd: "2026-01-18",
    personName: "Diego Rivera",
    type: "PERMIT",
    status: "APPROVED",
  },
  {
    dateStart: "2026-01-22",
    dateEnd: "2026-01-23",
    personName: "Sofía Pérez",
    type: "VACATION",
    status: "APPROVED",
  },
];
