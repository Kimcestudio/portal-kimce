"use client";

import { useEffect, useState } from "react";
import { ArrowDownUp, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Loader2, MessageCircle, Pencil, Plus, Search, Send, X, CheckCheck, Clock } from "lucide-react";
import {
  CANALES,
  FORMATOS,
  PAISES,
  addClientNote,
  addContentRequest,
  updateClientRequest,
  subscribeContentRequests,
  type ContentRequest,
} from "@/services/contentRequests";

// Personas predefinidas con su país/región por defecto
const PERSONAS = [
  { name: "Fabiola Cáceres",           pais: "Institucional" },
  { name: "Ingrid Maria Retana Moran", pais: "CAM (Centroamérica)" },
  { name: "Paula Rojas",               pais: "Colombia" },
  { name: "Karen Socadagui",           pais: "Colombia" },
  { name: "Dariana Jiménez",           pais: "Perú" },
  { name: "Norlyn Conquin",            pais: "Perú" },
  { name: "Belén Dames Lagos",         pais: "Chile" },
  { name: "Christian Sánchez",         pais: "México" },
  { name: "Gabriela Alvarez",          pais: "Ecuador" },
] as const;

const EMPTY_FORM = {
  requestedBy: "",
  formato: "",
  requerimiento: "",
  pais: "",
  objetivo: "",
  deadline: "",
  canal: "",
};

type FormState = typeof EMPTY_FORM;

