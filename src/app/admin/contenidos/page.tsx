'use client'
import { useState, useEffect } from 'react'
import { Plus, ArrowUpRight, AlertTriangle, CheckCircle2, CalendarDays, Zap, ListChecks, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { NETWORK_META, STATUS_META } from '@/cmhub/data'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import ContentModal from '@/components/cmhub/ContentModal'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import type { Content, TeamMember, HubActividad } from '@/cmhub/types'

// ── Workflow por área ──────────────────────────────────────────────────────
// Diseño/Audiovisual: produccion → revision → aprobado (done)
// Estrategia/CM:      idea → ... → publicado (done)
function getWorkflow(area: string | null | undefined) {
  const isCreativo = area === 'Diseño' || area === 'Audiovisual'
  if (isCreativo) {
    return {
      pendientesLabel: 'En Producción',
      revisionLabel:   'En Revisión',
      listosLabel:     'Aprobados',
      pendientes: ['produccion'],
      enRevision: ['revision'],
      listos:     ['aprobado', 'programado', 'publicado', 'finalizado'],
      active:     ['produccion', 'revision'],
      isCreativo: true,
    }
  }
  return {
    pendientesLabel: 'Pendientes',
    revisionLabel:   'En Revisión',
    listosLabel:     'Publicados',
    pendientes: ['idea', 'produccion'],
    enRevision: ['revision', 'cambios'],
    listos:     ['publicado', 'finalizado'],
    active:     ['idea', 'produccion', 'revision', 'cambios', 'aprobado', 'programado'],
    isCreativo: false,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().split('T')[0] }

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
}

function sameName(a: string | null | undefined, b: string) {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()
}

function useActiveToday(members: TeamMember[]) {
  const [active, setActive] = useState<Record<string, { checkInAt: string; checkOutAt: string | null }>>({})
  useEffect(() => {
    if (!members.length) return
    const q = query(collection(db, 'timeEntries'), where('dayKey', '==', todayISO()))
    return onSnapshot(q, snap => {
      const byUid: Record<string, { clockIn?: string; clockOut?: string }> = {}
      snap.docs.forEach(d => {
        const data = d.data() as { uid?: string; type?: string; ts?: string }
        if (!data.uid || !data.ts) return
        if (!byUid[data.uid]) byUid[data.uid] = {}
        if (data.type === 'clock_in')  byUid[data.uid].clockIn  = data.ts
        if (data.type === 'clock_out') byUid[data.uid].clockOut = data.ts
      })
      const result: Record<string, { checkInAt: string; checkOutAt: string | null }> = {}
      members.forEach(m => {
        const e = byUid[m.id]
        if (e?.clockIn) result[m.id] = { checkInAt: e.clockIn, checkOutAt: e.clockOut ?? null }
      })
      setActive(result)
    }, () => {})
  }, [members])
  return active
}

// ── Badges ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; color: string; bg: string }> = {
    idea:       { label: 'Pendiente',  color: '#d97706', bg: '#fef3c7' },
    produccion: { label: 'Producción', color: '#3b82f6', bg: '#eff6ff' },
    revision:   { label: 'Revisión',   color: '#7c3aed', bg: '#f5f3ff' },
    cambios:    { label: 'Cambios',    color: '#dc2626', bg: '#fee2e2' },
    aprobado:   { label: 'Aprobado',   color: '#16a34a', bg: '#dcfce7' },
    programado: { label: 'Programado', color: '#16a34a', bg: '#dcfce7' },
    publicado:  { label: 'Publicado',  color: '#059669', bg: '#d1fae5' },
  }
  const m = meta[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
      style={{ background: m.bg, color: m.color }}>{m.label}</span>
  )
}

