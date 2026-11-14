"use client";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { isSameDate, isInRange } from "@/lib/calendarUtils";
import DayCell from "./DayCell";

// ── Types ──────────────────────────────────────────────────────────────────────

type CalendarGridHoliday = { id?: string; date: string; name: string; kind?: "HOLIDAY" | "DAY_OFF" };
type CalendarGridEvent = { id?: string; date: string; title: string };
type CalendarGridAbsence = { dateStart: string; dateEnd: string; type: "VACATION" | "PERMIT"; status: "APPROVED" | "PENDING" };
type CalendarGridGCalEvent = {
  id?: string;
  date: string;
  endDate: string;
  title: string;
  startTime?: string;
  isAllDay?: boolean;
  organizer?: { email: string };
};
type CalendarGridMeetingEvent = { id: string; date: string; title: string };

export type MoveEventPayload = {
  type: "gcal" | "event" | "holiday" | "dayoff";
  id: string;
  fromISO: string;
  toISO: string;
};

type InternalChip = {
  type: "holiday" | "dayoff" | "event" | "gcal" | "absence" | "personal" | "meeting";
  id?: string;
  startDate?: string;
  title: string;
  time?: string;
  notDraggable?: boolean;
};

interface MonthGridProps {
  weeks: Date[][];
  month: number;
  holidays: CalendarGridHoliday[];
  events: CalendarGridEvent[];
  absences: CalendarGridAbsence[];
  gcalEvents?: CalendarGridGCalEvent[];
  personalEvents?: CalendarGridGCalEvent[];
  meetingEvents?: CalendarGridMeetingEvent[];
  activeFilters?: string[];
  userEmail?: string;
  onSelectDate: (date: Date, rect?: DOMRect) => void;
  onMoveEvent?: (payload: MoveEventPayload) => void;
}

// ── Chip styles ────────────────────────────────────────────────────────────────

const chipStylesMap: Record<string, string> = {
  holiday: "bg-violet-500 text-white border-transparent",
  dayoff: "bg-pink-500 text-white border-transparent",
  event: "bg-sky-500 text-white border-transparent",
  gcal: "bg-cyan-500 text-white border-transparent",
  absence: "bg-amber-500 text-white border-transparent",
  personal: "bg-indigo-500 text-white border-transparent",
  meeting: "bg-purple-500 text-white border-transparent",
};

const DRAGGABLE_TYPES = new Set<string>(["gcal", "event", "holiday", "dayoff"]);

// ── Helpers ────────────────────────────────────────────────────────────────────

function isServiceAccount(email: string): boolean {
  return email.includes(".gserviceaccount.com");
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DraggableChip({ dragId, type, title, time }: {
  dragId: string;
  type: string;
  title: string;
  time?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { title, time },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        touchAction: "none",
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 9999 : undefined,
        position: "relative",
        boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.22)" : undefined,
        scale: isDragging ? "1.04" : undefined,
      }}
      {...listeners}
      {...attributes}
      className={`w-full truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight cursor-grab active:cursor-grabbing select-none ${chipStylesMap[type] ?? ""}`}
    >
      {time && <span className="opacity-60 mr-0.5">{time}</span>}
      <span>{title}</span>
    </div>
  );
}

function StaticChip({ type, title, time }: { type: string; title: string; time?: string }) {
  return (
    <div className={`w-full truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${chipStylesMap[type] ?? ""}`}>
      {time && <span className="opacity-60 mr-0.5">{time}</span>}
      <span>{title}</span>
    </div>
  );
}

