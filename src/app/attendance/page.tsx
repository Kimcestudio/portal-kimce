"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import SidebarNav from "@/components/SidebarNav";
import TodayAttendanceCard from "@/components/attendance/TodayAttendanceCard";
import WeeklySummaryMiniCards from "@/components/attendance/WeeklySummaryMiniCards";
import WeeklyTable from "@/components/attendance/WeeklyTable";
import ExtrasPermitsTab from "@/components/attendance/ExtrasPermitsTab";
import Modal from "@/components/attendance/Modal";
import {
  formatISODate,
  getWeekDates,
  getWeekStartMonday,
  minutesToHHMM,
  expectedMinutesForDate,
} from "@/lib/attendanceUtils";
import {
  AttendanceRecord,
  CorrectionRequest,
  ExtraActivity,
  Request,
  checkOut,
  createCheckIn,
  createCorrectionRequest,
  createExtraActivity,
  createRequest,
  endBreak,
  getTodayRecord,
  listRecentCorrections,
  listRecentExtras,
  listRecentRequests,
  listRecordsForWeek,
  saveNote,
  startBreak,
} from "@/lib/storage/attendanceStorage";

const userId = "demo-user";
const role = "COLLABORATOR";

type AttendanceStatus = "OFF" | "IN_SHIFT" | "ON_BREAK" | "CLOSED";

type CorrectionDraft = {
  date: string;
  attendanceId: string;
  proposedChanges: string;
  reason: string;
};

const emptyCorrection: CorrectionDraft = {
  date: "",
  attendanceId: "",
  proposedChanges: "",
  reason: "",
};

function computeBreakMinutes(record: AttendanceRecord | null) {
  if (!record) return 0;
  return record.breaks.reduce((total, current) => {
    if (!current.endAt) return total;
    const start = new Date(current.startAt).getTime();
    const end = new Date(current.endAt).getTime();
    return total + Math.max(0, Math.round((end - start) / 60000));
  }, 0);
}

function computeStatus(record: AttendanceRecord | null): AttendanceStatus {
  if (!record) return "OFF";
  if (record.checkOutAt) return "CLOSED";
  const hasOpenBreak = record.breaks.some((item) => !item.endAt);
  return hasOpenBreak ? "ON_BREAK" : "IN_SHIFT";
}

