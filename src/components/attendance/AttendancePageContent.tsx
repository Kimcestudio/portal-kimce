"use client";

import PageHeader from "@/components/PageHeader";
import Modal from "@/components/attendance/Modal";
import ExtrasPermitsTab from "@/components/attendance/ExtrasPermitsTab";
import TodayAttendanceCard from "@/components/attendance/TodayAttendanceCard";
import WeekStatusSummary from "@/components/attendance/WeekStatusSummary";
import WeeklyProgressChart from "@/components/attendance/WeeklyProgressChart";
import WeeklySummaryMiniCards from "@/components/attendance/WeeklySummaryMiniCards";
import WeeklyTable from "@/components/attendance/WeeklyTable";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatISODate, minutesToHHMM } from "@/lib/attendanceUtils";
import { useAttendanceRequests } from "@/components/attendance/useAttendanceRequests";
import { useAttendanceSession } from "@/components/attendance/useAttendanceSession";

const formatGoalHours = (minutes: number) => {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
};

export default function AttendancePageContent() {
  const { user } = useAuth();

  const requestsState = useAttendanceRequests(user);
  const attendance = useAttendanceSession({
    user,
    approvedExtraActivities: requestsState.approvedExtraActivities,
    approvedHourRequests: requestsState.approvedHourRequests,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        userName={user?.displayName ?? user?.email ?? undefined}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500">
            <span>{formatISODate(attendance.weekStart)}</span>
            <span className="h-3 w-px bg-slate-200" />
            <span>{attendance.schedule.name}</span>
            <span className="h-3 w-px bg-slate-200" />
            <span>Meta {formatGoalHours(attendance.weeklyGoalMinutes)}/sem · {formatGoalHours(attendance.dailyGoalMinutes)}/día</span>
          </div>
        }
      />

      <TodayAttendanceCard
        status={attendance.status}
        record={attendance.todayRecord}
        breakMinutes={attendance.breakMinutes}
        totalMinutes={attendance.totalMinutes}
        note={attendance.note}
        onNoteChange={attendance.setNote}
        onSaveNote={attendance.handleSaveNote}
        onCheckIn={attendance.handleCheckIn}
        onStartBreak={attendance.handleStartBreak}
        onEndBreak={attendance.handleEndBreak}
        onCheckOut={attendance.handleCheckOut}
        message={attendance.message}
      />

      <WeeklySummaryMiniCards
        workedMinutes={attendance.workedMinutesWeek}
        expectedMinutes={attendance.expectedMinutesWeek}
        diffMinutes={attendance.diffMinutes}
        completedDays={attendance.completedDays}
        totalBalanceMinutes={attendance.totalBalanceMinutes}
      />

      <WeeklyProgressChart
        data={attendance.chartData}
        totalMinutes={attendance.workedMinutesWeek}
        expectedMinutes={attendance.expectedMinutesWeek}
        diffMinutes={attendance.diffMinutes}
        completedDays={attendance.completedDays}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Extras y Permisos</h2>
          <p className="text-xs text-slate-400">
            Registra actividades extra o solicita permisos/vacaciones.
          </p>
        </div>
        <ExtrasPermitsTab
          extras={requestsState.extras}
          requests={requestsState.requests}
          corrections={requestsState.corrections}
          filter={requestsState.filter}
          onFilterChange={requestsState.setFilter}
          onOpenExtra={() => requestsState.setExtraOpen(true)}
          onOpenRequest={() => requestsState.setRequestOpen(true)}
          pendingCount={
            requestsState.pendingHourRequestsCount + requestsState.pendingExtraActivitiesCount
          }
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5" id="mi-semana">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Mi semana</h2>
            <p className="text-xs text-slate-400">Tu registro diario y horas por día.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              onClick={() => attendance.setWeekOffset((prev) => prev - 1)}
              type="button"
            >
              ← Anterior
            </button>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              onClick={() => attendance.setWeekOffset(0)}
              type="button"
            >
              Hoy
            </button>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              onClick={() => attendance.setWeekOffset((prev) => prev + 1)}
              type="button"
            >
              Siguiente →
            </button>
          </div>
        </div>
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-400">Resumen visual</p>
          <div className="mt-2">
            <WeekStatusSummary weekDates={attendance.weekDates} records={attendance.weekRecords} />
          </div>
        </div>
        <WeeklyTable
          weekDates={attendance.weekDates}
          records={attendance.weekRecords}
          credits={attendance.approvedCredits}
          onRequestCorrection={requestsState.handleOpenCorrection}
        />
      </div>

      <Modal
        title="Registrar actividad extra"
        open={requestsState.extraOpen}
        onClose={() => requestsState.setExtraOpen(false)}
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-500">
            Fecha
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="date"
              value={requestsState.extraDraft.date}
              onChange={(event) =>
                requestsState.setExtraDraft((prev) => ({ ...prev, date: event.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Duración (minutos)
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="number"
              min={15}
              value={requestsState.extraDraft.minutes}
              onChange={(event) =>
                requestsState.setExtraDraft((prev) => ({
                  ...prev,
                  minutes: Number(event.target.value),
                }))
              }
            />
          </label>
          <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            Nota: las actividades extra aprobadas sí se suman a tus horas trabajadas y al balance general.
          </p>
          <label className="block text-xs font-semibold text-slate-500">
            Tipo
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={requestsState.extraDraft.type}
              onChange={(event) =>
                requestsState.setExtraDraft((prev) => ({ ...prev, type: event.target.value }))
              }
            >
              <option>Reunión</option>
              <option>Grabación</option>
              <option>Urgencia</option>
              <option>Evento</option>
              <option>Otro</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Proyecto
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="text"
              value={requestsState.extraDraft.project}
              onChange={(event) =>
                requestsState.setExtraDraft((prev) => ({ ...prev, project: event.target.value }))
              }
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Nota
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={requestsState.extraDraft.note}
              onChange={(event) =>
                requestsState.setExtraDraft((prev) => ({ ...prev, note: event.target.value }))
              }
            />
          </label>
          {requestsState.requestsMessage ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {requestsState.requestsMessage}
            </p>
          ) : null}
          <button
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={requestsState.handleSubmitExtra}
            type="button"
          >
            Guardar actividad ({minutesToHHMM(requestsState.extraDraft.minutes)})
          </button>
        </div>
      </Modal>

      <Modal
        title="Pedir libre / permiso"
        open={requestsState.requestOpen}
        onClose={() => requestsState.setRequestOpen(false)}
      >
        <div className="space-y-4">
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Nota: pedir libre/permiso no suma horas trabajadas. Solo documenta la ausencia y el saldo de horas se mantiene según los registros de entrada/salida.
          </p>
          <label className="block text-xs font-semibold text-slate-500">
            Tipo
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={requestsState.requestDraft.type}
              onChange={(event) =>
                requestsState.setRequestDraft((prev) => ({ ...prev, type: event.target.value }))
              }
            >
              <option value="DIA_LIBRE">Día libre</option>
              <option value="PERMISO_HORAS">Permiso por horas</option>
              <option value="MEDICO">Permiso médico</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Fecha
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="date"
              value={requestsState.requestDraft.date}
              onChange={(event) =>
                requestsState.setRequestDraft((prev) => ({ ...prev, date: event.target.value }))
              }
            />
          </label>
          {requestsState.requestDraft.type === "DIA_LIBRE" ||
          requestsState.requestDraft.type === "MEDICO" ? (
            <label className="block text-xs font-semibold text-slate-500">
              Fecha fin (opcional)
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="date"
                value={requestsState.requestDraft.endDate}
                onChange={(event) =>
                  requestsState.setRequestDraft((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
              />
            </label>
          ) : null}
          {requestsState.requestDraft.type === "PERMISO_HORAS" ? (
            <label className="block text-xs font-semibold text-slate-500">
              Horas
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="number"
                min={1}
                max={8}
                value={requestsState.requestDraft.hours}
                onChange={(event) =>
                  requestsState.setRequestDraft((prev) => ({
                    ...prev,
                    hours: Number(event.target.value),
                  }))
                }
              />
            </label>
          ) : null}
          <label className="block text-xs font-semibold text-slate-500">
            Motivo
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={requestsState.requestDraft.reason}
              onChange={(event) =>
                requestsState.setRequestDraft((prev) => ({ ...prev, reason: event.target.value }))
              }
            />
          </label>
          {requestsState.requestsMessage ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {requestsState.requestsMessage}
            </p>
          ) : null}
          <button
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={requestsState.handleSubmitRequest}
            type="button"
          >
            Enviar solicitud
          </button>
        </div>
      </Modal>

      <Modal
        title="Solicitar corrección"
        open={requestsState.correctionOpen}
        onClose={() => requestsState.setCorrectionOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Día:{" "}
            <span className="font-semibold text-slate-900">{requestsState.correctionDraft.date}</span>
          </p>
          <label className="block text-xs font-semibold text-slate-500">
            ¿Qué quieres corregir?
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="text"
              value={requestsState.correctionDraft.proposedChanges}
              onChange={(event) =>
                requestsState.setCorrectionDraft((prev) => ({
                  ...prev,
                  proposedChanges: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Motivo
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={requestsState.correctionDraft.reason}
              onChange={(event) =>
                requestsState.setCorrectionDraft((prev) => ({
                  ...prev,
                  reason: event.target.value,
                }))
              }
            />
          </label>
          <button
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={requestsState.handleSubmitCorrection}
            type="button"
          >
            Enviar corrección
          </button>
        </div>
      </Modal>
    </div>
  );
}
