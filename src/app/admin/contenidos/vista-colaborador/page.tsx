'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, ArrowUpRight, Clock, AlertTriangle, CheckCircle2, CalendarDays, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import { STATUS_META } from '@/cmhub/data'
import { getContentRelevantDate } from '@/cmhub/contentDates'
import type { TeamMember, TeamCategory } from '@/cmhub/types'

// ── Workflow por área ──────────────────────────────────────────────────────
function getWorkflow(category: TeamCategory | undefined) {
  const isCreativo = category === 'Diseño' || category === 'Audiovisual'
  if (isCreativo) {
    return {
      pendientesLabel: 'En Producción', revisionLabel: 'En Revisión', listosLabel: 'Aprobados',
      pendientes: ['produccion'], enRevision: ['revision'],
      listos: ['aprobado', 'programado', 'publicado', 'finalizado'],
      active: ['produccion', 'revision'], isCreativo: true,
    }
  }
  return {
    pendientesLabel: 'Pendientes', revisionLabel: 'En Revisión', listosLabel: 'Publicados',
    pendientes: ['idea', 'produccion'], enRevision: ['revision', 'cambios'],
    listos: ['publicado', 'finalizado'],
    active: ['idea', 'produccion', 'revision', 'cambios', 'aprobado', 'programado'],
    isCreativo: false,
  }
}

function todayISO() { return new Date().toISOString().split('T')[0] }
function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
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

