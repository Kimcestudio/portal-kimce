"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, MapPin, Pencil, Plus, Trash2, Users, Video, X } from "lucide-react";

type PopoverHoliday = { id?: string; date: string; name: string; kind?: "HOLIDAY" | "DAY_OFF" };
type PopoverEvent = { id?: string; date: string; title: string; description?: string };
type PopoverAbsence = {
  id?: string;
  personName: string;
  dateStart: string;
  dateEnd: string;
  type: "VACATION" | "PERMIT";
};
type PopoverAttendee = { email: string; displayName?: string; responseStatus?: string };

export type PopoverGCalEvent = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  htmlLink?: string;
  hangoutLink?: string;
  attendees?: PopoverAttendee[];
  organizer?: { email: string; displayName?: string };
  source?: "personal" | "kimce";
};

type PopoverMeetingEvent = {
  id: string;
  title: string;
  time?: string;
  platformLabel?: string;
  participantCount?: number;
  linkTo: string;
};

interface DayPopoverProps {
  open: boolean;
  anchor: DOMRect | null;
  dateLabel: string;
  holidays: PopoverHoliday[];
  events: PopoverEvent[];
  absences: PopoverAbsence[];
  gcalEvents?: PopoverGCalEvent[];
  meetingEvents?: PopoverMeetingEvent[];
  onClose: () => void;
  onViewGcalEvent?: (event: PopoverGCalEvent) => void;
  onEditGcalEvent?: (eventId: string) => void;
  onDeleteGcalEvent?: (eventId: string) => void;
  onDeleteHoliday?: (id: string) => void;
  onDeleteEvent?: (id: string) => void;
  onDeleteMeeting?: (id: string) => void;
  onCreateGcalEvent?: () => void;
}

const POPOVER_WIDTH = 288;
const MARGIN = 8;

