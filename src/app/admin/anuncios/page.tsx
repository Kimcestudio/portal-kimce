"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarClock, Pencil, Plus, Power, Sparkles, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import type {
  Announcement,
  AnnouncementAdminStatus,
  AnnouncementAudienceScope,
  AnnouncementDisplayMode,
  AnnouncementFrequency,
  AnnouncementPriority,
  AnnouncementType,
} from "@/lib/announcements/types";
import { getAnnouncementRuntimeStatus, sortAnnouncementsByPriority } from "@/lib/announcements/utils";
import {
  createAnnouncement,
  deleteAnnouncement,
  subscribeAnnouncements,
  updateAnnouncement,
} from "@/services/announcements";

const statusBadge: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  scheduled: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  expired: "bg-rose-100 text-rose-700 border border-rose-200",
  disabled: "bg-slate-100 text-slate-600 border border-slate-200",
  draft: "bg-amber-100 text-amber-700 border border-amber-200",
};

type FormState = {
  title: string;
  message: string;
  type: AnnouncementType;
  adminStatus: AnnouncementAdminStatus;
  displayMode: AnnouncementDisplayMode;
  priority: AnnouncementPriority;
  startAt: string;
  endAt: string;
  frequency: AnnouncementFrequency;
  audienceScope: AnnouncementAudienceScope;
  audienceRoles: string;
  audienceAreas: string;
  audienceUserIds: string;
  dismissible: boolean;
  reappearAfterClose: boolean;
  hideAfterViewed: boolean;
  pinned: boolean;
  durationSeconds: number;
};

const initialForm: FormState = {
  title: "",
  message: "",
  type: "informativo",
  adminStatus: "draft",
  displayMode: "modal",
  priority: "normal",
  startAt: "",
  endAt: "",
  frequency: "once",
  audienceScope: "all",
  audienceRoles: "",
  audienceAreas: "",
  audienceUserIds: "",
  dismissible: true,
  reappearAfterClose: false,
  hideAfterViewed: false,
  pinned: false,
  durationSeconds: 0,
};

