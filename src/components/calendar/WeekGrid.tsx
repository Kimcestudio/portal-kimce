"use client";

import { useEffect, useRef, useState } from "react";
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
import { isSameDate, formatISODate } from "@/lib/calendarUtils";

// ── Constants ──────────────────────────────────────────────────────────────────

const HOUR_H = 56;
const TOTAL_H = HOUR_H * 24;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ── Types ──────────────────────────────────────────────────────────────────────

type ChipType = "gcal" | "event" | "holiday" | "dayoff" | "absence" | "personal" | "meeting";

export type WeekGridEvent = {
  id: string;
  date: string;
  endDate?: string;
  title: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  type: ChipType;
  organizer?: { email: string };
};

export type WeekMovePayload = {
  id: string;
  type: ChipType;
  fromISO: string;
  toISO: string;
  newStartTime?: string;
  newEndTime?: string;
};

export type WeekResizePayload = {
  id: string;
  type: ChipType;
  date: string;
  newEndTime: string;
};

interface WeekGridProps {
  weekStart: Date;
  events: WeekGridEvent[];
  activeFilters?: string[];
  userEmail?: string;
  onSelectSlot?: (date: Date, startTime: string) => void;
  onSelectEvent?: (ev: WeekGridEvent, rect: DOMRect) => void;
  onMoveEvent?: (payload: WeekMovePayload) => void;
  onResizeEvent?: (payload: WeekResizePayload) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const typeColors: Record<ChipType, { bg: string; border: string; text: string }> = {
  gcal:     { bg: "bg-cyan-500",    border: "border-cyan-600",    text: "text-white" },
  event:    { bg: "bg-sky-500",     border: "border-sky-600",     text: "text-white" },
  holiday:  { bg: "bg-violet-500",  border: "border-violet-600",  text: "text-white" },
  dayoff:   { bg: "bg-pink-500",    border: "border-pink-600",    text: "text-white" },
  absence:  { bg: "bg-amber-500",   border: "border-amber-600",   text: "text-white" },
  personal: { bg: "bg-indigo-500",  border: "border-indigo-600",  text: "text-white" },
  meeting:  { bg: "bg-purple-500",  border: "border-purple-600",  text: "text-white" },
};

const DRAGGABLE_TYPES = new Set<ChipType>(["gcal", "event"]);

function isServiceAccount(email: string): boolean {
  return email.includes(".gserviceaccount.com");
}

function timeToMin(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(m: number): string {
  const clamped = Math.max(0, Math.min(1439, m));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function snapMin(m: number, snap = 15): number {
  return Math.round(m / snap) * snap;
}

function formatHour(h: number): string {
  if (h === 0) return "12 am";
  if (h < 12) return `${h} am`;
  if (h === 12) return "12 pm";
  return `${h - 12} pm`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DroppableCol({ dateISO, children }: { dateISO: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateISO });
  return (
    <div
      ref={setNodeRef}
      className={`relative h-full transition-colors ${isOver ? "bg-violet-50/60" : ""}`}
    >
      {children}
    </div>
  );
}

function DraggableEvent({
  ev,
  top,
  height,
  onResizeStart,
  onSelect,
}: {
  ev: WeekGridEvent;
  top: number;
  height: number;
  onResizeStart: (e: React.PointerEvent) => void;
  onSelect?: (ev: WeekGridEvent, rect: DOMRect) => void;
}) {
  const dragId = `week|${ev.type}|${ev.id}|${ev.date}|${ev.startTime ?? ""}|${ev.endTime ?? ""}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { title: ev.title, startTime: ev.startTime, endTime: ev.endTime, type: ev.type },
  });

  const colors = typeColors[ev.type];

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        top,
        height: Math.max(height, 20),
        left: 2,
        right: 2,
        zIndex: isDragging ? 9999 : 10,
        touchAction: "none",
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.65 : 1,
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.25)" : undefined,
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => { if (!isDragging) onSelect?.(ev, (e.currentTarget as HTMLElement).getBoundingClientRect()); }}
      className={`rounded-md border ${colors.bg} ${colors.border} ${colors.text} px-1.5 py-0.5 text-[10px] font-medium overflow-hidden cursor-grab active:cursor-grabbing select-none group`}
    >
      <p className="truncate leading-tight font-semibold">{ev.title}</p>
      {height >= 36 && ev.startTime && (
        <p className="opacity-70 text-[9px]">
          {ev.startTime}{ev.endTime ? `–${ev.endTime}` : ""}
        </p>
      )}
      {/* Resize handle */}
      <div
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, cursor: "ns-resize" }}
        onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
        className="opacity-0 group-hover:opacity-100 bg-black/20 rounded-b-md"
      />
    </div>
  );
}

function StaticEventChip({ ev, top, height, onSelect }: {
  ev: WeekGridEvent;
  top: number;
  height: number;
  onSelect?: (ev: WeekGridEvent, rect: DOMRect) => void;
}) {
  const colors = typeColors[ev.type];
  return (
    <div
      style={{ position: "absolute", top, height: Math.max(height, 20), left: 2, right: 2, zIndex: 10 }}
      onClick={(e) => onSelect?.(ev, (e.currentTarget as HTMLElement).getBoundingClientRect())}
      className={`rounded-md border ${colors.bg} ${colors.border} ${colors.text} px-1.5 py-0.5 text-[10px] font-medium overflow-hidden select-none cursor-pointer`}
    >
      <p className="truncate leading-tight font-semibold">{ev.title}</p>
      {height >= 36 && ev.startTime && (
        <p className="opacity-70 text-[9px]">
          {ev.startTime}{ev.endTime ? `–${ev.endTime}` : ""}
        </p>
      )}
    </div>
  );
}

function AllDayChip({ ev, onSelect }: {
  ev: WeekGridEvent;
  onSelect?: (ev: WeekGridEvent, rect: DOMRect) => void;
}) {
  const colors = typeColors[ev.type];
  return (
    <div
      onClick={(e) => onSelect?.(ev, (e.currentTarget as HTMLElement).getBoundingClientRect())}
      className={`rounded-md border ${colors.bg} ${colors.border} ${colors.text} px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer`}
    >
      {ev.title}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function WeekGrid({
  weekStart,
  events,
  activeFilters = [],
  userEmail,
  onSelectSlot,
  onSelectEvent,
  onMoveEvent,
  onResizeEvent,
}: WeekGridProps) {
  const today = new Date();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [resizing, setResizing] = useState<{
    ev: WeekGridEvent;
    startY: number;
    originalEndMin: number;
  } | null>(null);
  const [resizingEndMin, setResizingEndMin] = useState<number>(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_H - 10;
    }
  }, []);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin / 60) * HOUR_H;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const filtered = activeFilters.length > 0
    ? events.filter((e) => activeFilters.includes(e.type))
    : events;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over, delta } = e;
    if (!over || !active.id) return;

    const parts = (active.id as string).split("|");
    if (parts[0] !== "week" || parts.length < 5) return;
    const [, type, id, fromISO, originalStart, originalEnd] = parts;
    const toISO = over.id as string;

    if (!id || !fromISO || !type) return;

    const startMin = originalStart ? timeToMin(originalStart) : undefined;
    const endMin = originalEnd ? timeToMin(originalEnd) : undefined;
    const durationMin = startMin != null && endMin != null ? endMin - startMin : undefined;

    const newStartMin = startMin != null ? snapMin(startMin + (delta.y / HOUR_H) * 60) : undefined;
    const newEndMin = newStartMin != null && durationMin != null ? newStartMin + durationMin : undefined;

    onMoveEvent?.({
      id,
      type: type as ChipType,
      fromISO,
      toISO,
      newStartTime: newStartMin != null ? minToTime(newStartMin) : undefined,
      newEndTime: newEndMin != null ? minToTime(newEndMin) : undefined,
    });
  }

  function handleResizeStart(ev: WeekGridEvent, e: React.PointerEvent) {
    e.preventDefault();
    const endMin = ev.endTime ? timeToMin(ev.endTime) : (ev.startTime ? timeToMin(ev.startTime) + 60 : 60);
    setResizing({ ev, startY: e.clientY, originalEndMin: endMin });
    setResizingEndMin(endMin);
  }

  useEffect(() => {
    if (!resizing) return;
    function onMove(e: PointerEvent) {
      if (!resizing) return;
      const delta = e.clientY - resizing.startY;
      const newEnd = snapMin(resizing.originalEndMin + (delta / HOUR_H) * 60);
      const minEnd = resizing.ev.startTime ? timeToMin(resizing.ev.startTime) + 15 : 15;
      setResizingEndMin(Math.max(minEnd, newEnd));
    }
    function onUp() {
      if (!resizing) return;
      onResizeEvent?.({ id: resizing.ev.id, type: resizing.ev.type, date: resizing.ev.date, newEndTime: minToTime(resizingEndMin) });
      setResizing(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [resizing, resizingEndMin, onResizeEvent]);

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, date: Date) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
    const clickedMin = snapMin((y / HOUR_H) * 60);
    onSelectSlot?.(date, minToTime(clickedMin));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/80">

        {/* Day header row */}
        <div className="flex border-b border-slate-100/80 shrink-0">
          <div className="w-12 shrink-0" />
          {days.map((day, i) => {
            const isToday = isSameDate(day, today);
            return (
              <div key={i} className="flex-1 border-l border-slate-100/60 py-2 text-center">
                <span className="text-[11px] font-medium text-slate-400">{DAY_LABELS[i]}</span>
                <div className="flex justify-center mt-0.5">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday ? "bg-violet-600 text-white" : "text-slate-700"}`}>
                    {day.getDate()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day events row */}
        {filtered.some((e) => e.isAllDay) && (
          <div className="flex border-b border-slate-100/80 shrink-0 min-h-[28px]">
            <div className="w-12 shrink-0 flex items-center justify-end pr-2">
              <span className="text-[9px] text-slate-400">Todo el día</span>
            </div>
            {days.map((day, i) => {
              const iso = formatISODate(day);
              const dayAllDay = filtered.filter((e) => e.isAllDay && e.date <= iso && (e.endDate ?? e.date) >= iso);
              return (
                <div key={i} className="flex-1 border-l border-slate-100/60 p-0.5 flex flex-col gap-0.5">
                  {dayAllDay.map((ev) => <AllDayChip key={ev.id} ev={ev} onSelect={onSelectEvent} />)}
                </div>
              );
            })}
          </div>
        )}

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)", minHeight: 300 }}>
          <div className="flex" style={{ height: TOTAL_H }}>
            {/* Hour labels */}
            <div className="w-12 shrink-0 relative">
              {HOURS.map((h) => (
                <div key={h} style={{ position: "absolute", top: h * HOUR_H - 8, right: 6 }} className="text-[10px] text-slate-400 font-medium select-none">
                  {h === 0 ? "" : formatHour(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, i) => {
              const iso = formatISODate(day);
              const isToday = isSameDate(day, today);
              const dayTimed = filtered.filter((e) => !e.isAllDay && e.date === iso && e.startTime);

              return (
                <div key={i} className="flex-1 border-l border-slate-100/60 relative" style={{ height: TOTAL_H }}>
                  {HOURS.map((h) => (
                    <div key={h} style={{ position: "absolute", top: h * HOUR_H, left: 0, right: 0, height: 1 }} className="bg-slate-100/60" />
                  ))}
                  {isToday && <div style={{ position: "absolute", inset: 0 }} className="bg-violet-50/30 pointer-events-none" />}
                  {isToday && (
                    <div style={{ position: "absolute", top: nowTop, left: 0, right: 0, zIndex: 20, pointerEvents: "none" }} className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-rose-500 -ml-1 shrink-0" />
                      <div className="flex-1 h-px bg-rose-500" />
                    </div>
                  )}

                  <DroppableCol dateISO={iso}>
                    <div
                      style={{ position: "absolute", inset: 0, zIndex: 1 }}
                      onClick={(e) => handleColumnClick(e, day)}
                      className="cursor-pointer"
                    />
                    {dayTimed.map((ev) => {
                      const startMin = timeToMin(ev.startTime!);
                      const endMin = ev.endTime
                        ? (resizing?.ev.id === ev.id ? resizingEndMin : timeToMin(ev.endTime))
                        : startMin + 60;
                      const top = (startMin / 60) * HOUR_H;
                      const height = ((endMin - startMin) / 60) * HOUR_H;

                      const notDraggable = Boolean(
                        ev.organizer?.email
                        && !isServiceAccount(ev.organizer.email)
                        && userEmail
                        && ev.organizer.email.toLowerCase() !== userEmail.toLowerCase()
                      );
                      const canDrag = DRAGGABLE_TYPES.has(ev.type) && !notDraggable;

                      if (canDrag) {
                        return (
                          <DraggableEvent
                            key={ev.id}
                            ev={ev}
                            top={top}
                            height={height}
                            onResizeStart={(e) => handleResizeStart(ev, e)}
                            onSelect={onSelectEvent}
                          />
                        );
                      }
                      return <StaticEventChip key={ev.id} ev={ev} top={top} height={height} onSelect={onSelectEvent} />;
                    })}
                  </DroppableCol>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
