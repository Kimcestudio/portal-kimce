"use client";

import { useEffect, useRef } from "react";
import { Video, X } from "lucide-react";
import { hasMeetingLinks, safeDescriptionHtml, stripHtml } from "@/lib/calendarUtils";

type CalendarModalHoliday = {
  id?: string;
  date: string;
  name: string;
  kind?: "HOLIDAY" | "DAY_OFF";
};

type CalendarModalEvent = {
  id?: string;
  date: string;
  title: string;
  description?: string;
};

type CalendarModalAbsence = {
  id?: string;
  personName: string;
  dateStart: string;
  dateEnd: string;
  type: "VACATION" | "PERMIT";
  status: "APPROVED" | "PENDING";
  reason?: string;
};

type CalendarModalGCalEvent = {
  id: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  htmlLink?: string;
  hangoutLink?: string;
  source?: "personal" | "kimce";
};

interface DayDetailsModalProps {
  open: boolean;
  dateLabel: string;
  holidays: CalendarModalHoliday[];
  events: CalendarModalEvent[];
  absences: CalendarModalAbsence[];
  gcalEvents?: CalendarModalGCalEvent[];
  onClose: () => void;
}

function mapType(type: string) {
  switch (type) {
    case "VACATION":
      return "Vacaciones";
    case "PERMIT":
      return "Permiso";
    case "EVENT":
      return "Evento";
    default:
      return "Feriado";
  }
}

function mapHolidayKind(kind?: "HOLIDAY" | "DAY_OFF") {
  return kind === "DAY_OFF" ? "Día libre global" : "Feriado";
}


export default function DayDetailsModal({
  open,
  dateLabel,
  holidays,
  events,
  absences,
  gcalEvents = [],
  onClose,
}: DayDetailsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape key closes modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus the close button when modal opens
  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const isEmpty = holidays.length + events.length + absences.length + gcalEvents.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles del día — ${dateLabel}`}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white/90 backdrop-blur-md border border-white/70 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">
              {isEmpty ? "Sin eventos este día" : "Detalles del día"}
            </h3>
            <p className="text-sm text-muted">{dateLabel}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          <div className="space-y-3">
            {holidays.map((holiday) => (
              <div
                key={holiday.id ?? `${holiday.date}-${holiday.name}`}
                className="rounded-xl border border-line px-4 py-3"
              >
                <p className="text-sm font-semibold text-ink">{mapHolidayKind(holiday.kind)}</p>
                <p className="text-xs text-muted">{holiday.name}</p>
              </div>
            ))}
            {events.map((event) => (
              <div
                key={event.id ?? `${event.date}-${event.title}`}
                className="rounded-xl border border-line px-4 py-3"
              >
                <p className="text-sm font-semibold text-ink">Evento interno</p>
                <p className="text-xs text-muted">{event.title}</p>
                {event.description ? (
                  <p className="mt-2 text-xs text-slate-500">{event.description}</p>
                ) : null}
              </div>
            ))}
            {absences.map((absence) => (
              <div
                key={absence.id ?? `${absence.personName}-${absence.dateStart}`}
                className="rounded-xl border border-line px-4 py-3"
              >
                <p className="text-sm font-semibold text-ink">{mapType(absence.type)}</p>
                <p className="text-xs text-muted">Persona: {absence.personName}</p>
                <p className="text-xs text-slate-500">
                  {absence.dateStart === absence.dateEnd
                    ? `Fecha: ${absence.dateStart}`
                    : `Rango: ${absence.dateStart} al ${absence.dateEnd}`}
                </p>
                {absence.reason ? (
                  <p className="mt-2 text-xs text-slate-500">{absence.reason}</p>
                ) : null}
              </div>
            ))}
            {gcalEvents.map((event) => {
              const isPersonal = event.source === "personal";
              const hasEmbedded = event.description ? hasMeetingLinks(event.description) : false;
              return (
                <div
                  key={event.id}
                  className={`rounded-xl border px-4 py-3 ${
                    isPersonal ? "border-indigo-200 bg-indigo-50" : "border-sky-200 bg-sky-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${isPersonal ? "bg-[#6366f1]" : "bg-[#0ea5e9]"}`} aria-hidden="true" />
                    <p className="text-sm font-semibold text-ink">{event.title}</p>
                  </div>
                  {!event.isAllDay && event.startTime ? (
                    <p className="mt-0.5 text-xs text-muted">{event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted">Todo el día</p>
                  )}
                  {event.description && (
                    hasEmbedded ? (
                      <div className="mt-1 text-xs text-slate-500 [&_a]:text-emerald-700 [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: safeDescriptionHtml(event.description) }} />
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">{stripHtml(event.description)}</p>
                    )
                  )}
                  {(event.htmlLink || event.hangoutLink) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {event.hangoutLink && (
                        <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        ><Video size={10} />Unirse a Meet</a>
                      )}
                      {event.htmlLink && (
                        <a href={event.htmlLink} target="_blank" rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${isPersonal ? "border-indigo-200 text-indigo-600 hover:bg-indigo-100" : "border-sky-200 text-sky-600 hover:bg-sky-100"}`}
                        >Ver en Calendar</a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {isEmpty ? (
              <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                No hay eventos registrados para este día.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