const splitValues = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "scheduled" | "expired" | "disabled" | "draft">("all");
  const [form, setForm] = useState<FormState>(initialForm);

  useEffect(() => {
    const unsubscribe = subscribeAnnouncements(setItems, (error) => {
      setToast({
        tone: "error",
        message:
          error.code === "permission-denied"
            ? "No tienes permisos para leer anuncios en Firestore."
            : "No se pudieron cargar los anuncios.",
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const list = useMemo(() => {
    const enriched = sortAnnouncementsByPriority(items).map((item) => ({
      ...item,
      runtimeStatus: getAnnouncementRuntimeStatus(item),
    }));

    if (filter === "all") return enriched;
    return enriched.filter((item) => item.runtimeStatus === filter);
  }, [filter, items]);

  const counters = useMemo(() => {
    const runtime = items.map((item) => getAnnouncementRuntimeStatus(item));
    return {
      active: runtime.filter((value) => value === "active").length,
      scheduled: runtime.filter((value) => value === "scheduled").length,
      expired: runtime.filter((value) => value === "expired").length,
      disabled: runtime.filter((value) => value === "disabled").length,
      draft: runtime.filter((value) => value === "draft").length,
    };
  }, [items]);

  const resetForm = () => {
    setEditing(null);
    setForm(initialForm);
  };

  const onEdit = (item: Announcement) => {
    setEditing(item);
    setForm({
      title: item.title,
      message: item.message,
      type: item.type,
      adminStatus: item.adminStatus,
      displayMode: item.displayMode,
      priority: item.priority,
      startAt: item.startAt ? item.startAt.slice(0, 16) : "",
      endAt: item.endAt ? item.endAt.slice(0, 16) : "",
      frequency: item.frequency,
      audienceScope: item.audience.scope,
      audienceRoles: (item.audience.roles ?? []).join(", "),
      audienceAreas: (item.audience.areas ?? []).join(", "),
      audienceUserIds: (item.audience.userIds ?? []).join(", "),
      dismissible: item.visibility.dismissible,
      reappearAfterClose: item.visibility.reappearAfterClose,
      hideAfterViewed: item.visibility.hideAfterViewed,
      pinned: item.visibility.pinned,
      durationSeconds: item.visibility.durationSeconds,
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;

    setIsSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        adminStatus: form.adminStatus,
        displayMode: form.displayMode,
        priority: form.priority,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        frequency: form.frequency,
        audience: {
          scope: form.audienceScope,
          roles: splitValues(form.audienceRoles),
          areas: splitValues(form.audienceAreas),
          userIds: splitValues(form.audienceUserIds),
        },
        visibility: {
          dismissible: form.dismissible,
          reappearAfterClose: form.reappearAfterClose,
          hideAfterViewed: form.hideAfterViewed,
          pinned: form.pinned,
          durationSeconds: form.durationSeconds,
        },
        createdBy: editing?.createdBy ?? user?.uid ?? null,
        updatedBy: user?.uid ?? null,
      };

      if (editing) {
        await updateAnnouncement(editing.id, payload);
        setToast({ tone: "success", message: "Anuncio actualizado correctamente." });
      } else {
        await createAnnouncement(payload);
        setToast({ tone: "success", message: "Anuncio creado correctamente." });
      }
      resetForm();
    } catch (error) {
      const firestoreError = error as { code?: string };
      setToast({
        tone: "error",
        message:
          firestoreError.code === "permission-denied"
            ? "No tienes permisos para crear o editar anuncios (permission-denied)."
            : "Ocurrió un error al guardar el anuncio.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (item: Announcement) => {
    try {
      const nextStatus: AnnouncementAdminStatus = item.adminStatus === "disabled" ? "active" : "disabled";
      await updateAnnouncement(item.id, {
        adminStatus: nextStatus,
        updatedBy: user?.uid ?? null,
      });
      setToast({ tone: "success", message: "Estado del anuncio actualizado." });
    } catch (error) {
      const firestoreError = error as { code?: string };
      setToast({
        tone: "error",
        message:
          firestoreError.code === "permission-denied"
            ? "No tienes permisos para cambiar el estado del anuncio."
            : "No se pudo actualizar el estado del anuncio.",
      });
    }
  };

  const handleDelete = async (item: Announcement) => {
    const confirmed = window.confirm(`¿Eliminar anuncio \"${item.title}\"?`);
    if (!confirmed) return;
    try {
      await deleteAnnouncement(item.id);
      if (editing?.id === item.id) {
        resetForm();
      }
      setToast({ tone: "success", message: "Anuncio eliminado." });
    } catch (error) {
      const firestoreError = error as { code?: string };
      setToast({
        tone: "error",
        message:
          firestoreError.code === "permission-denied"
            ? "No tienes permisos para eliminar anuncios."
            : "No se pudo eliminar el anuncio.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />

      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-white via-indigo-50/40 to-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <Bell className="h-3.5 w-3.5" />
              Módulo de anuncios internos
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1f2a44]">Gestión de anuncios</h1>
            <p className="text-sm text-slate-500">Crea, programa y prioriza anuncios para colaboradores sin saturar la experiencia.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f56d3] to-[#6670ff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(79,86,211,0.35)] transition hover:-translate-y-0.5"
            onClick={resetForm}
          >
            <Plus className="h-4 w-4" />
            Nuevo anuncio
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["all", "active", "scheduled", "expired", "disabled", "draft"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                filter === status ? "bg-[#1f2a44] text-white" : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {status === "all" ? "Todos" : status} {status !== "all" ? `(${counters[status]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {toast ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-indigo-50/60 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Anuncio</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Prioridad</th>
                  <th className="px-3 py-3">Vigencia</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const runtimeStatus = getAnnouncementRuntimeStatus(item);
                  return (
                    <tr key={item.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <p className="line-clamp-2 text-xs text-slate-500">{item.message}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{item.type}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-700">{item.priority}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        <p>{item.startAt ? new Date(item.startAt).toLocaleString() : "Inmediato"}</p>
                        <p>{item.endAt ? `→ ${new Date(item.endAt).toLocaleString()}` : "Sin fin"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusBadge[runtimeStatus]}`}>
                          {runtimeStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">
                      No hay anuncios para el filtro seleccionado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/30 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#1f2a44]">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            {editing ? "Editar anuncio" : "Crear anuncio"}
          </h2>
          <label className="block text-xs font-semibold text-slate-600">
            Título
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Mensaje
            <textarea
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              className="mt-1 h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Tipo
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as AnnouncementType }))}
              >
                <option value="informativo">Informativo</option>
                <option value="urgente">Urgente</option>
                <option value="recordatorio">Recordatorio</option>
                <option value="comunicado_interno">Comunicado interno</option>
                <option value="operativo">Operativo</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Estado admin
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.adminStatus}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, adminStatus: event.target.value as AnnouncementAdminStatus }))
                }
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="disabled">Desactivado</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Visualización
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.displayMode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, displayMode: event.target.value as AnnouncementDisplayMode }))
                }
              >
                <option value="modal">Modal emergente</option>
                <option value="floating">Ventana flotante</option>
                <option value="banner">Aviso superior</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Prioridad
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.priority}
                onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as AnnouncementPriority }))}
              >
                <option value="normal">Normal</option>
                <option value="important">Importante</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Frecuencia
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.frequency}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, frequency: event.target.value as AnnouncementFrequency }))
                }
              >
                <option value="once">Mostrar una sola vez</option>
                <option value="every_login">Cada inicio de sesión</option>
                <option value="daily">Una vez al día</option>
                <option value="weekly">Una vez por semana</option>
                <option value="always">Siempre que esté vigente</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Público objetivo
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form.audienceScope}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, audienceScope: event.target.value as AnnouncementAudienceScope }))
                }
              >
                <option value="all">Todos los colaboradores</option>
                <option value="roles">Solo roles específicos</option>
                <option value="areas">Solo áreas específicas</option>
                <option value="users">Solo usuarios específicos</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Inicio de vigencia
              <span className="ml-1 inline-flex"><CalendarClock className="inline h-3 w-3 text-indigo-400" /></span>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Fin de vigencia
              <span className="ml-1 inline-flex"><CalendarClock className="inline h-3 w-3 text-indigo-400" /></span>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Roles (separados por coma)
              <input
                value={form.audienceRoles}
                onChange={(event) => setForm((prev) => ({ ...prev, audienceRoles: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="admin, collab"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Áreas (separadas por coma)
              <input
                value={form.audienceAreas}
                onChange={(event) => setForm((prev) => ({ ...prev, audienceAreas: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Diseño, Operaciones"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Usuarios UID (separados por coma)
              <input
                value={form.audienceUserIds}
                onChange={(event) => setForm((prev) => ({ ...prev, audienceUserIds: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="uid_1, uid_2"
              />
            </label>
          </div>

          <label className="text-xs font-semibold text-slate-600">
            Duración visible (segundos, 0 = sin auto-cierre)
            <input
              type="number"
              min={0}
              value={form.durationSeconds}
              onChange={(event) => setForm((prev) => ({ ...prev, durationSeconds: Number(event.target.value) || 0 }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <input
                type="checkbox"
                checked={form.dismissible}
                onChange={(event) => setForm((prev) => ({ ...prev, dismissible: event.target.checked }))}
              />
              Se puede cerrar manualmente
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <input
                type="checkbox"
                checked={form.reappearAfterClose}
                onChange={(event) => setForm((prev) => ({ ...prev, reappearAfterClose: event.target.checked }))}
              />
              Reaparece tras cerrar
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <input
                type="checkbox"
                checked={form.hideAfterViewed}
                onChange={(event) => setForm((prev) => ({ ...prev, hideAfterViewed: event.target.checked }))}
              />
              Desaparece al ser visto
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(event) => setForm((prev) => ({ ...prev, pinned: event.target.checked }))}
              />
              Queda fijo mientras vigente
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-2xl bg-gradient-to-r from-[#4f56d3] to-[#6670ff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(79,86,211,0.35)] disabled:opacity-50"
            >
              {isSaving ? "Guardando..." : editing ? "Actualizar anuncio" : "Crear anuncio"}
            </button>
            {editing ? (
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                onClick={resetForm}
              >
                Cancelar edición
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