// ──────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { brands, contents, team, viewAs, actividades } = useHub()
  const base    = useHubBase()
  const auth    = useOptionalAuth()
  const profile = auth?.profile
  const myName  = viewAs?.name ?? profile?.displayName ?? ''
  const myUid   = viewAs ? '' : (profile?.uid ?? '')

  const [selectedContent, setSelectedContent] = useState<Content | null>(null)

  const activeToday = useActiveToday(team)
  const today = todayISO()
  const wf = getWorkflow(viewAs?.category ?? profile?.area)

  // ── Mis contenidos ──────────────────────────────────────────────────────
  const myContents = contents.filter(c =>
    sameName(c.responsible, myName) ||
    c.responsables?.some(r => sameName(r, myName)) ||
    sameName(c.dueAssignee, myName)
  )

  const myPendientes = myContents.filter(c => wf.pendientes.includes(c.status))
  const myEnRevision = myContents.filter(c => wf.enRevision.includes(c.status))
  const myListos     = myContents.filter(c => wf.listos.includes(c.status))

  // Agenda de hoy: mis entregas activas con dueDate hoy
  const myAgendaHoy = myContents
    .filter(c => c.dueDate === today && wf.active.includes(c.status))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))

  // Mis alertas: vencidos dentro de mi workflow + cambios (solo CM)
  const myAlertas = myContents.filter(c => {
    const overdue = c.dueDate && c.dueDate < today && wf.active.includes(c.status)
    const cambios = c.status === 'cambios' && !wf.isCreativo
    return overdue || cambios
  }).slice(0, 5)

  // Mis próximas entregas (1–7 días) dentro de mi workflow activo
  const myProximas = myContents
    .filter(c => {
      if (!c.dueDate || c.dueDate <= today) return false
      if (!wf.active.includes(c.status)) return false
      const diff = Math.ceil((new Date(c.dueDate).getTime() - Date.now()) / 86_400_000)
      return diff >= 1 && diff <= 7
    })
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .slice(0, 5)

  // Mis actividades activas (pendiente / en_curso)
  const myActiveActivities = actividades
    .filter(a => a.assignee === myName && a.status !== 'completado')
    .sort((a, b) => (a.dueDate ?? '9') < (b.dueDate ?? '9') ? -1 : 1)
    .slice(0, 5)

  // Mi estado de asistencia
  const myEntry    = myUid ? activeToday[myUid] : undefined
  const myIsActive = !!myEntry && !myEntry.checkOutAt

  // Equipo activo (solo contexto)
  const activeTeam = team.filter(m => activeToday[m.id] && !activeToday[m.id].checkOutAt)

  return (
    <>
    {selectedContent && (
      <ContentModal
        initial={selectedContent}
        defaultBrandId={selectedContent.brandId}
        onClose={() => setSelectedContent(null)}
        onSaved={() => setSelectedContent(null)}
      />
    )}
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">

      {/* Header */}
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-4 shrink-0">
        <div className="flex-1">
          <span className="text-[13px] font-semibold text-[#111827]">
            {myName ? `Hola, ${myName.split(' ')[0]}` : 'Dashboard'}
          </span>
          <span className="text-[#d1d5db] mx-1.5">·</span>
          <span className="text-[13px] text-[#9ca3af]">
            {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`${base}/clientes`}
            className="flex items-center gap-1.5 border border-[#e5e7eb] bg-white text-[#374151] text-[13px] font-medium px-3.5 py-2 rounded-xl hover:bg-[#f9fafb] transition-colors">
            <ArrowUpRight size={14} /> Clientes
          </Link>
          <Link href={`${base}/publicaciones`}
            className="flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus size={15} /> Nueva publicación
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-6 flex flex-col gap-5">

          {/* Mi estado hoy */}
          <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 flex items-center gap-4">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={myName}
                className="w-12 h-12 rounded-full object-cover shrink-0 border border-[#e5e7eb]" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] flex items-center justify-center text-white font-bold text-[16px] shrink-0">
                {myName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-[#111827]">{myName || 'Usuario'}</p>
              <p className="text-[12px] text-[#9ca3af]">{profile?.position ?? 'Colaborador'}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center">
                <p className="text-[22px] font-extrabold text-[#111827] leading-none">{myPendientes.length}</p>
                <p className="text-[10px] text-[#9ca3af] mt-0.5">{wf.pendientesLabel}</p>
              </div>
              <div className="w-px h-8 bg-[#f3f4f6]" />
              <div className="text-center">
                <p className="text-[22px] font-extrabold text-[#111827] leading-none">{myEnRevision.length}</p>
                <p className="text-[10px] text-[#9ca3af] mt-0.5">{wf.revisionLabel}</p>
              </div>
              <div className="w-px h-8 bg-[#f3f4f6]" />
              <div className="text-center">
                <p className="text-[22px] font-extrabold text-[#111827] leading-none">{myListos.length}</p>
                <p className="text-[10px] text-[#9ca3af] mt-0.5">{wf.listosLabel}</p>
              </div>
              <div className="w-px h-8 bg-[#f3f4f6]" />
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl"
                style={myIsActive
                  ? { background: '#dcfce7', color: '#16a34a' }
                  : { background: '#f3f4f6', color: '#9ca3af' }}>
                {myIsActive
                  ? `● En sesión desde ${fmtTime(myEntry!.checkInAt)}`
                  : '○ Sin fichar hoy'}
              </span>
            </div>
          </div>

          {/* Grid principal */}
          <div className="grid grid-cols-[1fr_296px] gap-5">

            {/* Columna izquierda — mis tareas */}
            <div className="flex flex-col gap-4">

              {/* Agenda de hoy */}
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
                  <Zap size={15} className="text-[#d97706]" />
                  <span className="text-[14px] font-bold text-[#111827]">Agenda de hoy</span>
                  {myAgendaHoy.length > 0 && (
                    <span className="ml-auto bg-[#fef3c7] text-[#d97706] text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {myAgendaHoy.length} restante{myAgendaHoy.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {myAgendaHoy.length === 0 ? (
                  <div className="flex items-center gap-2 px-5 py-5 text-[13px] text-[#9ca3af]">
                    <CheckCircle2 size={16} className="text-[#16a34a]" />
                    Sin entregas con vencimiento hoy
                  </div>
                ) : (
                  <div className="divide-y divide-[#f9fafb]">
                    {myAgendaHoy.map(c => {
                      const brand = brands.find(b => b.id === c.brandId)
                      return (
                        <div key={c.id} className="px-5 py-3.5 hover:bg-[#fafafa] transition-colors cursor-pointer"
                          onClick={() => setSelectedContent(c)}>
                          <div className="flex items-center gap-2 mb-1.5">
                            {brand && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md"
                                style={{ background: `${brand.color}18`, color: brand.color }}>
                                {brand.name}
                              </span>
                            )}
                            <StatusBadge status={c.status} />
                            <span className="ml-auto text-[9px] text-[#9ca3af]">{c.format}</span>
                          </div>
                          <p className="text-[13px] font-semibold text-[#111827]">{c.title}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Mis contenidos activos */}
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
                  <ListChecks size={15} className="text-[#7c3aed]" />
                  <span className="text-[14px] font-bold text-[#111827]">Mis contenidos activos</span>
                  <Link href={`${base}/publicaciones`}
                    className="ml-auto text-[11px] text-[#7c3aed] font-medium hover:underline">
                    Ver todos
                  </Link>
                </div>
                {myPendientes.length === 0 && myEnRevision.length === 0 ? (
                  <div className="px-5 py-5 text-center text-[13px] text-[#9ca3af]">Sin contenidos activos asignados</div>
                ) : (
                  <div className="divide-y divide-[#f9fafb]">
                    {[...myPendientes, ...myEnRevision].slice(0, 8).map(c => {
                      const brand   = brands.find(b => b.id === c.brandId)
                      const diff    = c.dueDate ? Math.ceil((new Date(c.dueDate).getTime() - Date.now()) / 86_400_000) : null
                      const overdue = diff !== null && diff < 0
                      return (
                        <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] transition-colors cursor-pointer"
                          onClick={() => setSelectedContent(c)}>
                          {brand && (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ background: brand.color }}>
                              {brand.initials}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[#111827] truncate">{c.title}</p>
                            <p className="text-[10px] text-[#9ca3af]">{brand?.name} · {c.format}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {diff !== null && (
                              <span className="text-[9px] font-bold"
                                style={{ color: overdue ? '#dc2626' : diff === 0 ? '#d97706' : '#9ca3af' }}>
                                {overdue ? `${Math.abs(diff)}d vencido` : diff === 0 ? 'Hoy' : `${diff}d`}
                              </span>
                            )}
                            <StatusBadge status={c.status} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Próximos posts del área (contexto general) */}
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
                  <CalendarDays size={15} className="text-[#3b82f6]" />
                  <span className="text-[14px] font-bold text-[#111827]">Próximas publicaciones</span>
                  <Link href={`${base}/calendario`}
                    className="ml-auto text-[11px] text-[#7c3aed] font-medium hover:underline">
                    Ver calendario
                  </Link>
                </div>
                <div className="divide-y divide-[#f9fafb]">
                  {myProximas.length === 0 ? (
                    <div className="px-5 py-5 text-center text-[13px] text-[#9ca3af]">Sin publicaciones próximas asignadas</div>
                  ) : myProximas.map(c => {
                    const diff  = Math.ceil((new Date(c.dueDate!).getTime() - Date.now()) / 86_400_000)
                    const brand = brands.find(b => b.id === c.brandId)
                    const net   = NETWORK_META[c.channel]
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] transition-colors cursor-pointer"
                        onClick={() => setSelectedContent(c)}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: net?.bg, color: net?.dot }}>
                          <NetworkIcon network={c.channel} size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide">{brand?.name}</p>
                          <p className="text-[12px] text-[#374151] truncate">{c.title}</p>
                        </div>
                        <span className="text-[9px] font-bold shrink-0"
                          style={{ color: diff === 1 ? '#d97706' : '#7c3aed' }}>
                          {diff === 1 ? 'Mañana' : `En ${diff}d`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Columna derecha */}
            <div className="flex flex-col gap-4">

              {/* Mis alertas */}
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3.5 border-b border-[#f3f4f6] flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#111827]">Mis alertas</span>
                  {myAlertas.length > 0 && (
                    <span className="bg-[#fee2e2] text-[#dc2626] text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {myAlertas.length}
                    </span>
                  )}
                </div>
                {myAlertas.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-4 text-[12px] text-[#16a34a]">
                    <CheckCircle2 size={14} /> Todo al día
                  </div>
                ) : myAlertas.map(c => {
                  const esCambios = c.status === 'cambios'
                  const diff = c.dueDate ? Math.ceil((Date.now() - new Date(c.dueDate).getTime()) / 86_400_000) : null
                  const brand = brands.find(b => b.id === c.brandId)
                  return (
                    <div key={c.id} className="flex items-start gap-3 px-4 py-3 border-b border-[#f9fafb] last:border-0 hover:bg-[#fafafa] transition-colors cursor-pointer"
                      onClick={() => setSelectedContent(c)}>
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: esCambios ? '#f5f3ff' : '#fee2e2' }}>
                        <AlertTriangle size={13} style={{ color: esCambios ? '#7c3aed' : '#dc2626' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#111827] truncate">{c.title}</p>
                        <p className="text-[10px] text-[#9ca3af] mt-0.5">
                          {brand?.name} · {esCambios ? 'Requiere cambios' : `Vencido hace ${diff}d`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Mis actividades */}
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
                  <ClipboardList size={15} className="text-[#7c3aed]" />
                  <span className="text-[14px] font-bold text-[#111827]">Mis actividades</span>
                  <Link href={`${base}/actividades`}
                    className="ml-auto text-[11px] text-[#7c3aed] font-medium hover:underline">
                    Ver todas
                  </Link>
                </div>
                {myActiveActivities.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-4 text-[12px] text-[#16a34a]">
                    <CheckCircle2 size={14} /> Sin actividades pendientes
                  </div>
                ) : (
                  <div className="divide-y divide-[#f9fafb]">
                    {myActiveActivities.map(a => {
                      const isOverdue = !!(a.dueDate && a.dueDate < today)
                      const diff = a.dueDate
                        ? Math.ceil((new Date(a.dueDate).getTime() - Date.now()) / 86_400_000)
                        : null
                      const dotColor = a.status === 'en_curso' ? '#3b82f6' : '#f59e0b'
                      return (
                        <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafafa] transition-colors">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-[#111827] truncate">{a.title}</p>
                            {a.category && (
                              <p className="text-[10px] text-[#9ca3af]">{a.category}</p>
                            )}
                          </div>
                          {diff !== null && (
                            <span className="text-[9px] font-bold shrink-0"
                              style={{ color: isOverdue ? '#dc2626' : diff === 0 ? '#d97706' : '#9ca3af' }}>
                              {isOverdue ? `${Math.abs(diff)}d venc.` : diff === 0 ? 'Hoy' : `${diff}d`}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Equipo activo hoy */}
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3.5 border-b border-[#f3f4f6] flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#111827]">Equipo activo</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#16a34a]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    {activeTeam.length} en sesión
                  </span>
                </div>
                <div className="divide-y divide-[#f9fafb]">
                  {team.length === 0 && (
                    <div className="px-4 py-5 text-center text-[12px] text-[#9ca3af]">Cargando…</div>
                  )}
                  {team.map(m => {
                    const entry    = activeToday[m.id]
                    const isActive = !!entry && !entry.checkOutAt
                    const isMe     = m.id === myUid
                    return (
                      <div key={m.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#fafafa] transition-colors"
                        style={{ opacity: isActive ? 1 : 0.45 }}>
                        <div className="relative shrink-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: m.color }}>
                            {m.initials}
                          </div>
                          {isActive && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-[#111827] truncate">
                            {m.name}{isMe ? ' (tú)' : ''}
                          </p>
                          <p className="text-[10px] text-[#9ca3af]">
                            {isActive && entry.checkInAt ? `Desde ${fmtTime(entry.checkInAt)}` : 'Sin fichar'}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                          style={isActive
                            ? { background: '#dcfce7', color: '#16a34a' }
                            : { background: '#f3f4f6', color: '#9ca3af' }}>
                          {isActive ? '● Activo' : '○ Inactivo'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="px-4 py-2.5 border-t border-[#f3f4f6] flex gap-1">
                  {(['diseno','audiovisual','estrategia'] as const).map((slug, i) => (
                    <Link key={slug} href={`${base}/equipo/${slug}`}
                      className="flex-1 text-center text-[10px] font-semibold py-1.5 rounded-lg hover:bg-[#f5f3ff] text-[#7c3aed] transition-colors">
                      {['Diseño','Audiovisual','Estrategia'][i]}
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