// ── Selector de colaboradores ─────────────────────────────────────────────
function MemberSelector({ team, onSelect }: { team: TeamMember[]; onSelect: (m: TeamMember) => void }) {
  const categoryColor: Record<string, string> = {
    Diseño: '#ec4899', Audiovisual: '#f97316', Estrategia: '#6366f1', Otro: '#64748b',
  }
  const grouped = ['Estrategia', 'Diseño', 'Audiovisual', 'Otro'].map(cat => ({
    cat, members: team.filter(m => (m.category ?? 'Otro') === cat),
  })).filter(g => g.members.length > 0)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <span className="text-[13px] font-semibold text-[#111827]">Vista de colaborador</span>
        <span className="text-[#d1d5db] mx-0.5">·</span>
        <span className="text-[13px] text-[#9ca3af]">Selecciona un perfil para ver su dashboard</span>
      </div>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
        {grouped.map(({ cat, members }) => (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: categoryColor[cat] }} />
              <span className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-widest">{cat}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => onSelect(m)}
                  className="flex flex-col items-center gap-3 bg-white border border-[#e5e7eb] rounded-2xl p-5 hover:border-[#7c3aed] hover:shadow-md transition-all group"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-[18px] shrink-0 group-hover:scale-105 transition-transform"
                    style={{ background: m.color || categoryColor[cat] || '#7c3aed' }}
                  >
                    {m.initials}
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[#111827] group-hover:text-[#7c3aed] transition-colors">{m.name}</p>
                    <p className="text-[11px] text-[#9ca3af] mt-0.5">{m.position ?? m.category ?? '—'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {team.length === 0 && (
          <div className="text-center py-16 text-[#9ca3af] text-[14px]">No hay colaboradores registrados</div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard del colaborador seleccionado ────────────────────────────────
function CollaboratorDashboard({ member, onBack }: { member: TeamMember; onBack: () => void }) {
  const { brands, contents, team } = useHub()
  const base = useHubBase()
  const activeToday = useActiveToday(team)
  const today = todayISO()
  const wf = getWorkflow(member.category)
  const myName = member.name

  const myContents = contents.filter(c =>
    sameName(c.responsible, myName) ||
    c.responsables?.some(r => sameName(r, myName)) ||
    sameName(c.dueAssignee, myName)
  )

  const myPendientes = myContents.filter(c => wf.pendientes.includes(c.status))
  const myEnRevision = myContents.filter(c => wf.enRevision.includes(c.status))
  const myListos     = myContents.filter(c => wf.listos.includes(c.status))

  const myAgendaHoy = myContents
    .filter(c => getContentRelevantDate(c, wf.isCreativo) === today && wf.active.includes(c.status))
    .sort((a, b) => (getContentRelevantDate(a, wf.isCreativo) ?? '').localeCompare(getContentRelevantDate(b, wf.isCreativo) ?? ''))

  const myAlertas = myContents.filter(c => {
    const relevant = getContentRelevantDate(c, wf.isCreativo)
    const overdue = relevant && relevant < today && wf.active.includes(c.status)
    const cambios = c.status === 'cambios' && !wf.isCreativo
    return overdue || cambios
  }).slice(0, 5)

  const myProximas = myContents
    .filter(c => {
      const relevant = getContentRelevantDate(c, wf.isCreativo)
      if (!relevant || relevant <= today) return false
      if (!wf.active.includes(c.status)) return false
      const diff = Math.ceil((new Date(relevant).getTime() - Date.now()) / 86_400_000)
      return diff >= 1 && diff <= 7
    })
    .sort((a, b) => (getContentRelevantDate(a, wf.isCreativo) ?? '').localeCompare(getContentRelevantDate(b, wf.isCreativo) ?? ''))
    .slice(0, 5)

  const memberEntry = activeToday[member.id]
  const memberIsActive = !!memberEntry && !memberEntry.checkOutAt

  const activeTeam = team.filter(m => activeToday[m.id] && !activeToday[m.id].checkOutAt)

  const categoryColor: Record<string, string> = {
    Diseño: '#ec4899', Audiovisual: '#f97316', Estrategia: '#6366f1', Otro: '#64748b',
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[#6b7280] hover:text-[#374151] transition-colors text-[13px] font-medium"
        >
          <ArrowLeft size={14} /> Volver
        </button>
        <span className="text-[#d1d5db]">·</span>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ background: member.color || categoryColor[member.category ?? 'Otro'] || '#7c3aed' }}
        >
          {member.initials}
        </div>
        <span className="text-[13px] font-semibold text-[#111827]">{member.name}</span>
        <span className="text-[11px] text-[#9ca3af] bg-[#f3f4f6] px-2 py-0.5 rounded-full">{member.position ?? member.category}</span>
        <div className="flex-1" />
        <span className="text-[11px] text-[#f59e0b] bg-[#fef3c7] px-2.5 py-1 rounded-full font-semibold">
          Vista de solo lectura
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-6 flex flex-col gap-5">

          {/* Estado del colaborador hoy */}
          <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[16px] shrink-0"
              style={{ background: member.color || categoryColor[member.category ?? 'Otro'] || '#7c3aed' }}
            >
              {member.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-[#111827]">{member.name}</p>
              <p className="text-[12px] text-[#9ca3af]">{member.position ?? member.category ?? 'Colaborador'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold ${memberIsActive ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f3f4f6] text-[#9ca3af]'}`}>
                <span className={`w-2 h-2 rounded-full ${memberIsActive ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`} />
                {memberIsActive ? 'Activo hoy' : 'Sin registrar'}
              </div>
              <div className="flex items-center gap-4 px-4 py-2 bg-[#f9fafb] rounded-xl border border-[#e5e7eb]">
                <div className="text-center">
                  <p className="text-[18px] font-bold text-[#111827]">{myPendientes.length}</p>
                  <p className="text-[10px] text-[#9ca3af] uppercase tracking-wide">{wf.pendientesLabel}</p>
                </div>
                <div className="w-px h-8 bg-[#e5e7eb]" />
                <div className="text-center">
                  <p className="text-[18px] font-bold text-[#7c3aed]">{myEnRevision.length}</p>
                  <p className="text-[10px] text-[#9ca3af] uppercase tracking-wide">{wf.revisionLabel}</p>
                </div>
                <div className="w-px h-8 bg-[#e5e7eb]" />
                <div className="text-center">
                  <p className="text-[18px] font-bold text-[#16a34a]">{myListos.length}</p>
                  <p className="text-[10px] text-[#9ca3af] uppercase tracking-wide">{wf.listosLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">

            {/* Alertas */}
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
                <AlertTriangle size={14} className="text-[#ef4444]" />
                <span className="text-[13px] font-bold text-[#111827]">Alertas</span>
                {myAlertas.length > 0 && (
                  <span className="ml-auto text-[11px] font-bold text-white bg-[#ef4444] px-2 py-0.5 rounded-full">{myAlertas.length}</span>
                )}
              </div>
              {myAlertas.length === 0 ? (
                <div className="px-5 py-6 flex items-center justify-center gap-2 text-[13px] text-[#9ca3af]">
                  <CheckCircle2 size={16} className="text-[#16a34a]" />
                  Sin alertas pendientes
                </div>
              ) : (
                <div className="divide-y divide-[#f3f4f6]">
                  {myAlertas.map(c => {
                    const brand = brands.find(b => b.id === c.brandId)
                    const relevant = getContentRelevantDate(c, wf.isCreativo)
                    const isOverdue = relevant && relevant < today
                    return (
                      <div key={c.id} className="flex items-start gap-3 px-5 py-3">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isOverdue ? 'bg-red-400' : 'bg-amber-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#111827] truncate">{c.title}</p>
                          <p className="text-[10px] text-[#9ca3af]">
                            {brand?.name}
                            {isOverdue && relevant ? ` · venció ${fmtDate(relevant)}` : ''}
                          </p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Agenda hoy */}
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
                <CalendarDays size={14} className="text-[#7c3aed]" />
                <span className="text-[13px] font-bold text-[#111827]">Agenda hoy</span>
                {myAgendaHoy.length > 0 && (
                  <span className="ml-auto text-[11px] font-bold text-white bg-[#7c3aed] px-2 py-0.5 rounded-full">{myAgendaHoy.length}</span>
                )}
              </div>
              {myAgendaHoy.length === 0 ? (
                <div className="px-5 py-6 text-center text-[13px] text-[#9ca3af]">Sin entregas para hoy</div>
              ) : (
                <div className="divide-y divide-[#f3f4f6]">
                  {myAgendaHoy.map(c => {
                    const channels = c.channels?.length ? c.channels : [c.channel]
                    const brand = brands.find(b => b.id === c.brandId)
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="flex gap-0.5 shrink-0">
                          {channels.slice(0, 2).map(ch => (
                            <span key={ch} className="w-5 h-5 rounded-md bg-[#f3f4f6] flex items-center justify-center">
                              <NetworkIcon network={ch} size={11} />
                            </span>
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#111827] truncate">{c.title}</p>
                          <p className="text-[10px] text-[#9ca3af]">{brand?.name}</p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Contenidos activos */}
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
                <ListChecks size={14} className="text-[#3b82f6]" />
                <span className="text-[13px] font-bold text-[#111827]">Contenidos activos</span>
                <span className="ml-auto text-[11px] font-bold text-[#6b7280] bg-[#f3f4f6] px-2 py-0.5 rounded-full">
                  {myPendientes.length + myEnRevision.length}
                </span>
              </div>
              {myPendientes.length + myEnRevision.length === 0 ? (
                <div className="px-5 py-6 text-center text-[13px] text-[#9ca3af]">Sin contenidos activos</div>
              ) : (
                <div className="divide-y divide-[#f3f4f6] max-h-64 overflow-y-auto">
                  {[...myPendientes, ...myEnRevision].map(c => {
                    const channels = c.channels?.length ? c.channels : [c.channel]
                    const brand = brands.find(b => b.id === c.brandId)
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                        <div className="flex gap-0.5 shrink-0">
                          {channels.slice(0, 2).map(ch => (
                            <span key={ch} className="w-5 h-5 rounded-md bg-[#f3f4f6] flex items-center justify-center">
                              <NetworkIcon network={ch} size={11} />
                            </span>
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#111827] truncate">{c.title}</p>
                          <p className="text-[10px] text-[#9ca3af]">{brand?.name}</p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Próximas entregas */}
            {myProximas.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
                  <Clock size={14} className="text-[#f59e0b]" />
                  <span className="text-[13px] font-bold text-[#111827]">Próximas entregas</span>
                  <span className="ml-auto text-[11px] text-[#9ca3af]">próximos 7 días</span>
                </div>
                <div className="divide-y divide-[#f3f4f6]">
                  {myProximas.map(c => {
                    const brand = brands.find(b => b.id === c.brandId)
                    const relevant = getContentRelevantDate(c, wf.isCreativo)!
                    const diff = Math.ceil((new Date(relevant).getTime() - Date.now()) / 86_400_000)
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#111827] truncate">{c.title}</p>
                          <p className="text-[10px] text-[#9ca3af]">{brand?.name} · {fmtDate(relevant)}</p>
                        </div>
                        <span className="text-[10px] font-bold text-[#f59e0b] bg-[#fef3c7] px-2 py-0.5 rounded-full shrink-0">
                          {diff === 1 ? 'mañana' : `${diff}d`}
                        </span>
                        <StatusBadge status={c.status} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Equipo activo */}
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f3f4f6] flex items-center gap-2">
                <span className="text-[13px] font-bold text-[#111827]">Equipo activo</span>
                <span className="ml-auto text-[11px] font-bold text-[#6b7280] bg-[#f3f4f6] px-2 py-0.5 rounded-full">{activeTeam.length}</span>
              </div>
              {activeTeam.length === 0 ? (
                <div className="px-5 py-5 text-center text-[13px] text-[#9ca3af]">Nadie activo ahora</div>
              ) : (
                <div className="divide-y divide-[#f3f4f6]">
                  {activeTeam.map(m => {
                    const entry = activeToday[m.id]
                    const isMe = m.id === member.id
                    const myActiveContents = contents.filter(c =>
                      (sameName(c.responsible, m.name) || c.responsables?.some(r => sameName(r, m.name))) &&
                      ['produccion', 'revision', 'cambios'].includes(c.status)
                    )
                    return (
                      <div key={m.id} className={`flex items-center gap-3 px-5 py-3 ${isMe ? 'bg-[#f5f3ff]' : ''}`}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ background: m.color || '#7c3aed' }}>
                          {m.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#111827]">
                            {m.name}{isMe ? <span className="ml-1 text-[#7c3aed] text-[10px]">(este perfil)</span> : ''}
                          </p>
                          <p className="text-[10px] text-[#9ca3af]">
                            {entry?.checkInAt ? new Date(entry.checkInAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''} · {myActiveContents.length} activos
                          </p>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-[#16a34a] shrink-0" />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function VistaColaborador() {
  const { team } = useHub()
  const base = useHubBase()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<TeamMember | null>(null)

  // Auto-seleccionar si viene con ?member=id (ej. desde Supervisión)
  useEffect(() => {
    const memberId = searchParams.get('member')
    if (!memberId || !team.length) return
    const found = team.find(m => m.id === memberId)
    if (found) setSelected(found)
  }, [searchParams, team])

  const fromSupervision = searchParams.get('from') === 'supervision'

  function handleBack() {
    if (fromSupervision) {
      window.history.back()
    } else {
      setSelected(null)
    }
  }

  if (!selected) return <MemberSelector team={team} onSelect={setSelected} />
  return <CollaboratorDashboard member={selected} onBack={handleBack} />
}