export default function DayPopover({
  open,
  anchor,
  dateLabel,
  holidays,
  events,
  absences,
  gcalEvents = [],
  meetingEvents = [],
  onClose,
  onViewGcalEvent,
  onEditGcalEvent,
  onDeleteGcalEvent,
  onDeleteHoliday,
  onDeleteEvent,
  onDeleteMeeting,
  onCreateGcalEvent,
}: DayPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function mouseHandler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", mouseHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", mouseHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open, onClose]);

  if (!open || !anchor) return null;

  let left = anchor.left;
  if (left + POPOVER_WIDTH > window.innerWidth - MARGIN) {
    left = window.innerWidth - POPOVER_WIDTH - MARGIN;
  }
  if (left < MARGIN) left = MARGIN;

  const spaceBelow = window.innerHeight - anchor.bottom - MARGIN;
  const openAbove = spaceBelow < 320;

  const posStyle: React.CSSProperties = openAbove
    ? { bottom: window.innerHeight - anchor.top + MARGIN }
    : { top: anchor.bottom + MARGIN };

  const isEmpty = holidays.length + events.length + absences.length + gcalEvents.length + meetingEvents.length === 0;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles — ${dateLabel}`}
      style={{ position: "fixed", left, width: POPOVER_WIDTH, zIndex: 60, ...posStyle }}
      className="rounded-2xl border border-white/70 bg-white/95 shadow-[0_8px_32px_rgba(17,24,39,0.18)] backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100/80 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-slate-900">
            {isEmpty ? "Sin eventos" : "Detalles del día"}
          </p>
          <p className="text-[11px] text-slate-400">{dateLabel}</p>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[400px] space-y-2 overflow-y-auto p-3">
        {holidays.map((h) => (
          <div
            key={h.id ?? h.name}
            className="rounded-xl border border-violet-200/60 bg-violet-50 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-violet-700">
                  {h.kind === "DAY_OFF" ? "Día libre global" : "Feriado"}
                </p>
                <p className="text-[11px] text-violet-500">{h.name}</p>
              </div>
              {h.id && onDeleteHoliday && (
                <button
                  type="button"
                  aria-label="Eliminar"
                  onClick={() => { onDeleteHoliday(h.id!); onClose(); }}
                  className="shrink-0 rounded-lg p-1 text-violet-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        ))}

        {events.map((ev) => (
          <div
            key={ev.id ?? ev.title}
            className="rounded-xl border border-sky-200/60 bg-sky-50 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sky-700">Evento interno</p>
                <p className="text-[11px] text-sky-600">{ev.title}</p>
                {ev.description && (
                  <p className="mt-0.5 text-[11px] text-slate-400">{ev.description}</p>
                )}
              </div>
              {ev.id && onDeleteEvent && (
                <button
                  type="button"
                  aria-label="Eliminar"
                  onClick={() => { onDeleteEvent(ev.id!); onClose(); }}
                  className="shrink-0 rounded-lg p-1 text-sky-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        ))}

        {absences.map((a) => (
          <div
            key={a.id ?? `${a.personName}-${a.dateStart}`}
            className="rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2"
          >
            <p className="text-xs font-semibold text-amber-700">
              {a.type === "VACATION" ? "Vacaciones" : "Permiso"}
            </p>
            <p className="text-[11px] text-amber-600">{a.personName}</p>
          </div>
        ))}

        {gcalEvents.map((ev) => {
          const isPersonal = ev.source === "personal";
          const timeLabel = ev.isAllDay
            ? "Todo el día"
            : `${ev.startTime ?? ""}${ev.endTime ? `–${ev.endTime}` : ""}`;
          return (
            <div
              key={ev.id}
              className={`rounded-xl border ${
                isPersonal ? "border-indigo-200/60 bg-indigo-50" : "border-cyan-200/60 bg-cyan-50"
              }`}
            >
              {/* Card — click to open detail modal */}
              <button
                type="button"
                className="flex w-full items-start gap-1.5 px-3 py-2 text-left"
                onClick={() => { onViewGcalEvent?.(ev); onClose(); }}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isPersonal ? "text-indigo-700" : "text-cyan-700"}`}>
                    {ev.title}
                  </p>
                  <p className={`text-[11px] ${isPersonal ? "text-indigo-500" : "text-cyan-500"}`}>
                    {timeLabel}
                  </p>
                  {ev.location && (
                    <p className="mt-0.5 flex items-center gap-0.5 text-[11px] text-slate-400">
                      <MapPin size={9} className="shrink-0" />
                      {ev.location}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                  {onEditGcalEvent && (
                    <button
                      type="button"
                      aria-label="Editar"
                      onClick={(e) => { e.stopPropagation(); onEditGcalEvent(ev.id); onClose(); }}
                      className={`rounded-lg p-1 transition-colors hover:bg-white/60 ${isPersonal ? "text-indigo-300 hover:text-indigo-700" : "text-cyan-300 hover:text-cyan-700"}`}
                    >
                      <Pencil size={11} />
                    </button>
                  )}
                  {onDeleteGcalEvent && (
                    <button
                      type="button"
                      aria-label="Eliminar"
                      onClick={(e) => { e.stopPropagation(); onDeleteGcalEvent(ev.id); onClose(); }}
                      className="rounded-lg p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </button>

              {/* Meet button always visible */}
              {ev.hangoutLink && (
                <div className="px-3 pb-2">
                  <a
                    href={ev.hangoutLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <Video size={9} />Unirse a Meet
                  </a>
                </div>
              )}
            </div>
          );
        })}

        {meetingEvents.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-purple-200/60 bg-purple-50 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-purple-700">Grabación</p>
                <p className="truncate text-[11px] text-purple-600">{m.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {m.time && <span className="text-[11px] text-purple-400">{m.time}</span>}
                  {m.platformLabel && <span className="text-[11px] text-slate-400">{m.platformLabel}</span>}
                  {m.participantCount !== undefined && m.participantCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                      <Users size={9} className="shrink-0" />
                      {m.participantCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <a
                  href={m.linkTo}
                  onClick={onClose}
                  className="inline-flex items-center gap-0.5 rounded-lg border border-purple-200 px-2 py-1 text-[10px] font-semibold text-purple-600 hover:bg-purple-100 transition-colors"
                >
                  <ExternalLink size={9} />
                  Ver
                </a>
                {onDeleteMeeting && (
                  <button
                    type="button"
                    aria-label="Eliminar grabación"
                    onClick={() => { onDeleteMeeting(m.id); onClose(); }}
                    className="rounded-lg p-1 text-purple-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {isEmpty && (
          <p className="py-3 text-center text-[11px] text-slate-400">
            No hay eventos registrados para este día.
          </p>
        )}
      </div>

      {onCreateGcalEvent && (
        <div className="border-t border-slate-100/80 px-3 py-2">
          <button
            type="button"
            onClick={() => { onCreateGcalEvent(); onClose(); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
          >
            <Plus size={12} />
            Agregar evento Google Cal
          </button>
        </div>
      )}
    </div>
  );
}