function DroppableCell({ dateISO, children }: { dateISO: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateISO });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl transition-all duration-100 ${isOver ? "ring-2 ring-violet-400 ring-inset z-10 relative bg-violet-50/40" : ""}`}
    >
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function MonthGrid({
  weeks,
  month,
  holidays,
  events,
  absences,
  gcalEvents = [],
  personalEvents = [],
  meetingEvents = [],
  activeFilters = [],
  userEmail,
  onSelectDate,
  onMoveEvent,
}: MonthGridProps) {
  const today = new Date();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const toISO = over.id as string;
    const parts = (active.id as string).split("|");
    if (parts.length < 3) return;

    const [type, id, fromISO] = parts;
    if (fromISO === toISO) return;
    if (!DRAGGABLE_TYPES.has(type ?? "")) return;

    onMoveEvent?.({ type: type as MoveEventPayload["type"], id: id ?? "", fromISO: fromISO ?? "", toISO });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1.5 text-xs font-semibold text-muted">
          {weekdayLabels.map((label) => (
            <div key={label} className="px-2 py-1 text-center">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weeks.flat().map((date) => {
            const dateISO = date.toISOString().slice(0, 10);
            const isOutside = date.getMonth() !== month;
            const isToday = isSameDate(date, today);

            const holidayItems = holidays.filter((item) => item.date === dateISO);
            const eventItems = events.filter((item) => item.date === dateISO);
            const absenceItems = absences.filter(
              (item) => item.status === "APPROVED" && isInRange(date, item.dateStart, item.dateEnd),
            );
            const gcalItems = gcalEvents.filter((item) => isInRange(date, item.date, item.endDate));
            const personalItems = personalEvents.filter((item) => isInRange(date, item.date, item.endDate));
            const meetingItems = meetingEvents.filter((item) => item.date === dateISO);
            const hasHoliday = holidayItems.length > 0;

            const allChips: InternalChip[] = [
              ...holidayItems.filter((h) => h.kind !== "DAY_OFF").map((h) => ({ type: "holiday" as const, id: h.id, startDate: h.date, title: h.name })),
              ...holidayItems.filter((h) => h.kind === "DAY_OFF").map((h) => ({ type: "dayoff" as const, id: h.id, startDate: h.date, title: h.name })),
              ...eventItems.map((ev) => ({ type: "event" as const, id: ev.id, startDate: ev.date, title: ev.title })),
              ...gcalItems.map((ev) => ({
                type: "gcal" as const,
                id: ev.id,
                startDate: ev.date,
                title: ev.title,
                time: !ev.isAllDay && ev.startTime ? ev.startTime : undefined,
                // Block only if organizer is a human email that isn't the portal user AND isn't a service account
                notDraggable: Boolean(
                  ev.organizer?.email
                  && !isServiceAccount(ev.organizer.email)
                  && userEmail
                  && ev.organizer.email.toLowerCase() !== userEmail.toLowerCase()
                ),
              })),
              ...absenceItems.map((a) => ({ type: "absence" as const, title: a.type === "VACATION" ? "Vacaciones" : "Permiso" })),
              ...personalItems.map((ev) => ({ type: "personal" as const, title: ev.title, time: !ev.isAllDay && ev.startTime ? ev.startTime : undefined })),
              ...meetingItems.map((m) => ({ type: "meeting" as const, id: m.id, title: m.title })),
            ];

            const filteredChips = activeFilters.length > 0
              ? allChips.filter((c) => activeFilters.includes(c.type))
              : allChips;

            const visibleChips = filteredChips.slice(0, 3);
            const overflowCount = Math.max(0, filteredChips.length - 3);

            const ariaLabel = [
              date.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }),
              filteredChips.length > 0 ? `— ${filteredChips.length} ${filteredChips.length === 1 ? "elemento" : "elementos"}` : "",
            ].filter(Boolean).join(" ");

            return (
              <DroppableCell key={dateISO} dateISO={dateISO}>
                <DayCell
                  isToday={isToday}
                  isOutside={isOutside}
                  isHoliday={hasHoliday}
                  dayNumber={date.getDate()}
                  ariaLabel={ariaLabel}
                  overflowCount={overflowCount}
                  onClick={(e) => onSelectDate(date, e.currentTarget.getBoundingClientRect())}
                >
                  {visibleChips.map((chip, i) => {
                    const canDrag = DRAGGABLE_TYPES.has(chip.type) && Boolean(chip.id) && Boolean(chip.startDate) && !chip.notDraggable;
                    if (canDrag) {
                      const dragId = `${chip.type}|${chip.id}|${chip.startDate}`;
                      return (
                        <DraggableChip
                          key={dragId}
                          dragId={dragId}
                          type={chip.type}
                          title={chip.title}
                          time={chip.time}
                        />
                      );
                    }
                    return (
                      <StaticChip
                        key={`${chip.type}-${i}`}
                        type={chip.type}
                        title={chip.title}
                        time={chip.time}
                      />
                    );
                  })}
                </DayCell>
              </DroppableCell>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