export default function AttendancePage() {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>([]);
  const [extras, setExtras] = useState<ExtraActivity[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"week" | "extras">("week");
  const [filter, setFilter] = useState<"ALL" | "PENDING">("ALL");
  const [extraOpen, setExtraOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [extraDraft, setExtraDraft] = useState({
    date: formatISODate(new Date()),
    minutes: 60,
    type: "Reunión",
    project: "",
    note: "",
  });
  const [requestDraft, setRequestDraft] = useState({
    type: "DIA_LIBRE",
    date: formatISODate(new Date()),
    endDate: "",
    hours: 1,
    reason: "",
  });
  const [correctionDraft, setCorrectionDraft] = useState<CorrectionDraft>(emptyCorrection);

  const weekStart = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeekStartMonday(base);
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const reloadToday = () => {
    const todayISO = formatISODate(new Date());
    const record = getTodayRecord(userId, todayISO);
    setTodayRecord(record);
    setNote(record?.notes ?? "");
  };

  const reloadWeek = () => {
    const records = listRecordsForWeek(userId, formatISODate(weekStart));
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    const filtered = records.filter((record) => {
      const date = new Date(`${record.date}T00:00:00`);
      return date >= weekStart && date < end;
    });
    setWeekRecords(filtered);
  };

  const reloadExtras = () => {
    setExtras(listRecentExtras(userId, 6));
    setRequests(listRecentRequests(userId, 6));
    setCorrections(listRecentCorrections(userId, 6));
  };

  useEffect(() => {
    reloadToday();
  }, []);

  useEffect(() => {
    reloadWeek();
  }, [weekStart]);

  useEffect(() => {
    reloadExtras();
  }, [extraOpen, requestOpen, correctionOpen]);

  const status = computeStatus(todayRecord);
  const breakMinutes = computeBreakMinutes(todayRecord);
  const totalMinutes = todayRecord?.totalMinutes ?? 0;

  const expectedMinutesWeek = weekDates.reduce(
    (total, date) => total + expectedMinutesForDate(date),
    0
  );
  const workedMinutesWeek = weekRecords.reduce((total, record) => total + record.totalMinutes, 0);
  const diffMinutes = workedMinutesWeek - expectedMinutesWeek;
  const completedDays = weekRecords.filter(
    (record) => record.status === "CLOSED" && new Date(`${record.date}T00:00:00`).getDay() !== 0
  ).length;

  const handleInvalid = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  const handleCheckIn = () => {
    if (status !== "OFF") {
      handleInvalid("Ya existe un registro abierto hoy.");
      return;
    }
    createCheckIn(userId, new Date());
    reloadToday();
    reloadWeek();
  };

  const handleStartBreak = () => {
    if (status !== "IN_SHIFT") {
      handleInvalid("No puedes iniciar descanso ahora.");
      return;
    }
    startBreak(userId, new Date());
    reloadToday();
  };

  const handleEndBreak = () => {
    if (status !== "ON_BREAK") {
      handleInvalid("No hay descanso activo.");
      return;
    }
    endBreak(userId, new Date());
    reloadToday();
  };

  const handleCheckOut = () => {
    if (status !== "IN_SHIFT") {
      handleInvalid("Debes finalizar descanso antes de salir.");
      return;
    }
    checkOut(userId, new Date());
    reloadToday();
    reloadWeek();
  };

  const handleSaveNote = () => {
    const dateISO = formatISODate(new Date());
    if (!todayRecord) {
      handleInvalid("Primero marca tu entrada.");
      return;
    }
    saveNote(userId, dateISO, note.trim());
    reloadToday();
  };

  const handleSubmitExtra = () => {
    createExtraActivity(userId, {
      date: extraDraft.date,
      minutes: extraDraft.minutes,
      type: extraDraft.type as ExtraActivity["type"],
      project: extraDraft.project || undefined,
      note: extraDraft.note || undefined,
    });
    setExtraOpen(false);
    setExtraDraft({ ...extraDraft, project: "", note: "" });
    reloadExtras();
  };

  const handleSubmitRequest = () => {
    createRequest(userId, {
      type: requestDraft.type as Request["type"],
      date: requestDraft.date,
      endDate: requestDraft.endDate || undefined,
      hours: requestDraft.type === "PERMISO_HORAS" ? requestDraft.hours : undefined,
      reason: requestDraft.reason,
    });
    setRequestOpen(false);
    setRequestDraft({ ...requestDraft, reason: "" });
    reloadExtras();
  };

  const handleSubmitCorrection = () => {
    createCorrectionRequest(userId, {
      date: correctionDraft.date,
      attendanceId: correctionDraft.attendanceId,
      proposedChanges: correctionDraft.proposedChanges,
      reason: correctionDraft.reason,
    });
    setCorrectionOpen(false);
    setCorrectionDraft(emptyCorrection);
    reloadExtras();
  };

  const handleOpenCorrection = (dateISO: string, attendanceId: string) => {
    setCorrectionDraft({ date: dateISO, attendanceId, proposedChanges: "", reason: "" });
    setCorrectionOpen(true);
  };

  return (
    <AppShell sidebar={<SidebarNav />}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Horario</h1>
            <p className="text-sm text-muted">Usuario: {role}</p>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-muted shadow-soft">
            Semana actual · {formatISODate(weekStart)}
          </div>
        </div>

        <TodayAttendanceCard
          status={status}
          record={todayRecord}
          breakMinutes={breakMinutes}
          totalMinutes={totalMinutes}
          note={note}
          onNoteChange={setNote}
          onSaveNote={handleSaveNote}
          onCheckIn={handleCheckIn}
          onStartBreak={handleStartBreak}
          onEndBreak={handleEndBreak}
          onCheckOut={handleCheckOut}
          message={message}
        />

        <WeeklySummaryMiniCards
          workedMinutes={workedMinutesWeek}
          expectedMinutes={expectedMinutesWeek}
          diffMinutes={diffMinutes}
          completedDays={completedDays}
        />

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  activeTab === "week" ? "bg-primary text-white" : "bg-canvas text-muted"
                }`}
                onClick={() => setActiveTab("week")}
                type="button"
              >
                Semana
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  activeTab === "extras" ? "bg-primary text-white" : "bg-canvas text-muted"
                }`}
                onClick={() => setActiveTab("extras")}
                type="button"
              >
                Extras y Permisos
              </button>
            </div>
            {activeTab === "week" ? (
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  type="button"
                >
                  Semana anterior
                </button>
                <button
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted"
                  onClick={() => setWeekOffset(0)}
                  type="button"
                >
                  Semana actual
                </button>
                <button
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  type="button"
                >
                  Semana siguiente
                </button>
              </div>
            ) : null}
          </div>

          {activeTab === "week" ? (
            <WeeklyTable
              weekDates={weekDates}
              records={weekRecords}
              onRequestCorrection={handleOpenCorrection}
            />
          ) : (
            <ExtrasPermitsTab
              extras={extras}
              requests={requests}
              corrections={corrections}
              filter={filter}
              onFilterChange={setFilter}
              onOpenExtra={() => setExtraOpen(true)}
              onOpenRequest={() => setRequestOpen(true)}
            />
          )}
        </div>
      </div>

      <Modal title="Registrar actividad extra" open={extraOpen} onClose={() => setExtraOpen(false)}>
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-muted">
            Fecha
            <input
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              type="date"
              value={extraDraft.date}
              onChange={(event) =>
                setExtraDraft((prev) => ({ ...prev, date: event.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Duración (minutos)
            <input
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              type="number"
              min={15}
              value={extraDraft.minutes}
              onChange={(event) =>
                setExtraDraft((prev) => ({ ...prev, minutes: Number(event.target.value) }))
              }
            />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Tipo
            <select
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={extraDraft.type}
              onChange={(event) =>
                setExtraDraft((prev) => ({ ...prev, type: event.target.value }))
              }
            >
              <option>Reunión</option>
              <option>Grabación</option>
              <option>Urgencia</option>
              <option>Evento</option>
              <option>Otro</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-muted">
            Proyecto
            <input
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              type="text"
              value={extraDraft.project}
              onChange={(event) =>
                setExtraDraft((prev) => ({ ...prev, project: event.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Nota
            <textarea
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              rows={3}
              value={extraDraft.note}
              onChange={(event) =>
                setExtraDraft((prev) => ({ ...prev, note: event.target.value }))
              }
            />
          </label>
          <button
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={handleSubmitExtra}
            type="button"
          >
            Guardar actividad ({minutesToHHMM(extraDraft.minutes)})
          </button>
        </div>
      </Modal>

      <Modal title="Pedir libre / permiso" open={requestOpen} onClose={() => setRequestOpen(false)}>
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-muted">
            Tipo
            <select
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={requestDraft.type}
              onChange={(event) =>
                setRequestDraft((prev) => ({ ...prev, type: event.target.value }))
              }
            >
              <option value="DIA_LIBRE">Día libre</option>
              <option value="PERMISO_HORAS">Permiso por horas</option>
              <option value="MEDICO">Permiso médico</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-muted">
            Fecha
            <input
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              type="date"
              value={requestDraft.date}
              onChange={(event) =>
                setRequestDraft((prev) => ({ ...prev, date: event.target.value }))
              }
            />
          </label>
          {requestDraft.type === "DIA_LIBRE" || requestDraft.type === "MEDICO" ? (
            <label className="block text-xs font-semibold text-muted">
              Fecha fin (opcional)
              <input
                className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
                type="date"
                value={requestDraft.endDate}
                onChange={(event) =>
                  setRequestDraft((prev) => ({ ...prev, endDate: event.target.value }))
                }
              />
            </label>
          ) : null}
          {requestDraft.type === "PERMISO_HORAS" ? (
            <label className="block text-xs font-semibold text-muted">
              Horas
              <input
                className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
                type="number"
                min={1}
                max={8}
                value={requestDraft.hours}
                onChange={(event) =>
                  setRequestDraft((prev) => ({ ...prev, hours: Number(event.target.value) }))
                }
              />
            </label>
          ) : null}
          <label className="block text-xs font-semibold text-muted">
            Motivo
            <textarea
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              rows={3}
              value={requestDraft.reason}
              onChange={(event) =>
                setRequestDraft((prev) => ({ ...prev, reason: event.target.value }))
              }
            />
          </label>
          <button
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={handleSubmitRequest}
            type="button"
          >
            Enviar solicitud
          </button>
        </div>
      </Modal>

      <Modal title="Solicitar corrección" open={correctionOpen} onClose={() => setCorrectionOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Día: <span className="font-semibold text-ink">{correctionDraft.date}</span>
          </p>
          <label className="block text-xs font-semibold text-muted">
            ¿Qué quieres corregir?
            <input
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              type="text"
              value={correctionDraft.proposedChanges}
              onChange={(event) =>
                setCorrectionDraft((prev) => ({ ...prev, proposedChanges: event.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Motivo
            <textarea
              className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
              rows={3}
              value={correctionDraft.reason}
              onChange={(event) =>
                setCorrectionDraft((prev) => ({ ...prev, reason: event.target.value }))
              }
            />
          </label>
          <button
            className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={handleSubmitCorrection}
            type="button"
          >
            Enviar corrección
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