function StatusBadge({ status }: { status: ContentRequest["status"] }) {
  return status === "finalizado" ? (
    <span className="inline-flex items-center rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#16a34a]">
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
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

type Props = {
  brandId: string;
  brandName?: string;
};

export default function SolicitudesSection({ brandId, brandName }: Props) {
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const [filter, setFilter] = useState<"all" | "pendiente" | "finalizado">("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  // Combobox "Solicitado por"
  const [requestedByInput, setRequestedByInput] = useState("");
  const [showPersonaList, setShowPersonaList] = useState(false);
  // Multi-select País
  const [selectedPaises, setSelectedPaises] = useState<string[]>([]);
  const [showPaisDropdown, setShowPaisDropdown] = useState(false);
  const [paisOther, setPaisOther] = useState("");
  // Entregables
  const [entregablesArr, setEntregablesArr] = useState<string[]>([""]);

  function addEntregable() { setEntregablesArr((prev) => [...prev, ""]); }
  function removeEntregable(i: number) { setEntregablesArr((prev) => prev.filter((_, idx) => idx !== i)); }
  function setEntregable(i: number, val: string) { setEntregablesArr((prev) => prev.map((e, idx) => idx === i ? val : e)); }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setRequestedByInput("");
    setSelectedPaises([]);
    setPaisOther("");
    setEntregablesArr([""]);
    setShowPersonaList(false);
    setShowPaisDropdown(false);
  }

  function openEdit(req: ContentRequest) {
    setEditingId(req.id);
    setForm({
      requestedBy: req.requestedBy,
      formato: req.formato,
      requerimiento: req.requerimiento,
      pais: req.pais,
      objetivo: req.objetivo,
      deadline: req.deadline,
      canal: req.canal,
    });
    setRequestedByInput(req.requestedBy);
    const paisValues = req.pais.split(",").map((p) => p.trim()).filter(Boolean);
    const known = paisValues.filter((p) => (PAISES as readonly string[]).includes(p));
    const others = paisValues.filter((p) => !(PAISES as readonly string[]).includes(p));
    setSelectedPaises(others.length > 0 ? [...known, "Otros"] : known);
    setPaisOther(others.join(", "));
    const ents = (req.entregables ?? "").split("\n").filter(Boolean);
    setEntregablesArr(ents.length > 0 ? ents : [""]);
    setShowForm(true);
    setShowPersonaList(false);
    setShowPaisDropdown(false);
    setExpandedId(null);
  }

  function toggleNote(req: ContentRequest) {
    if (noteId === req.id) {
      setNoteId(null);
      setNoteText("");
    } else {
      setNoteText(req.clientNote ?? "");
      setNoteId(req.id);
    }
  }

  useEffect(() => {
    const unsub = subscribeContentRequests(
      brandId,
      (data) => { setRequests(data); setLoading(false); },
      () => setLoading(false),
    );
    return () => unsub();
  }, [brandId]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Combobox: seleccionar persona predefinida → auto-asigna país
  function handlePersonaSelect(persona: typeof PERSONAS[number]) {
    setRequestedByInput(persona.name);
    setSelectedPaises([persona.pais]);
    setShowPersonaList(false);
  }

  // Multi-select país
  function togglePais(p: string) {
    setSelectedPaises((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  const filteredPersonas = requestedByInput.trim()
    ? PERSONAS.filter((p) =>
        p.name.toLowerCase().includes(requestedByInput.toLowerCase()),
      )
    : PERSONAS;

  const resolvedRequestedBy = requestedByInput.trim();
  const resolvedPais = [
    ...selectedPaises.filter((p) => p !== "Otros"),
    ...(selectedPaises.includes("Otros") && paisOther.trim() ? [paisOther.trim()] : []),
  ].join(", ");

  const resolvedEntregables = entregablesArr.filter((e) => e.trim()).join("\n");

  const canSubmit =
    !submitting &&
    resolvedRequestedBy.length > 0 &&
    form.formato !== "" &&
    form.requerimiento.trim().length > 0 &&
    resolvedPais.length > 0 &&
    form.objetivo.trim().length > 0 &&
    form.deadline !== "" &&
    form.canal !== "";

  async function handleSendNote(req: ContentRequest) {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      await addClientNote(req.id, noteText.trim());
      setNoteText("");
      setNoteId(null);
    } catch {
      setSuccessMsg("No se pudo enviar el comentario. Intenta nuevamente.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } finally {
      setSendingNote(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateClientRequest(editingId, {
          requestedBy: resolvedRequestedBy,
          formato: form.formato,
          requerimiento: form.requerimiento,
          pais: resolvedPais,
          objetivo: form.objetivo,
          deadline: form.deadline,
          canal: form.canal,
          entregables: resolvedEntregables,
        });
        closeForm();
        setSuccessMsg("Solicitud actualizada correctamente.");
      } else {
        await addContentRequest({
          brandId,
          ...form,
          requestedBy: resolvedRequestedBy,
          pais: resolvedPais,
          entregables: resolvedEntregables,
        });
        closeForm();
        setSuccessMsg("¡Solicitud enviada! El equipo KIMCE la revisará pronto.");
      }
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch {
      setSuccessMsg("No se pudo enviar. Intenta nuevamente.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[#dde2e7] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#7c3aed] transition-colors";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-[#6b7280] mb-1";

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

  const counts = {
    all: requests.length,
    pendiente: requests.filter((r) => r.status === "pendiente").length,
    finalizado: requests.filter((r) => r.status === "finalizado").length,
  };
  const lowerQ = searchQuery.toLowerCase().trim();
  const visible = sorted.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (lowerQ && !(
      r.requerimiento.toLowerCase().includes(lowerQ) ||
      r.requestedBy.toLowerCase().includes(lowerQ) ||
      r.formato.toLowerCase().includes(lowerQ) ||
      r.pais.toLowerCase().includes(lowerQ)
    )) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">

      {/* ── Header ── */}
      <div className="kimce-glass rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <ClipboardList size={17} className="text-[#7c3aed] shrink-0" />
            <div>
              <h2 className="text-[15px] font-bold text-[#111827] leading-tight">Centro de solicitudes</h2>
              <p className="text-[11px] text-[#9ca3af]">
                {brandName ?? "Tu marca"} · el equipo KIMCE gestiona cada pedido
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { if (showForm && !editingId) closeForm(); else if (!showForm) { closeForm(); setShowForm(true); } }}
              className="flex items-center gap-1.5 rounded-xl bg-[#7c3aed] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#6d28d9] active:scale-95 transition-all duration-150"
            >
              <Plus size={13} />
              Nueva solicitud
            </button>
          </div>
        </div>

        {/* Stats + filtros + orden */}
        {!loading && requests.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "pendiente", "finalizado"] as const).map((f) => {
              const label = f === "all" ? "Todas" : f === "pendiente" ? "Pendientes" : "Finalizadas";
              const Icon = f === "finalizado" ? CheckCheck : f === "pendiente" ? Clock : ClipboardList;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    filter === f
                      ? f === "finalizado"
                        ? "bg-[#dcfce7] text-[#16a34a]"
                        : f === "pendiente"
                        ? "bg-[#fef3c7] text-[#d97706]"
                        : "bg-[#ede9fe] text-[#7c3aed]"
                      : "text-[#9ca3af] hover:bg-white/40"
                  }`}
                >
                  <Icon size={11} />
                  {label}
                  <span className={`rounded-full px-1.5 text-[10px] ${
                    filter === f ? "bg-white/60" : "bg-white/30"
                  }`}>
                    {counts[f]}
                  </span>
                </button>
              );
            })}
            {/* Búsqueda */}
            <div className="relative flex items-center ml-auto">
              <Search size={11} className="absolute left-2.5 text-[#9ca3af] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="rounded-full border border-white/60 bg-white/60 pl-7 pr-6 py-1 text-[11px] text-[#374151] placeholder:text-[#c4b5fd] outline-none focus:border-[#7c3aed] transition w-[130px]"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2 text-[#9ca3af] hover:text-[#374151]">
                  <X size={11} />
                </button>
              )}
            </div>
            {/* Toggle orden */}
            <button
              type="button"
              onClick={() => setSortAsc((v) => !v)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-[#9ca3af] hover:bg-white/40 transition-colors"
            >
              <ArrowDownUp size={11} />
              {sortAsc ? "↑ Antiguo primero" : "↓ Reciente primero"}
            </button>
          </div>
        )}
      </div>

      {/* ── Formulario nueva solicitud ── */}
      {showForm && (
        <div className="kimce-glass rounded-2xl overflow-hidden kimce-fade-enter">
          {/* Form header */}
          <div className="px-5 py-3.5 border-b border-white/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {editingId ? <Pencil size={14} className="text-[#7c3aed]" /> : <Plus size={14} className="text-[#7c3aed]" />}
              <span className="text-[13px] font-bold text-[#111827]">
                {editingId ? "Editar solicitud" : "Nueva solicitud de contenido"}
              </span>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="text-[#9ca3af] hover:text-[#374151] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-5 py-4 grid gap-4 sm:grid-cols-2">
            {/* ── Solicitado por — combobox ── */}
            <div className="sm:col-span-2">
              <label className={labelCls}>Solicitado por</label>
              <div
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setShowPersonaList(false);
                  }
                }}
              >
                <input
                  value={requestedByInput}
                  onChange={(e) => { setRequestedByInput(e.target.value); setShowPersonaList(true); }}
                  onFocus={() => setShowPersonaList(true)}
                  placeholder="Buscar o escribir nombre..."
                  autoComplete="off"
                  className={inputCls}
                />
                {showPersonaList && filteredPersonas.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {filteredPersonas.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        tabIndex={0}
                        onMouseDown={() => handlePersonaSelect(p)}
                        className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#f5f3ff] flex items-center justify-between gap-2 transition-colors"
                      >
                        <span className="font-medium text-[#111827]">{p.name}</span>
                        <span className="text-[11px] text-[#7c3aed] shrink-0">{p.pais}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Formato ── */}
            <div>
              <label className={labelCls}>Formato</label>
              <select value={form.formato} onChange={(e) => set("formato", e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {FORMATOS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* ── País / Región — multi-select con auto-asignación ── */}
            <div>
              <label className={labelCls}>
                País / Región
                {selectedPaises.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-normal text-[#7c3aed] normal-case">
                    · {selectedPaises.filter(p => p !== "Otros").join(", ")}{selectedPaises.includes("Otros") && paisOther ? `, ${paisOther}` : ""}
                  </span>
                )}
              </label>
              <div
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setShowPaisDropdown(false);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowPaisDropdown((v) => !v)}
                  className={`${inputCls} flex items-center justify-between text-left`}
                >
                  <span className={selectedPaises.length === 0 ? "text-[#9ca3af]" : "text-[#111827]"}>
                    {selectedPaises.length === 0
                      ? "Seleccionar..."
                      : selectedPaises.filter(p => p !== "Otros").length > 0
                        ? selectedPaises.filter(p => p !== "Otros").join(", ") + (selectedPaises.includes("Otros") && paisOther ? `, ${paisOther}` : "")
                        : (paisOther || "Otro...")}
                  </span>
                  <ChevronDown size={14} className="text-[#9ca3af] shrink-0" />
                </button>
                {showPaisDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-[#e5e7eb] rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {PAISES.map((p) => (
                      <label
                        key={p}
                        className="flex items-center gap-2.5 px-4 py-2 hover:bg-[#f5f3ff] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          tabIndex={0}
                          checked={selectedPaises.includes(p)}
                          onChange={() => togglePais(p)}
                          className="accent-[#7c3aed] w-3.5 h-3.5"
                        />
                        <span className="text-[13px] text-[#111827]">{p}</span>
                      </label>
                    ))}
                    {selectedPaises.includes("Otros") && (
                      <div className="px-4 pb-3 pt-1">
                        <input
                          value={paisOther}
                          onChange={(e) => setPaisOther(e.target.value)}
                          placeholder="Especifica país o región..."
                          className="w-full rounded-lg border border-[#dde2e7] px-3 py-1.5 text-[12px] outline-none focus:border-[#7c3aed] transition-colors"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Requerimiento + Entregables ── */}
            <div className="sm:col-span-2">
              <label className={labelCls}>Requerimiento</label>
              <div className="rounded-xl border border-[#dde2e7] bg-white focus-within:border-[#7c3aed] transition-colors">
                <textarea
                  value={form.requerimiento}
                  onChange={(e) => set("requerimiento", e.target.value)}
                  placeholder="Describe qué necesitas: copy, referencias, tono, medidas, etc."
                  rows={3}
                  className="w-full px-3 pt-2.5 pb-2 text-[13px] outline-none bg-transparent resize-none"
                />
                <div className="border-t border-[#f0f0f0] px-3 py-2.5 flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">Entregables</span>
                  {entregablesArr.map((e, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] text-[#9ca3af] w-4 shrink-0 text-right">{i + 1}.</span>
                      <input
                        value={e}
                        onChange={(ev) => setEntregable(i, ev.target.value)}
                        placeholder={`Entregable ${i + 1}...`}
                        className="flex-1 text-[13px] outline-none bg-transparent placeholder:text-[#d1d5db]"
                      />
                      {entregablesArr.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEntregable(i)}
                          className="text-[#d1d5db] hover:text-[#ef4444] transition-colors shrink-0"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addEntregable}
                    className="flex items-center gap-1 text-[11px] text-[#7c3aed] hover:text-[#6d28d9] font-semibold w-fit mt-0.5"
                  >
                    <Plus size={11} /> Agregar entregable
                  </button>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Objetivo</label>
              <textarea
                value={form.objetivo}
                onChange={(e) => set("objetivo", e.target.value)}
                placeholder="¿Qué resultado esperas con esta pieza?"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className={labelCls}>Deadline</label>
              <input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Canal de entrega</label>
              <select value={form.canal} onChange={(e) => set("canal", e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2 flex items-center justify-between pt-1">
              <button type="button" onClick={closeForm} className="text-[12px] text-[#9ca3af] hover:text-[#374151]">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#6d28d9] active:scale-95 disabled:opacity-40 transition-all duration-150"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : editingId ? <Pencil size={14} /> : <Send size={14} />}
                {editingId ? "Guardar cambios" : "Enviar solicitud"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Toast de éxito/error ── */}
      {successMsg && (
        <div className={`rounded-2xl px-4 py-3 text-[13px] font-semibold kimce-fade-enter flex items-center gap-2 ${
          successMsg.includes("pudo")
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-[#f0fdf4] border border-[#bbf7d0] text-[#16a34a]"
        }`}>
          {successMsg.includes("pudo") ? <X size={14} /> : <CheckCheck size={14} />}
          {successMsg}
        </div>
      )}

      {/* ── Lista de solicitudes ── */}
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-[#9ca3af]">
          <Loader2 size={18} className="animate-spin mr-2" />
          Cargando solicitudes...
        </div>
      ) : requests.length === 0 ? (
        <div className="kimce-glass rounded-2xl px-5 py-12 text-center">
          <ClipboardList size={32} className="mx-auto mb-3 text-[#c4b5fd]" />
          <p className="text-[14px] font-bold text-[#6b7280]">Sin solicitudes enviadas aún</p>
          <p className="mt-1 text-[12px] text-[#9ca3af] max-w-[260px] mx-auto">
            Usa "Nueva solicitud" para enviar tu primer requerimiento al equipo KIMCE.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="kimce-glass rounded-2xl px-5 py-8 text-center">
          <p className="text-[13px] text-[#9ca3af]">No hay solicitudes en esta vista.</p>
        </div>
      ) : (
        /* ── Layout tabla + panel lateral ── */
        <div className="flex gap-3 items-start">

          {/* Tabla */}
          <div className="flex-1 min-w-0 kimce-glass rounded-2xl overflow-hidden">

            {/* Header de columnas */}
            <div className="grid grid-cols-[110px_1fr_80px_80px_170px_90px_110px] gap-x-3 px-4 py-2.5 border-b border-white/40 bg-white/10">
              {["Formato","Requerimiento","Deadline","Ingreso","Entrega","Estado",""].map((h) => (
                <span key={h} className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{h}</span>
              ))}
            </div>

            {/* Filas */}
            {visible.map((req, i) => {
              const expanded = expandedId === req.id;
              const isActive = noteId === req.id;
              return (
                <div
                  key={req.id}
                  className={i < visible.length - 1 ? "border-b border-white/20" : ""}
                >
                  {/* Fila principal */}
                  <div className={`grid grid-cols-[110px_1fr_80px_80px_170px_90px_110px] gap-x-3 px-4 py-3 items-center transition-colors ${
                    isActive ? "bg-white/20" : "hover:bg-white/10"
                  }`}>

                    {/* Formato */}
                    <span className="text-[11px] font-semibold text-[#7c3aed] bg-[#ede9fe] px-2 py-0.5 rounded-full truncate inline-block max-w-full">
                      {req.formato}
                    </span>

                    {/* Título / Requerimiento */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : req.id)}
                      className="text-left min-w-0"
                    >
                      <p className="text-[13px] font-semibold text-[#111827] truncate">
                        {req.titulo || req.requerimiento}
                      </p>
                      <p className="text-[11px] text-[#9ca3af] truncate">{req.requestedBy} · {req.pais}</p>
                    </button>

                    {/* Deadline */}
                    <span className="text-[12px] text-[#6b7280]">{formatDate(req.deadline)}</span>

                    {/* Fecha ingreso */}
                    <span className="text-[11px] text-[#9ca3af]">
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString("es-PE", { day: "numeric", month: "short" }) : "—"}
                    </span>

                    {/* Entrega */}
                    <div className="flex items-center gap-1 min-w-0">
                      {req.update ? (
                        <>
                          <CheckCircle2 size={11} className="text-[#16a34a] shrink-0" />
                          <span className="text-[11px] text-[#166534] truncate">{req.update}</span>
                        </>
                      ) : req.status === "finalizado" ? (
                        <span className="text-[11px] text-[#d1d5db] italic">Sin nota</span>
                      ) : null}
                    </div>

                    {/* Estado */}
                    <div><StatusBadge status={req.status} /></div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1.5 justify-end">
                      {req.status === "pendiente" && (
                        <button
                          type="button"
                          title="Editar solicitud"
                          onClick={() => openEdit(req)}
                          className="p-1.5 rounded-full text-[#9ca3af] hover:text-[#7c3aed] hover:bg-white/60 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleNote(req)}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          req.clientNote
                            ? "bg-[#fef3c7] text-[#d97706]"
                            : isActive
                            ? "bg-[#ddd6fe] text-[#6d28d9]"
                            : "bg-[#ede9fe] text-[#7c3aed] hover:bg-[#ddd6fe]"
                        }`}
                      >
                        <MessageCircle size={12} />
                        {req.clientNote ? "Nota" : "Comentar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : req.id)}
                        className="p-1 text-[#9ca3af] hover:text-[#374151] transition-colors"
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Fila expandida */}
                  {expanded && (
                    <div className="bg-white/10 border-t border-white/20 px-4 py-3 kimce-fade-enter flex flex-col gap-3">

                      {/* Brief + Entregables */}
                      {(req.requerimiento || req.entregables) && (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {req.requerimiento && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] mb-0.5">Brief</p>
                              <p className="text-[12px] text-[#374151] whitespace-pre-wrap">{req.requerimiento}</p>
                            </div>
                          )}
                          {req.entregables && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] mb-1">Entregables</p>
                              <ol className="flex flex-col gap-1">
                                {req.entregables.split("\n").filter(Boolean).map((e, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="w-4 h-4 rounded-full bg-[#ede9fe] text-[#7c3aed] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                    <span className="text-[12px] text-[#374151]">{e}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] mb-0.5">Objetivo</p>
                          <p className="text-[12px] text-[#374151]">{req.objetivo}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] mb-0.5">Canal</p>
                          <p className="text-[12px] text-[#374151]">{req.canal}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] mb-0.5">Fecha solicitud</p>
                          <p className="text-[12px] text-[#374151]">
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </p>
                        </div>
                        {req.status === "finalizado" && req.updatedAt && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af] mb-0.5">Fecha finalización</p>
                            <p className="text-[12px] text-[#374151]">
                              {new Date(req.updatedAt).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Nota de entrega del equipo KIMCE */}
                      {req.status === "finalizado" && (
                        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#16a34a] mb-1">
                            Nota de entrega — equipo KIMCE
                          </p>
                          <p className="text-[13px] text-[#166534] whitespace-pre-wrap">
                            {req.update || <span className="italic text-[#4ade80]">Sin nota de entrega.</span>}
                          </p>
                        </div>
                      )}

                      {req.status === "pendiente" && (
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-[#9ca3af] italic">
                            El equipo KIMCE marcará esta solicitud como finalizada al entregar.
                          </p>
                          <button
                            type="button"
                            onClick={() => openEdit(req)}
                            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-[#7c3aed] bg-[#ede9fe] hover:bg-[#ddd6fe] transition-colors shrink-0"
                          >
                            <Pencil size={11} />
                            Editar solicitud
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Panel de comentario — columna derecha fuera de la tabla ── */}
          {(() => {
            const activeReq = requests.find((r) => r.id === noteId);
            if (!activeReq) return null;
            return (
              <div className="w-[240px] shrink-0 kimce-glass rounded-2xl px-4 py-3 flex flex-col gap-3 kimce-fade-enter">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">Comentario</p>
                  <button
                    type="button"
                    onClick={() => { setNoteId(null); setNoteText(""); }}
                    className="text-[#9ca3af] hover:text-[#374151] transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
                <p className="text-[11px] text-[#6b7280] truncate font-medium">{activeReq.requerimiento}</p>

                {/* Historial de comentarios */}
                {(activeReq.clientNotes?.length ?? 0) > 0 ? (
                  <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
                    {[...(activeReq.clientNotes ?? [])].reverse().map((entry, i) => (
                      <div key={i} className="bg-white/60 rounded-xl px-3 py-2 border border-white/60">
                        <p className="text-[12px] text-[#374151]">{entry.text}</p>
                        <p className="text-[10px] text-[#9ca3af] mt-0.5">
                          {new Date(entry.at).toLocaleDateString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9ca3af] italic">Aún no dejaste comentarios.</p>
                )}

                <textarea
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSendNote(activeReq); }
                  }}
                  placeholder="Escribe un comentario..."
                  rows={3}
                  className="w-full rounded-xl border border-[#dde2e7] px-3 py-2 text-[12px] outline-none resize-none transition-colors placeholder:text-[#9ca3af] bg-white/80 focus:border-[#7c3aed]"
                />

                <button
                  type="button"
                  onClick={() => void handleSendNote(activeReq)}
                  disabled={sendingNote || !noteText.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-40 transition-colors"
                >
                  {sendingNote ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Enviar comentario
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
