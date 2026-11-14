'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Users, Clock, CheckCircle2, AlertCircle, Loader } from 'lucide-react'
import { useHubTheme } from '@/cmhub/theme'
import { useAuth }     from '@/components/auth/AuthProvider'
import { useHubBase }  from '@/cmhub/useHubBase'
import {
  subscribeMeeting, createTasksFromMeeting,
  formatDuration, platformLabel, platformColor,
  type HubReunion, type MeetingActionItem,
} from '@/services/meetings'

export default function MiReuniónDetallePage() {
  const params  = useParams()
  const router  = useRouter()
  const base    = useHubBase()
  const { isDark }              = useHubTheme()
  const { authUser, profile }   = useAuth()

  const uid         = authUser?.uid ?? ''
  const displayName = (profile as { displayName?: string } | null)?.displayName ?? ''
  const firstName   = displayName.split(' ')[0].toLowerCase()

  const id = typeof window !== 'undefined'
    ? window.location.pathname.split('/').filter(Boolean).pop() ?? ''
    : String(params?.id ?? '')
  const [meeting, setMeeting] = useState<HubReunion | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'resumen' | 'pendientes'>('resumen')
  const [busy, setBusy]       = useState(false)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')

  useEffect(() => {
    if (!id || !uid) return
    return subscribeMeeting(id, m => { setMeeting(m); setLoading(false) })
  }, [id, uid])

  const T = isDark
    ? { bg: '#0d0f12', card: '#161820', border: 'rgba(255,255,255,0.08)', text: '#f1f5f9', sub: '#94a3b8', input: '#1e2027' }
    : { bg: '#f8fafc', card: '#ffffff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', input: '#f8fafc' }

  const myItems: MeetingActionItem[] = meeting?.actionItems.filter(a =>
    a.assignee && firstName && a.assignee.toLowerCase().includes(firstName)
  ) ?? []
  const myPending = myItems.filter(a => !a.done)
  const myDone    = myItems.filter(a => a.done)

  async function createMyTasks() {
    if (!meeting || !myPending.length) return
    setBusy(true); setErr(''); setMsg('')
    try {
      const enriched = myPending.map(item => ({
        ...item,
        assigneeUid:  uid,
        assigneeIds:  uid ? [uid] : [],
      }))
      const { created } = await createTasksFromMeeting(meeting.id, enriched)
      setMsg(`${created} tarea${created !== 1 ? 's' : ''} creada${created !== 1 ? 's' : ''} en tus Actividades.`)
      setTimeout(() => setMsg(''), 4000)
    } catch (e) {
      setErr((e as { message?: string })?.message ?? 'Error al crear tareas.')
    } finally { setBusy(false) }
  }

  if (loading) return <div style={{ padding: 32, color: T.sub, fontSize: 13 }}>Cargando reunión…</div>
  if (!meeting) return (
    <div style={{ padding: 32 }}>
      <p style={{ color: T.sub, fontSize: 13 }}>Reunión no encontrada o no tienes acceso.</p>
      <button onClick={() => router.back()} style={{ marginTop: 12, fontSize: 13, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer' }}>
        Volver
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: T.bg }}>

      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: '14px 20px', flexShrink: 0 }}>
        <button onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.sub, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, padding: 0 }}>
          <ArrowLeft size={14} /> Volver
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>{meeting.title}</h1>
              <span className={platformColor(meeting.platform)} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {platformLabel(meeting.platform)}
              </span>
              {myPending.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: 'rgba(217,119,6,0.1)', padding: '2px 8px', borderRadius: 20 }}>
                  {myPending.length} pendiente{myPending.length !== 1 ? 's' : ''} tuyo{myPending.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: T.sub, margin: '4px 0 0' }}>
              {meeting.date}{meeting.time ? ` · ${meeting.time}` : ''}
              {meeting.duration ? ` · ${formatDuration(meeting.duration)}` : ''}
            </p>
          </div>
          {meeting.recordingUrl && (
            <a href={meeting.recordingUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '6px 12px', textDecoration: 'none', fontWeight: 600 }}>
              <ExternalLink size={12} /> Ver grabación
            </a>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
          {(['resumen', 'pendientes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                background: tab === t ? '#f5f3ff' : 'transparent',
                color: tab === t ? '#7c3aed' : T.sub,
              }}>
              {t === 'resumen' ? 'Resumen' : `Mis pendientes${myPending.length > 0 ? ` (${myPending.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 48px' }}>

        {tab === 'resumen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
            {meeting.participants.length > 0 && (
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
                  <Users size={11} style={{ display: 'inline', marginRight: 4 }} />Participantes
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {meeting.participants.map((p, i) => (
                    <span key={i} style={{ fontSize: 12, color: T.text, background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', padding: '4px 10px', borderRadius: 20 }}>
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {meeting.summary ? (
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Resumen</p>
                <p style={{ fontSize: 13, color: T.text, lineHeight: 1.7, margin: 0 }}>{meeting.summary}</p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: T.sub }}>Sin resumen disponible.</p>
            )}
          </div>
        )}

        {tab === 'pendientes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
            {myItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: T.sub }}>
                <CheckCircle2 size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <p style={{ fontWeight: 600, color: T.text }}>Sin pendientes asignados</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>No se detectaron tareas para ti en esta reunión.</p>
              </div>
            ) : (
              <>
                {myPending.length > 0 && (
                  <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                        <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />Pendientes ({myPending.length})
                      </p>
                    </div>
                    {myPending.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d97706', marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: T.text, margin: 0, lineHeight: 1.5 }}>{item.text}</p>
                          {item.dueDate && <p style={{ fontSize: 11, color: T.sub, margin: '2px 0 0' }}>Fecha límite: {item.dueDate}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {myDone.length > 0 && (
                  <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                        <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 4 }} />Convertidos en tarea ({myDone.length})
                      </p>
                    </div>
                    {myDone.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, opacity: 0.6 }}>
                        <CheckCircle2 size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                        <p style={{ fontSize: 13, color: T.text, margin: 0, textDecoration: 'line-through' }}>{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {myPending.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button onClick={createMyTasks} disabled={busy}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#7c3aed', color: '#fff', border: 'none',
                        borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700,
                        cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                      }}>
                      {busy ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                      Convertir mis {myPending.length} pendiente{myPending.length !== 1 ? 's' : ''} en tareas
                    </button>
                    {msg && <span style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> {msg}</span>}
                    {err && <span style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={13} /> {err}</span>}
                  </div>
                )}

                {myPending.length === 0 && myDone.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#16a34a' }}>
                    <CheckCircle2 size={15} /> Todos tus pendientes ya fueron convertidos en tareas.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
