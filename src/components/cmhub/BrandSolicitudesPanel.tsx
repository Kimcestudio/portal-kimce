"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownUp,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Loader2,
  MessageCircle,
  Pencil,
  RotateCcw,
  Search,
  SendHorizonal,
  Sheet,
  UserRound,
  X,
} from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase/client";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/services/firebase/client";
import {
  subscribeContentRequests,
  updateContentRequest,
  deleteContentRequest,
  deleteAllContentRequests,
  AREA_COLOR,
  type ContentRequest,
} from "@/services/contentRequests";
import { useHub } from "@/cmhub/context";

function StatusBadge({ status }: { status: ContentRequest["status"] }) {
  return status === "finalizado" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#16a34a]">
      <Check size={9} />
      FINALIZADO
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-bold text-[#d97706]">
      PENDIENTE
    </span>
  );
}

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-PE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function DeadlinePill({ deadline }: { deadline: string }) {
  if (!deadline || deadline === "—") return null;
  let label = "—";
  try { label = new Date(deadline + "T00:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" }); } catch { label = deadline; }
  const diff = Math.ceil((new Date(deadline + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (isNaN(diff)) return null;
  const cls = diff < 0
    ? "bg-[#fee2e2] text-[#dc2626]"
    : diff <= 3
    ? "bg-[#fef3c7] text-[#b45309]"
    : "bg-[#f3f4f6] text-[#6b7280]";
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <CalendarClock size={10} />
      {label}
    </span>
  );
}

type Props = { brandId: string; sheetId?: string; brandName?: string };

export default function BrandSolicitudesPanel({ brandId, sheetId, brandName }: Props) {
  const { team } = useHub();
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);
  const [derivingId, setDerivingId] = useState<string | null>(null);

  // Estado para el flujo "Entregar": qué solicitud está en modo entrega y la nota que se escribe
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [deliverNote, setDeliverNote] = useState("");

  // Estado para editar nota post-entrega
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pendiente" | "finalizado">("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    const unsub = subscribeContentRequests(
      brandId,
      (data) => { setRequests(data); setLoading(false); },
      () => setLoading(false),
    );
    return () => unsub();
  }, [brandId]);

  function startDelivery(req: ContentRequest) {
    setDeliverNote(req.update ?? "");
    setDeliveringId(req.id);
    setEditingId(null);
  }

  function cancelDelivery() {
    setDeliveringId(null);
    setDeliverNote("");
  }

  async function confirmDelivery(req: ContentRequest) {
    setSavingId(req.id);
    try {
      await updateContentRequest(req.id, {
        status: "finalizado",
        update: deliverNote.trim(),
      });
      setDeliveringId(null);
      setDeliverNote("");
    } catch {
      setSyncMsg("No se pudo registrar la entrega. Intenta nuevamente.");
      setTimeout(() => setSyncMsg(""), 4000);
    } finally {
      setSavingId(null);
    }
  }

  async function reopen(req: ContentRequest) {
    setSavingId(req.id);
    try {
      await updateContentRequest(req.id, { status: "pendiente" });
    } catch {
      setSyncMsg("No se pudo reabrir la solicitud. Intenta nuevamente.");
      setTimeout(() => setSyncMsg(""), 4000);
    } finally {
      setSavingId(null);
    }
  }

  async function quickToggle(req: ContentRequest) {
    setSavingId(req.id);
    try {
      if (req.status === "pendiente") {
        await updateContentRequest(req.id, { status: "finalizado", update: "" });
      } else {
        await updateContentRequest(req.id, { status: "pendiente" });
      }
    } catch {
      setSyncMsg("No se pudo actualizar el estado.");
      setTimeout(() => setSyncMsg(""), 4000);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDerive(req: ContentRequest, memberId: string, memberName: string) {
    setSavingId(req.id);
    try {
      await updateContentRequest(req.id, { assignedTo: memberId, assignedToName: memberName });
      setDerivingId(null);
      // Notificar a la persona asignada
      await addDoc(collection(db, "notifications"), {
        userId: memberId,
        type: "content_request_new",
        category: "Solicitudes",
        title: "Solicitud derivada a ti",
        message: `Te derivaron: ${req.formato} de ${req.requestedBy} (${brandName ?? brandId}) — ${req.requerimiento.slice(0, 70)}${req.requerimiento.length > 70 ? "…" : ""}`,
        link: `/admin/contenidos/clientes/${brandId}?tab=solicitudes`,
        brandId,
        read: false,
        createdAt: serverTimestamp(),
      }).catch(console.error);
    } catch {
      setSyncMsg("No se pudo derivar la solicitud.");
      setTimeout(() => setSyncMsg(""), 4000);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      await deleteAllContentRequests(brandId);
      setConfirmDeleteAll(false);
      setExpandedId(null);
    } finally {
      setDeletingAll(false);
    }
  }

  async function handleDelete(id: string) {
    setSavingId(id);
    try {
      await deleteContentRequest(id);
      setConfirmDeleteId(null);
      setExpandedId(null);
    } finally {
      setSavingId(null);
    }
  }

  async function syncFromSheets() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const fn = httpsCallable<{ brandId: string }, { created: number; updated: number; total: number }>(
        getFunctions(app),
        "syncSheetToFirestore",
      );
      const result = await fn({ brandId });
      const { created, updated, total } = result.data;
      setSyncMsg(`✓ ${total} filas sincronizadas (${created} nuevas · ${updated} actualizadas)`);
      setTimeout(() => setSyncMsg(""), 8000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setSyncMsg(`Error: ${msg}`);
    } finally {
      setSyncing(false);
    }
  }

  async function saveEditNote(id: string) {
    setSavingId(id);
    try {
      await updateContentRequest(id, { update: editNote.trim() });
      setEditingId(null);
    } catch {
      setSyncMsg("No se pudo guardar la nota. Intenta nuevamente.");
      setTimeout(() => setSyncMsg(""), 4000);
    } finally {
      setSavingId(null);
    }
  }

  // sheetRow DESC: fila más alta = más reciente en la hoja Google.
  // Registros sin sheetRow (portal directo) van al principio (Infinity).
  const sorted = [...requests].sort((a, b) => {
    const ra = a.sheetRow ?? Infinity;
    const rb = b.sheetRow ?? Infinity;
    if (ra !== rb) return sortAsc ? ra - rb : rb - ra;
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    return sortAsc ? ta - tb : tb - ta;
  });

  const lowerQ = searchQuery.toLowerCase().trim();
  const visible = sorted.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (!lowerQ) return true;
    return (
      r.requerimiento.toLowerCase().includes(lowerQ) ||
      r.requestedBy.toLowerCase().includes(lowerQ) ||
      r.formato.toLowerCase().includes(lowerQ) ||
      r.pais.toLowerCase().includes(lowerQ) ||
      (r.titulo ?? "").toLowerCase().includes(lowerQ)
    );
  });

  const counts = {
    all: requests.length,
    pendiente: requests.filter((r) => r.status === "pendiente").length,
    finalizado: requests.filter((r) => r.status === "finalizado").length,
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-[#9ca3af]">
        <Loader2 size={16} className="animate-spin mr-2" />
        Cargando solicitudes...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-[#7c3aed]" />
          <span className="text-[15px] font-bold text-[#111827]">Solicitudes del cliente</span>
          <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-bold text-[#7c3aed]">
            {requests.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtros */}
          <div className="flex items-center gap-1">
            {(["all", "pendiente", "finalizado"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  filter === f ? "bg-[#7c3aed] text-white" : "text-[#6b7280] hover:bg-[#f3f4f6]"
                }`}
              >
                {f === "all" ? "Todas" : f === "pendiente" ? "Pendientes" : "Finalizadas"} ·{" "}
                {counts[f]}
              </button>
            ))}
          </div>
          {/* Toggle orden */}
          <button
            type="button"
            onClick={() => setSortAsc((v) => !v)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-[#9ca3af] hover:bg-[#f3f4f6] transition"
          >
            <ArrowDownUp size={11} />
            {sortAsc ? "↑ Antiguo primero" : "↓ Reciente primero"}
          </button>
          {/* Búsqueda */}
          <div className="relative flex items-center">
            <Search size={12} className="absolute left-2.5 text-[#9ca3af] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="rounded-full border border-[#e5e7eb] bg-white pl-7 pr-6 py-1 text-[11px] text-[#374151] placeholder:text-[#d1d5db] outline-none focus:border-[#7c3aed] transition w-[140px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-[#9ca3af] hover:text-[#374151]"
              >
                <X size={11} />
              </button>
            )}
          </div>
          {/* Sync desde Google Sheets — solo si la marca tiene sheetId configurado */}
          {sheetId ? (
            <button
              type="button"
              onClick={() => void syncFromSheets()}
              disabled={syncing || deletingAll}
              title="Sincronizar desde Google Sheets"
              className="flex items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60 transition"
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <Sheet size={12} className="text-[#16a34a]" />}
              {syncing ? "Sincronizando..." : "Sync Sheets"}
            </button>
          ) : (
            <span className="text-[11px] text-[#d1d5db] italic">Sin Google Sheet</span>
          )}

          {/* Borrar todo */}
          {confirmDeleteAll ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 py-1.5">
              <span className="text-[11px] font-semibold text-red-600">¿Borrar todo?</span>
              <button
                type="button"
                onClick={() => void handleDeleteAll()}
                disabled={deletingAll}
                className="text-[11px] font-bold text-red-600 hover:text-red-800 disabled:opacity-60"
              >
                {deletingAll ? <Loader2 size={11} className="animate-spin" /> : "Sí, borrar"}
              </button>
              <span className="text-[#d1d5db]">·</span>
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(false)}
                className="text-[11px] text-[#6b7280] hover:text-[#111827]"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={syncing || deletingAll || requests.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#9ca3af] hover:border-red-200 hover:text-red-500 disabled:opacity-40 transition"
            >
              <X size={12} />
              Borrar todo
            </button>
          )}
        </div>
      </div>

      {/* Toast sync */}
      {syncMsg && (
        <div className={`rounded-xl px-4 py-2.5 text-[12px] font-semibold flex items-center gap-2 ${
          syncMsg.startsWith("✓")
            ? "bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a]"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {syncMsg}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#e5e7eb] bg-[#fafafa] text-center">
          <ClipboardList size={24} className="mb-2 text-[#d1d5db]" />
          <p className="text-[13px] font-semibold text-[#9ca3af]">
            {requests.length === 0 ? "No hay solicitudes aún" : "Sin solicitudes en esta vista"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((req) => {
            const expanded = expandedId === req.id;
            const delivering = deliveringId === req.id;
            const editing = editingId === req.id;
            const saving = savingId === req.id;

            return (
              <div
                key={req.id}
                className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm"
              >
                {/* Cabecera de la fila */}
                <div className="w-full flex items-center gap-3 px-5 py-4">
                  {/* Quick-toggle con confirmación */}
                  {req.status === "pendiente" && confirmToggleId === req.id ? (
                    <div className="mt-0.5 shrink-0 flex items-center gap-1.5 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1">
                      <span className="text-[11px] text-[#166534] font-semibold whitespace-nowrap">¿Entregar?</span>
                      <button type="button" disabled={saving}
                        onClick={() => { void quickToggle(req); setConfirmToggleId(null); }}
                        className="text-[11px] font-bold text-[#16a34a] hover:text-[#166534] disabled:opacity-50">Sí</button>
                      <span className="text-[#bbf7d0]">·</span>
                      <button type="button" onClick={() => setConfirmToggleId(null)} className="text-[11px] text-[#9ca3af] hover:text-[#374151]">No</button>
                    </div>
                  ) : (
                    <button type="button" title={req.status === "pendiente" ? "Marcar como entregado" : "Reabrir"}
                      disabled={saving}
                      onClick={() => req.status === "pendiente" ? setConfirmToggleId(req.id) : void quickToggle(req)}
                      className="mt-0.5 shrink-0 transition-all hover:scale-110 active:scale-95 disabled:opacity-40">
                      {saving
                        ? <Loader2 size={18} className="animate-spin text-[#9ca3af]" />
                        : req.status === "finalizado"
                          ? <CheckCircle2 size={18} className="text-[#16a34a]" />
                          : <Clock size={18} className="text-[#f59e0b] hover:text-[#7c3aed] transition-colors" />}
                    </button>
                  )}

                  {/* Info — click para expandir */}
                  <div className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => { setExpandedId(expanded ? null : req.id); if (expanded) { cancelDelivery(); setEditingId(null) } }}>
                    {/* Badges: estado · formato · país */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <StatusBadge status={req.status} />
                      <span className="text-[11px] font-semibold text-[#7c3aed] bg-[#ede9fe] px-2 py-0.5 rounded-full">{req.formato}</span>
                      <span className="text-[11px] text-[#9ca3af]">{req.pais}</span>
                    </div>
                    {/* Título */}
                    <p className="text-[13px] font-semibold text-[#111827] line-clamp-1 mb-2">{req.requerimiento}</p>
                    {/* Metadata: izquierda=quién+deadline  derecha=asignación */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex items-center gap-1 text-[12px] font-medium text-[#374151] truncate">
                          <UserRound size={11} className="shrink-0 text-[#9ca3af]" />
                          {req.requestedBy}
                        </span>
                        <DeadlinePill deadline={req.deadline} />
                        {req.clientNote && (
                          <span className="flex items-center gap-1 text-[11px] text-[#d97706] font-semibold shrink-0">
                            <MessageCircle size={11} />Comentario
                          </span>
                        )}
                      </div>
                      {/* Chip asignación — siempre alineado a la derecha */}
                      <div className="shrink-0" onClick={e => e.stopPropagation()}>
                        {(() => {
                          const aColor = AREA_COLOR[req.area ?? ''] ?? '#64748b';
                          const hasAssignee = !!req.assignedToName;
                          const chipStyle = hasAssignee
                            ? { background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }
                            : { background: `${aColor}18`, color: aColor, border: `1px solid ${aColor}30` };
                          return derivingId === req.id ? (
                            <div className="flex items-center gap-1.5">
                              {/* Chip actual — visible mientras se elige */}
                              <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold opacity-40" style={chipStyle}>
                                <UserRound size={10} />
                                {req.assignedToName ?? req.area ?? 'Sin asignar'}
                              </span>
                              <span className="text-[10px] text-[#9ca3af]">→</span>
                              <select autoFocus defaultValue=""
                                onChange={(e) => { const m = team.find(t => t.id === e.target.value); if (m) void handleDerive(req, m.id, m.name); }}
                                className="rounded-lg border border-[#7c3aed] px-2 py-0.5 text-[11px] text-[#374151] outline-none bg-white max-w-[160px]">
                                <option value="" disabled>Reasignar a...</option>
                                {team.filter(m => m.status === "active").map(m => (
                                  <option key={m.id} value={m.id}>{m.name} · {m.category}</option>
                                ))}
                              </select>
                              <button type="button" onClick={e => { e.stopPropagation(); setDerivingId(null); }} className="text-[#9ca3af] hover:text-[#374151]">
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); setDerivingId(req.id); }}
                              className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-opacity hover:opacity-75"
                              style={chipStyle}>
                              <UserRound size={10} />
                              {req.assignedToName ?? req.area ?? 'Sin asignar'}
                              <Pencil size={9} style={{ opacity: 0.5 }} />
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Chevron */}
                  <button type="button" className="shrink-0 mt-0.5 text-[#9ca3af]"
                    onClick={() => { setExpandedId(expanded ? null : req.id); if (expanded) { cancelDelivery(); setEditingId(null) } }}>
                    {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>

                {/* Contenido expandido */}
                {expanded && (
                  <div className="border-t border-[#f3f4f6] px-5 py-4 flex flex-col gap-4">
                    {/* Campos del brief */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
                          Canal solicitado
                        </p>
                        <p className="text-[13px] text-[#374151] mt-0.5">{req.canal}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
                          País
                        </p>
                        <p className="text-[13px] text-[#374151] mt-0.5">{req.pais}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
                          Requerimiento
                        </p>
                        <p className="text-[13px] text-[#374151] mt-0.5 whitespace-pre-wrap">
                          {req.requerimiento}
                        </p>
                      </div>
                      {req.entregables && (
                        <div className="col-span-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">Entregables</p>
                          <ol className="mt-1 flex flex-col gap-1">
                            {req.entregables.split('\n').filter(Boolean).map((e, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-[#ede9fe] text-[#7c3aed] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                <span className="text-[13px] text-[#374151]">{e}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
                          Objetivo
                        </p>
                        <p className="text-[13px] text-[#374151] mt-0.5">{req.objetivo}</p>
                      </div>
                    </div>

                    {/* ── ZONA DE ACCIÓN PRINCIPAL ── */}
                    {req.status === "pendiente" && !delivering && (
                      <button
                        type="button"
                        onClick={() => startDelivery(req)}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#6d28d9] hover:scale-[1.02] active:scale-95 transition-all duration-150"
                      >
                        <SendHorizonal size={14} />
                        Entregar con nota
                      </button>
                    )}

                    {/* Formulario de entrega */}
                    {delivering && (
                      <div className="rounded-xl border-2 border-[#7c3aed] bg-[#faf5ff] p-4 flex flex-col gap-3">
                        <p className="text-[12px] font-bold text-[#7c3aed] uppercase tracking-wide">
                          Registrar entrega
                        </p>
                        <div>
                          <label className="text-[11px] font-semibold text-[#6b7280] block mb-1">
                            Notas de entrega
                          </label>
                          <textarea
                            autoFocus
                            value={deliverNote}
                            onChange={(e) => setDeliverNote(e.target.value)}
                            placeholder={`Ej: enviado por correo · Drive/PIEZAS CAM · ${new Date().toLocaleDateString("es-PE")}`}
                            rows={3}
                            className="w-full rounded-xl border border-[#dde2e7] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#7c3aed] resize-none"
                          />
                          <p className="mt-1 text-[10px] text-[#9ca3af]">
                            Esta nota la verá el cliente en su portal.
                          </p>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={cancelDelivery}
                            disabled={saving}
                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-60"
                          >
                            <X size={12} />
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void confirmDelivery(req)}
                            disabled={saving || !deliverNote.trim()}
                            className="flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#15803d] disabled:opacity-40 transition-colors"
                          >
                            {saving ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            Confirmar entrega
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Estado finalizado: muestra nota + acciones secundarias */}
                    {req.status === "finalizado" && (
                      <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#16a34a]">
                            Update entregado al cliente
                          </p>
                          {!editing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditNote(req.update ?? "");
                                setEditingId(req.id);
                              }}
                              className="flex items-center gap-1 text-[11px] text-[#16a34a] hover:underline"
                            >
                              <Pencil size={11} />
                              Editar nota
                            </button>
                          )}
                        </div>

                        {editing ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              autoFocus
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              rows={3}
                              className="w-full rounded-xl border border-[#dde2e7] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#7c3aed] resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-[#6b7280] hover:bg-white/60"
                              >
                                <X size={11} /> Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveEditNote(req.id)}
                                disabled={saving}
                                className="flex items-center gap-1 rounded-lg bg-[#16a34a] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#15803d] disabled:opacity-60"
                              >
                                {saving ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Check size={11} />
                                )}
                                Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[13px] text-[#166534] whitespace-pre-wrap">
                            {req.update || <span className="italic text-[#4ade80]">Sin nota de entrega.</span>}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Comentarios del cliente — historial completo */}
                    {(req.clientNotes?.length ?? 0) > 0 ? (
                      <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                          <MessageCircle size={12} className="text-[#d97706]" />
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#d97706]">
                            Comentarios del cliente
                          </p>
                          <span className="ml-auto rounded-full bg-[#fde68a] px-1.5 text-[10px] font-bold text-[#92400e]">
                            {req.clientNotes!.length}
                          </span>
                        </div>
                        {[...(req.clientNotes ?? [])].reverse().map((entry, i) => (
                          <div key={i} className="bg-white/60 rounded-lg px-3 py-2">
                            <p className="text-[12px] text-[#78350f] whitespace-pre-wrap">{entry.text}</p>
                            <p className="text-[10px] text-[#9ca3af] mt-0.5">
                              {new Date(entry.at).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : req.clientNote ? (
                      <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <MessageCircle size={12} className="text-[#d97706]" />
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#d97706]">
                            Comentario del cliente
                          </p>
                        </div>
                        <p className="text-[12px] text-[#78350f] whitespace-pre-wrap">{req.clientNote}</p>
                      </div>
                    ) : null}

                    {/* Pie: fecha + acciones */}
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-[#9ca3af]">
                        Recibido:{" "}
                        {req.createdAt
                          ? new Date(req.createdAt).toLocaleDateString("es-PE", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                      <div className="flex items-center gap-2">
                        {req.status === "finalizado" && !editing && (
                          <button
                            type="button"
                            onClick={() => void reopen(req)}
                            disabled={saving}
                            className="flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[11px] text-[#6b7280] hover:border-amber-300 hover:text-amber-700 disabled:opacity-60 transition-colors"
                          >
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                            Reabrir
                          </button>
                        )}
                        {/* Borrar con confirmación inline */}
                        {confirmDeleteId === req.id ? (
                          <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1">
                            <span className="text-[11px] text-red-600 font-semibold">¿Eliminar?</span>
                            <button
                              type="button"
                              onClick={() => void handleDelete(req.id)}
                              disabled={saving}
                              className="text-[11px] font-bold text-red-600 hover:text-red-800 disabled:opacity-60"
                            >
                              {saving ? <Loader2 size={11} className="animate-spin" /> : "Sí"}
                            </button>
                            <span className="text-[#d1d5db]">·</span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] text-[#6b7280] hover:text-[#111827]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(req.id)}
                            className="flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[11px] text-[#9ca3af] hover:border-red-200 hover:text-red-500 transition-colors"
                          >
                            <X size={11} />
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
