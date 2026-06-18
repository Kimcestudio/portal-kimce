"use client";

import { useState } from "react";
import { CalendarDays, ExternalLink, Link2, Loader2, MapPin, RefreshCw, Video } from "lucide-react";
import DashboardCard from "@/components/home/DashboardCard";
import Modal from "@/components/attendance/Modal";
import type { HomeEvent } from "@/lib/homeDashboardMocks";

interface EventsCardProps {
  items: HomeEvent[];
  onConnectCalendar?: () => void;
  isConnectingCalendar?: boolean;
  calendarStatus?: string | null;
  calendarConnected?: boolean;
}

export default function EventsCard({
  items,
  onConnectCalendar,
  isConnectingCalendar = false,
  calendarStatus,
  calendarConnected = false,
}: EventsCardProps) {
  const [selectedEvent, setSelectedEvent] = useState<HomeEvent | null>(null);

  return (
    <>
      <DashboardCard
        title="Eventos"
        subtitle="Próximas actividades del calendario"
        rightSlot={
          onConnectCalendar ? (
            <button
              type="button"
              onClick={onConnectCalendar}
              disabled={isConnectingCalendar}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnectingCalendar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : calendarConnected ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              {calendarConnected ? "Actualizar" : "Vincular"}
            </button>
          ) : null
        }
        className="lg:col-span-2"
      >
        {calendarStatus ? (
          <p className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
            {calendarStatus}
          </p>
        ) : null}
        <div className="max-h-72 space-y-2 overflow-auto pr-1">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No hay eventos próximos.</p>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(item)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="rounded-full bg-indigo-100 p-2 text-indigo-600">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="line-clamp-2 text-xs text-slate-500">{item.description ?? "Sin descripción"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {item.source ? <p className="text-[11px] font-semibold text-indigo-500">{item.source}</p> : null}
                        {item.location ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                            <MapPin className="h-3 w-3" />
                            {item.location}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <p className="text-xs font-semibold text-slate-600">{item.dateLabel}</p>
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full p-1 text-indigo-500 transition hover:bg-indigo-100"
                        title="Abrir en Google Calendar"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </DashboardCard>

      <Modal
        title={selectedEvent?.title ?? "Detalle del evento"}
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
      >
        {selectedEvent ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fecha</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedEvent.dateLabel}</p>
            </div>

            {selectedEvent.description ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Descripcion</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{selectedEvent.description}</p>
              </div>
            ) : null}

            {selectedEvent.location ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ubicacion</p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-700">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {selectedEvent.location}
                </p>
              </div>
            ) : null}

            {selectedEvent.source ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Origen</p>
                <p className="mt-1 text-sm font-medium text-indigo-600">{selectedEvent.source}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              {selectedEvent.meetingUrl ? (
                <a
                  href={selectedEvent.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <Video className="h-4 w-4" />
                  Unirse a Meet
                </a>
              ) : null}

              {selectedEvent.href ? (
                <a
                  href={selectedEvent.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver en Google Calendar
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
