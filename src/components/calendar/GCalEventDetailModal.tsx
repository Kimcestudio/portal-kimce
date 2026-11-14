"use client";

import { useEffect, useRef } from "react";
import { MapPin, Pencil, Trash2, Users, Video, X } from "lucide-react";
import { hasHtmlMarkup, safeDescriptionHtml, stripHtml } from "@/lib/calendarUtils";

type ModalAttendee = {
  email: string;
  displayName?: string;
  responseStatus?: string;
};

export type DetailGCalEvent = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  htmlLink?: string;
  hangoutLink?: string;
  attendees?: ModalAttendee[];
  organizer?: { email: string; displayName?: string };
  source?: "personal" | "kimce";
};

interface GCalEventDetailModalProps {
  open: boolean;
  event: DetailGCalEvent | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function GCalEventDetailModal({
  open,
  event,
  onClose,
  onEdit,
  onDelete,
}: GCalEventDetailModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open || !event) return null;

  const isPersonal = event.source === "personal";
  const timeLabel = event.isAllDay
    ? "Todo el día"
    : `${event.startTime ?? ""}${event.endTime ? ` – ${event.endTime}` : ""}`;
  const hasHtml = event.description ? hasHtmlMarkup(event.description) : false;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white/95 backdrop-blur-md border border-white/70 shadow-2xl">
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 px-6 py-5 border-b ${isPersonal ? "border-indigo-100" : "border-sky-100"}`}>
          <div className="flex-1 min-w-0">
            <div className={`mb-2 h-1 w-10 rounded-full ${isPersonal ? "bg-indigo-400" : "bg-cyan-400"}`} />
            <h3 className="text-base font-semibold text-slate-900 leading-tight">{event.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{timeLabel}</p>
            {event.location && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin size={13} className="shrink-0" />
                {event.location}
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {onEdit && (
              <button
                type="button"
                aria-label="Editar"
                onClick={() => { onEdit(event.id); onClose(); }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <Pencil size={15} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                aria-label="Eliminar"
                onClick={() => { onDelete(event.id); onClose(); }}
                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-y-auto p-6 space-y-5">
          {event.hangoutLink && (
            <a
              href={event.hangoutLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              <Video size={15} />
              Unirse a Meet
            </a>
          )}

          {event.description && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Descripción</p>
              {hasHtml ? (
                <div
                  className="text-sm text-slate-600 leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800 [&_br]:block [&_p]:mb-2"
                  dangerouslySetInnerHTML={{ __html: safeDescriptionHtml(event.description) }}
                />
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {stripHtml(event.description)}
                </p>
              )}
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Users size={11} />
                Asistentes ({event.attendees.length})
              </p>
              <div className="space-y-2">
                {event.attendees.map((a) => {
                  const name = a.displayName || a.email.split("@")[0];
                  const statusColor =
                    a.responseStatus === "accepted" ? "bg-emerald-400" :
                    a.responseStatus === "declined" ? "bg-rose-400" :
                    a.responseStatus === "tentative" ? "bg-amber-400" : "bg-slate-300";
                  const statusLabel =
                    a.responseStatus === "accepted" ? "Aceptó" :
                    a.responseStatus === "declined" ? "Rechazó" :
                    a.responseStatus === "tentative" ? "Tentativo" : "Sin respuesta";
                  return (
                    <div key={a.email} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
                        <span className="truncate text-sm text-slate-700">{name}</span>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{statusLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {event.htmlLink && (
            <div className="pt-1">
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  isPersonal
                    ? "border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    : "border-sky-200 text-sky-600 hover:bg-sky-50"
                }`}
              >
                Ver en Google Calendar
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
