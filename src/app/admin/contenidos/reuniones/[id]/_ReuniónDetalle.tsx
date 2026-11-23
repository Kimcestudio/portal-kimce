'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getDoc, doc } from 'firebase/firestore'
import {
  ArrowLeft, ExternalLink, Clock, CheckCircle2, AlertCircle,
  Search, Plus, Trash2, Save, Sparkles, FolderOpen, Copy,
  Check, Mic2, X, ChevronRight,
} from 'lucide-react'
import { useHub }      from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useAuth }     from '@/components/auth/AuthProvider'
import { useHubBase }  from '@/cmhub/useHubBase'
import { db }          from '@/services/firebase/client'
import {
  subscribeMeeting, updateMeeting, createTasksFromMeeting,
  regenerateSummary, refetchNativeSummary, deleteMeeting, inviteFirefliesBot,
  formatDuration,
  type HubReunion, type MeetingActionItem, type MeetingPlatform,
} from '@/services/meetings'

// ── Visual utilities ───────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-teal-400 to-emerald-600',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-600',
  'from-sky-400 to-blue-600',
  'from-indigo-400 to-indigo-600',
  'from-green-400 to-teal-500',
  'from-fuchsia-400 to-purple-600',
]

function avatarGradient(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (name.charCodeAt(i) + ((h << 5) - h)) & 0xffffffff
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatMeetingDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d} ${months[m - 1]} ${y}`
}

// ── Platform badge ─────────────────────────────────────────────────────────

const PLATFORM_CFG: Record<MeetingPlatform, { gradient: string; initial: string; label: string }> = {
  google_meet: { gradient: 'from-emerald-400 to-green-600',  initial: 'M', label: 'Google Meet' },
  discord:     { gradient: 'from-indigo-400 to-violet-700',  initial: 'D', label: 'Discord'      },
  zoom:        { gradient: 'from-sky-400 to-blue-600',       initial: 'Z', label: 'Zoom'         },
  manual:      { gradient: 'from-slate-300 to-slate-500',    initial: '·', label: 'Manual'       },
}

function PlatformBadge({ platform, size = 48 }: { platform: MeetingPlatform; size?: number }) {
  const { gradient, initial } = PLATFORM_CFG[platform]
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white flex-shrink-0 shadow-lg`}
      style={{ width: size, height: size, fontSize: size * 0.37 }}
    >
      {initial}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function MeetingDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const base    = useHubBase()
  const { isDark }              = useHubTheme()
  const { team, proyectos }     = useHub()
  const { profile, authUser }   = useAuth()
  const isAdmin = profile?.role?.toLowerCase() === 'admin'
  const uid     = authUser?.uid ?? null

  const id = typeof window !== 'undefined'
    ? window.location.pathname.split('/').filter(Boolean).pop() ?? ''
    : String(params?.id ?? '')

  const [meeting, setMeeting]           = useState<HubReunion | null>(null)
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<'resumen' | 'pendientes' | 'transcripcion'>('resumen')
  const [transcriptSearch, setTranscriptSearch] = useState('')
  const [items, setItems]               = useState<MeetingActionItem[]>([])
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({})
  const [busy, setBusy]                 = useState(false)
  const [msg, setMsg]                   = useState('')
  const [err, setErr]                   = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [markingStatus, setMarkingStatus] = useState(false)
  const [deletingMeeting, setDeletingMeeting] = useState(false)
  const [confirmDelete, setConfirmDelete]     = useState(false)
  const [invitingBot, setInvitingBot]         = useState(false)

  useEffect(() => {
    if (!id || !uid) return
    const unsub = subscribeMeeting(id, m => {
      setMeeting(m)
      if (m) setItems(m.actionItems)
      setLoading(false)
    })
    return unsub
  }, [id, uid])

  useEffect(() => {
    const taskIds = items.map(i => i.taskId).filter(Boolean) as string[]
    if (!taskIds.length) return
    const missing = taskIds.filter(tid => !(tid in taskStatuses))
    if (!missing.length) return
    Promise.all(
      missing.map(tid =>
        getDoc(doc(db, 'hubActividades', tid))
          .then(snap => [tid, snap.data()?.status ?? 'pendiente'] as [string, string])
      )
    ).then(entries => setTaskStatuses(prev => ({ ...prev, ...Object.fromEntries(entries) })))
  }, [items])

  function flash(text: string, type: 'ok' | 'err' = 'ok') {
    if (type === 'err') { setErr(text); setTimeout(() => setErr(''), 4000) }
    else { setMsg(text); setTimeout(() => setMsg(''), 3000) }
  }

  async function saveItems() {
    if (!meeting) return
    setBusy(true)
    try { await updateMeeting(meeting.id, { actionItems: items }); flash('Pendientes guardados.') }
    catch (e) { flash((e as { message?: string })?.message ?? 'Error al guardar.', 'err') }
    finally { setBusy(false) }
  }

  async function createTasks() {
    if (!meeting) return
    const toCreate = items.filter(i => !i.done && i.text.trim())
    if (!toCreate.length) { flash('No hay pendientes sin procesar.', 'err'); return }
    setBusy(true)
    try {
      const enriched = toCreate.map(item => {
        const member = item.assignee
          ? team.find(m =>
              m.name.toLowerCase().includes(item.assignee.toLowerCase().split(' ')[0]) ||
              item.assignee.toLowerCase().includes(m.name.split(' ')[0].toLowerCase())
            )
          : null
        return { ...item, assigneeUid: member?.id, assigneeIds: member ? [member.id] : [] }
      })
      const { created } = await createTasksFromMeeting(meeting.id, enriched)
      flash(`${created} tarea${created !== 1 ? 's' : ''} creada${created !== 1 ? 's' : ''} en Actividades.`)
    } catch (e) {
      flash((e as { message?: string })?.message ?? 'Error al crear tareas.', 'err')
    } finally { setBusy(false) }
  }

  async function toggleStatus() {
    if (!meeting) return
    setMarkingStatus(true)
    try {
      const next = meeting.status === 'reviewed' ? 'pending_review' : 'reviewed'
      await updateMeeting(meeting.id, { status: next })
      flash(next === 'reviewed' ? 'Marcado como revisado.' : 'Marcado como pendiente.')
    } catch (e) {
      flash((e as { message?: string })?.message ?? 'Error al actualizar.', 'err')
    } finally { setMarkingStatus(false) }
  }

  async function handleDelete() {
    if (!meeting) return
    setDeletingMeeting(true)
    try {
      await deleteMeeting(meeting.id)
      router.push(`${base}/reuniones`)
    } catch (e) {
      flash((e as { message?: string })?.message ?? 'Error al eliminar.', 'err')
      setDeletingMeeting(false)
    }
  }

  async function handleInviteBot() {
    if (!meeting?.recordingUrl && !meeting) return
    setInvitingBot(true)
    try {
      const res = await inviteFirefliesBot({ meetingLink: meeting.recordingUrl || '', title: meeting.title })
      if (res.ok) flash('Bot de Fireflies invitado a la reunión.')
      else flash(res.error ?? 'No se pudo invitar al bot.', 'err')
    } catch (e) {
      flash((e as { message?: string })?.message ?? 'Error al invitar bot.', 'err')
    } finally { setInvitingBot(false) }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function updateItem(idx: number, patch: Partial<MeetingActionItem>) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))
  }

  function addItem() {
    setItems(prev => [
      ...prev,
      { id: Date.now().toString(36), text: '', assignee: '', dueDate: '', taskId: '', done: false, order: prev.length },
    ])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Shared style helpers ───────────────────────────────────────────────

  const inputCls = `w-full rounded-xl border px-3 py-2 text-[13px] outline-none transition
    focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 ${
      isDark
        ? 'bg-[#1e2027] border-white/10 text-slate-100 placeholder:text-slate-500'
        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
    }`

  const selectCls = `rounded-lg border px-2.5 py-1.5 text-[12px] outline-none transition
    focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 ${
      isDark
        ? 'bg-[#1e2027] border-white/10 text-slate-100'
        : 'bg-slate-50 border-slate-200 text-slate-700'
    }`

  // ── Loading state ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-5 pb-12 animate-pulse">
        <div className={`h-3.5 w-24 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
        <div className={`rounded-2xl border p-5 ${isDark ? 'border-white/8 bg-[#161820]' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 rounded-2xl flex-shrink-0 ${isDark ? 'bg-white/8' : 'bg-slate-200'}`} />
            <div className="flex-1">
              <div className={`h-5 rounded-lg w-56 mb-2 ${isDark ? 'bg-white/8' : 'bg-slate-200'}`} />
              <div className={`h-3 rounded-lg w-36 ${isDark ? 'bg-white/5' : 'bg-slate-200'}`} />
            </div>
          </div>
          <div className="flex -space-x-2 mb-4">
            {[0,1,2].map(i => <div key={i} className={`w-10 h-10 rounded-full ${isDark ? 'bg-white/8' : 'bg-slate-200'}`} />)}
          </div>
          <div className={`h-3 rounded w-full mb-2 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />
          <div className={`h-3 rounded w-3/4 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="py-16 text-center">
        <p className={`text-[14px] mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Reunión no encontrada.
        </p>
        <button
          onClick={() => router.push(`${base}/reuniones`)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700 transition-colors"
        >
          <ArrowLeft size={13} /> Volver a reuniones
        </button>
      </div>
    )
  }

  const pendingCount  = items.filter(i => !i.done).length
  const isFathom      = meeting.source === 'fathom'

  const autoCreatedProject = meeting.proyectoId
    ? proyectos.find(p => p.id === meeting.proyectoId && (p as unknown as { autoCreated?: boolean }).autoCreated)
    : null

  const TABS = [
    { id: 'resumen',       label: 'Resumen'                                                   },
    { id: 'pendientes',    label: `Pendientes${pendingCount ? ` · ${pendingCount}` : ''}`     },
    { id: 'transcripcion', label: 'Transcripción'                                             },
  ] as const

  const platformLabel = PLATFORM_CFG[meeting.platform]?.label ?? meeting.platform

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5 pb-12">

      {/* ── Breadcrumb ── */}
      <button
        onClick={() => router.push(`${base}/reuniones`)}
        className={`self-start inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors ${
          isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'
        }`}
      >
        <ArrowLeft size={13} /> Reuniones
      </button>

      {/* ── Hero card ── */}
      <div className={`rounded-2xl border p-5 ${
        isDark ? 'bg-[#161820] border-white/8' : 'bg-white border-slate-200 shadow-sm'
      }`}>

        {/* Platform badge + title + meta */}
        <div className="flex items-start gap-4 mb-4">
          <PlatformBadge platform={meeting.platform} size={48} />
          <div className="flex-1 min-w-0">
            <h1 className={`text-[19px] font-bold leading-tight tracking-tight mb-1 ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
              {meeting.title}
            </h1>
            <div className={`flex items-center flex-wrap gap-x-2 gap-y-1 text-[12px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>{platformLabel}</span>
              <span className={isDark ? 'text-white/15' : 'text-slate-300'}>·</span>
              <span>{formatMeetingDate(meeting.date)}{meeting.time ? ` · ${meeting.time}` : ''}</span>
              {meeting.duration ? (
                <>
                  <span className={isDark ? 'text-white/15' : 'text-slate-300'}>·</span>
                  <span>{formatDuration(meeting.duration)}</span>
                </>
              ) : null}
              {meeting.recordingUrl && (
                <>
                  <span className={isDark ? 'text-white/15' : 'text-slate-300'}>·</span>
                  <a
                    href={meeting.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 font-medium transition-colors ${
                      isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'
                    }`}
                  >
                    <ExternalLink size={11} /> Ver grabación
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Status pill */}
          {meeting.status === 'reviewed' ? (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 ${
              isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
            }`}>
              <CheckCircle2 size={10} /> Revisado
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 ${
              isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
            }`}>
              <AlertCircle size={10} /> Pendiente
            </span>
          )}
        </div>

        {/* Participant avatars */}
        {meeting.participants.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {meeting.participants.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  title={p.name}
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(p.name)} flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0 ring-2 ${
                    isDark ? 'ring-[#161820]' : 'ring-white'
                  }`}
                >
                  {getInitials(p.name)}
                </div>
                <div>
                  <p className={`text-[12px] font-semibold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {p.name.split(' ')[0]}
                  </p>
                  {p.email && (
                    <p className={`text-[10px] leading-tight ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {p.email}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick stat chips */}
        <div className={`flex items-center flex-wrap gap-2 pt-3 border-t mb-4 ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
          {pendingCount > 0 && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}>
              <Clock size={10} /> {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
          {meeting.tasksCreated.length > 0 && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              isDark ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}>
              <CheckCircle2 size={10} /> {meeting.tasksCreated.length} tarea{meeting.tasksCreated.length !== 1 ? 's' : ''} creada{meeting.tasksCreated.length !== 1 ? 's' : ''}
            </span>
          )}
          {isFathom && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              isDark ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400' : 'bg-violet-50 border border-violet-200 text-violet-700'
            }`}>
              <Sparkles size={10} /> KIMCE AI
            </span>
          )}
        </div>

        {/* Action buttons */}
        {isAdmin && (
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={toggleStatus}
              disabled={markingStatus}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-60 ${
                meeting.status === 'reviewed'
                  ? isDark ? 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-500/25'
              }`}
            >
              {meeting.status === 'reviewed' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
              {markingStatus
                ? 'Guardando…'
                : meeting.status === 'reviewed' ? 'Marcar pendiente' : 'Marcar como revisado'
              }
            </button>

            {!meeting.transcript && meeting.recordingUrl && (
              <button
                onClick={handleInviteBot}
                disabled={invitingBot}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border transition-colors disabled:opacity-60 ${
                  isDark ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Mic2 size={12} /> {invitingBot ? 'Invitando…' : 'Invitar Fireflies'}
              </button>
            )}

            <div className="flex-1" />

            <button
              onClick={() => setConfirmDelete(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
                isDark ? 'border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/15' : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              <Trash2 size={12} /> Eliminar
            </button>
          </div>
        )}
      </div>

      {/* ── Feedback banner ── */}
      {(msg || err) && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium ${
          err
            ? isDark ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200'
            : isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {err ? <AlertCircle size={14} /> : <Check size={14} />}
          {msg || err}
        </div>
      )}

      {/* ── Auto-created project banner ── */}
      {autoCreatedProject && (
        <div className={`flex items-start gap-3 px-4 py-4 rounded-2xl border ${
          isDark ? 'border-violet-500/30 bg-violet-500/10' : 'border-violet-200 bg-violet-50'
        }`}>
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={14} color="#fff" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[12px] font-bold ${isDark ? 'text-violet-400' : 'text-violet-700'}`}>KIMCE AI</span>
              <span className={`text-[11px] ${isDark ? 'text-violet-400/70' : 'text-violet-600/80'}`}>creó un proyecto desde esta reunión</span>
            </div>
            <div className="flex items-center gap-2">
              <FolderOpen size={12} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
              <span className={`text-[13px] font-semibold ${isDark ? 'text-violet-200' : 'text-violet-900'}`}>
                {autoCreatedProject.nombre}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                isDark ? 'bg-white/8 text-violet-300' : 'bg-violet-100 text-violet-700'
              }`}>Prospecto</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className={`flex gap-1 p-1 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all ${
              tab === t.id
                ? isDark
                  ? 'bg-white/10 text-slate-100 shadow-sm'
                  : 'bg-white text-slate-900 shadow-sm'
                : isDark
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Resumen ── */}
      {tab === 'resumen' && (
        <div className="flex flex-col gap-3">
          {/* Resumen original de Fathom */}
          {meeting.fathomSummary ? (
            <div className={`rounded-2xl border ${isDark ? 'border-white/8 bg-[#161820]' : 'border-slate-200 bg-white'}`}>
              <div className={`flex items-center justify-between gap-3 px-5 py-3.5 border-b ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-50 text-sky-700'}`}>
                    Fathom
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Resumen original</span>
                </div>
                <button
                  onClick={() => copyToClipboard(meeting.fathomSummary!)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${isDark ? 'text-slate-400 hover:bg-white/8 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="px-5 py-4">
                <div className={`text-[13.5px] leading-[1.8] whitespace-pre-wrap [&_strong]:font-semibold [&_ul]:pl-5 [&_li]:list-disc ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {meeting.fathomSummary.split('\n').map((line, i) => {
                    const stripped = line.replace(/^#{1,6}\s*/, '')
                    if (/^#{1,6}\s/.test(line)) return <p key={i} className={`font-bold mt-3 mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{stripped}</p>
                    if (/^[-*]\s/.test(line)) return <p key={i} className="pl-4 before:content-['•'] before:mr-2 before:text-violet-400">{line.replace(/^[-*]\s/, '')}</p>
                    if (!line.trim()) return <div key={i} className="h-2" />
                    return <p key={i}>{line}</p>
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* Resumen KIMCE AI (siempre visible si existe) */}
          <div className={`rounded-2xl border ${isDark ? 'border-white/8 bg-[#161820]' : 'border-slate-200 bg-white'}`}>
          {meeting.summary ? (
            <>
              <div className={`flex items-center justify-between gap-3 px-5 py-3.5 border-b ${isDark ? 'border-white/8' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2">
                  {isFathom && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isDark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-700'
                    }`}>
                      <Sparkles size={9} /> KIMCE AI
                    </span>
                  )}
                  <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {isFathom ? 'Generado automáticamente' : 'Resumen manual'}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(meeting.summary)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    isDark ? 'text-slate-400 hover:bg-white/8 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="px-5 py-4">
                <p className={`text-[14px] leading-[1.8] whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {meeting.summary}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 items-center py-12 text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Sparkles size={22} className={`${isDark ? 'text-violet-400' : 'text-violet-500'} opacity-70`} />
              </div>
              <div>
                <p className={`text-[14px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Sin resumen disponible
                </p>
                <p className={`text-[12px] max-w-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {meeting.transcript
                    ? 'Puedes generar un resumen con KIMCE AI desde la transcripción.'
                    : 'Agrega una transcripción para poder generar un resumen.'}
                </p>
              </div>
              {meeting.transcript && isAdmin && (
                <button
                  onClick={async () => {
                    setRegenerating(true)
                    try {
                      const native = await refetchNativeSummary(meeting.id)
                      if (native.ok && native.summary) { flash('Resumen cargado desde la fuente original.'); return }
                      await regenerateSummary(meeting.id)
                      flash('Resumen generado por KIMCE AI.')
                    } catch {
                      flash('No se pudo obtener el resumen.', 'err')
                    } finally { setRegenerating(false) }
                  }}
                  disabled={regenerating}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    regenerating ? 'bg-violet-400' : 'bg-violet-600 hover:bg-violet-700'
                  }`}
                >
                  <Sparkles size={13} /> {regenerating ? 'Generando…' : 'Generar con KIMCE AI'}
                </button>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {/* ── Tab: Pendientes ── */}
      {tab === 'pendientes' && (
        <div className="flex flex-col gap-3">
          {isFathom && items.length > 0 && (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isDark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-700'
              }`}>
                <Sparkles size={9} /> KIMCE AI
              </span>
              <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Extraídos y traducidos automáticamente
              </span>
            </div>
          )}

          {isAdmin && (
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={addItem}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Plus size={12} /> Añadir
              </button>
              <button
                onClick={saveItems}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Save size={12} /> Guardar
              </button>
              <button
                onClick={createTasks}
                disabled={busy || pendingCount === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-violet-600 hover:bg-violet-700`}
                title={pendingCount === 0 ? 'No hay pendientes sin procesar' : undefined}
              >
                <CheckCircle2 size={12} />
                Crear {pendingCount} tarea{pendingCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <div className={`flex flex-col items-center gap-3 py-12 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Clock size={22} className="opacity-40" />
              </div>
              <div>
                <p className={`text-[14px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Sin pendientes</p>
                <p className="text-[12px]">No hay compromisos registrados para esta reunión.</p>
              </div>
              {isAdmin && (
                <button
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 transition-colors"
                >
                  <Plus size={12} /> Añadir pendiente
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex gap-3 items-start rounded-2xl border-l-2 px-4 py-3.5 transition-opacity ${
                    item.done
                      ? isDark
                        ? 'border-l-emerald-500 border border-emerald-500/15 bg-emerald-500/5 opacity-55'
                        : 'border-l-emerald-500 border border-emerald-100 bg-emerald-50/60 opacity-60'
                      : isDark
                        ? 'border-l-violet-500 border border-white/8 bg-[#161820]'
                        : 'border-l-violet-500 border border-slate-200 bg-white shadow-sm'
                  }`}
                >
                  {/* Apple-style circular checkbox */}
                  <label className="flex-shrink-0 mt-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled={!isAdmin}
                      onChange={e => updateItem(idx, { done: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      item.done
                        ? 'bg-emerald-500 border-emerald-500'
                        : isDark
                          ? 'border-violet-400 hover:border-violet-300'
                          : 'border-violet-500 hover:border-violet-600'
                    } ${!isAdmin ? 'cursor-default' : 'cursor-pointer'}`}>
                      {item.done && <Check size={11} className="text-white" strokeWidth={3} />}
                    </div>
                  </label>

                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    {isAdmin ? (
                      <input
                        value={item.text}
                        onChange={e => updateItem(idx, { text: e.target.value })}
                        placeholder="Descripción del pendiente"
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none transition
                          focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 ${
                            isDark
                              ? 'bg-[#1e2027] border-white/10 text-slate-100 placeholder:text-slate-500'
                              : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
                          }`}
                      />
                    ) : (
                      <span className={`text-[13px] leading-snug ${
                        item.done
                          ? isDark ? 'line-through text-slate-500' : 'line-through text-slate-400'
                          : isDark ? 'text-slate-100' : 'text-slate-800'
                      }`}>
                        {item.text}
                      </span>
                    )}

                    <div className="flex gap-2 flex-wrap items-center">
                      {isAdmin ? (
                        <>
                          <select
                            value={item.assignee}
                            onChange={e => updateItem(idx, { assignee: e.target.value })}
                            className={selectCls}
                          >
                            <option value="">Sin asignar</option>
                            {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                          </select>
                          <select
                            value={item.proyectoId || ''}
                            onChange={e => updateItem(idx, { proyectoId: e.target.value || undefined })}
                            className={selectCls}
                          >
                            <option value="">Sin proyecto</option>
                            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                          <input
                            type="date"
                            value={item.dueDate}
                            onChange={e => updateItem(idx, { dueDate: e.target.value })}
                            className={selectCls}
                          />
                        </>
                      ) : (
                        <>
                          {item.assignee && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              isDark ? 'bg-white/8 text-slate-400' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {item.assignee}
                            </span>
                          )}
                          {item.dueDate && (
                            <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {item.dueDate}
                            </span>
                          )}
                        </>
                      )}

                      {/* Task status badge */}
                      {item.taskId && (() => {
                        const s = taskStatuses[item.taskId] ?? 'loading'
                        type Cfg = { color: string; bg: string; label: string }
                        const cfg: Cfg =
                          s === 'completado'  ? { color: isDark ? 'text-emerald-400' : 'text-emerald-700', bg: isDark ? 'bg-emerald-500/15' : 'bg-emerald-50', label: 'Completada'   } :
                          s === 'en_progreso' ? { color: isDark ? 'text-blue-400'    : 'text-blue-700',    bg: isDark ? 'bg-blue-500/15'    : 'bg-blue-50',    label: 'En progreso'  } :
                          s === 'loading'     ? { color: isDark ? 'text-slate-500'   : 'text-slate-400',   bg: isDark ? 'bg-white/5'        : 'bg-slate-100',  label: '…'            } :
                                                { color: isDark ? 'text-amber-400'   : 'text-amber-700',   bg: isDark ? 'bg-amber-500/15'   : 'bg-amber-50',   label: 'Pendiente'    }
                        return (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${cfg.color} ${cfg.bg}`}>
                            {s === 'completado' && <CheckCircle2 size={9} />}
                            {cfg.label}
                          </span>
                        )
                      })()}
                    </div>
                  </div>

                  {isAdmin && !item.taskId && (
                    <button
                      onClick={() => removeItem(idx)}
                      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                        isDark ? 'text-slate-600 hover:text-slate-400 hover:bg-white/8' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                      }`}
                      aria-label="Eliminar pendiente"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Transcripción ── */}
      {tab === 'transcripcion' && (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/8 bg-[#161820]' : 'border-slate-200 bg-white'}`}>
          {meeting.transcript ? (
            <>
              <div className={`flex items-center gap-2 px-4 py-3 border-b ${
                isDark ? 'border-white/8 bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'
              }`}>
                <Search size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                <input
                  value={transcriptSearch}
                  onChange={e => setTranscriptSearch(e.target.value)}
                  placeholder="Buscar en la transcripción…"
                  className={`flex-1 bg-transparent text-[13px] outline-none ${
                    isDark ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'
                  }`}
                />
                {transcriptSearch && (
                  <button
                    onClick={() => setTranscriptSearch('')}
                    className={`p-1 rounded transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div
                className={`px-5 py-4 overflow-y-auto text-[13px] leading-[1.75] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                style={{ maxHeight: '60vh' }}
              >
                {transcriptSearch
                  ? meeting.transcript
                      .split('\n')
                      .filter(l => l.toLowerCase().includes(transcriptSearch.toLowerCase()))
                      .map((l, i) => <p key={i} className="my-0.5 whitespace-pre-wrap">{l}</p>)
                  : <span className="whitespace-pre-wrap">{meeting.transcript}</span>
                }
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Mic2 size={22} className={`${isDark ? 'text-slate-500' : 'text-slate-400'} opacity-50`} />
              </div>
              <div>
                <p className={`text-[14px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Sin transcripción
                </p>
                <p className={`text-[12px] max-w-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {meeting.recordingUrl
                    ? 'Invita a Fireflies para transcribir la grabación automáticamente.'
                    : 'Esta reunión no tiene grabación ni transcripción disponible.'}
                </p>
              </div>
              {isAdmin && meeting.recordingUrl && (
                <button
                  onClick={handleInviteBot}
                  disabled={invitingBot}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-semibold transition-colors disabled:opacity-60 ${
                    isDark ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Mic2 size={13} /> {invitingBot ? 'Invitando…' : 'Invitar Fireflies Bot'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Delete confirm dialog ── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(false) }}
        >
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col gap-4 ${isDark ? 'bg-[#161820]' : 'bg-white'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-500" />
              </div>
              <div>
                <p className={`text-[15px] font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Eliminar reunión</p>
                <p className={`text-[12px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className={`text-[13px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Se eliminará permanentemente <span className="font-semibold">"{meeting.title}"</span> junto con su transcripción y pendientes.
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmDelete(false)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
                  isDark ? 'border-white/10 text-slate-300 hover:bg-white/8' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingMeeting}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deletingMeeting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
