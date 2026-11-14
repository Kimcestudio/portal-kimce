'use client'
import { useState } from 'react'
import { Zap, X, ChevronDown } from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubTheme } from '@/cmhub/theme'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { usePointsActions } from '@/cmhub/usePointsActions'
import { botMsg } from '@/cmhub/points'

interface Props { onClose: () => void }

export default function QuickAssignModal({ onClose }: Props) {
  const { team, addTareaD } = useHub()
  const { isDark } = useHubTheme()
  const auth = useOptionalAuth()
  const { postBotSala } = usePointsActions()

  const myName = (auth?.profile as { displayName?: string } | null)?.displayName ?? ''

  const [texto,    setTexto]    = useState('')
  const [assignee, setAssignee] = useState(myName)
  const [fecha,    setFecha]    = useState('')
  const [saving,   setSaving]   = useState(false)

  const bg     = isDark ? '#161820' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const text   = isDark ? '#f1f5f9' : '#111827'
  const sub    = isDark ? '#94a3b8' : '#6b7280'
  const input  = isDark ? '#1e2028' : '#f9fafb'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() || !assignee) return
    setSaving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await addTareaD({
        texto:     texto.trim(),
        hecha:     false,
        editor:    assignee,
        prioridad: 'media',
        fecha:     today,
        tipo:      'interno',
        source:    'quick',
        ...(fecha ? { fechaLimite: fecha } : {}),
      })
      // Mensaje en La Sala solo si se asigna a otra persona
      if (assignee !== myName && myName) {
        await postBotSala(botMsg('quick_assign', {
          quien:   myName,
          titulo:  texto.trim(),
          destino: assignee,
        }))
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Todos los miembros del equipo (incluyendo al usuario actual)
  const allNames = Array.from(new Set([
    myName,
    ...team.map(m => m.name),
  ])).filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-end p-6"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-2xl shadow-2xl border overflow-hidden"
        style={{ background: bg, borderColor: border }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: border }}>
          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(124,58,237,0.12)' }}>
            <Zap size={13} style={{ color: '#7c3aed' }} />
          </div>
          <span className="text-[13px] font-bold flex-1" style={{ color: text }}>
            Asignación rápida
          </span>
          <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: sub }}>
            <X size={13} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: sub }}>
              ¿Qué hay que hacer?
            </label>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Describe la tarea..."
              rows={2}
              autoFocus
              className="w-full px-3 py-2 text-[13px] rounded-xl border resize-none focus:outline-none transition-colors"
              style={{ background: input, borderColor: border, color: text }}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: sub }}>
              ¿Quién lo hace?
            </label>
            <div className="relative">
              <select
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                className="w-full px-3 py-2 text-[13px] rounded-xl border appearance-none cursor-pointer focus:outline-none"
                style={{ background: input, borderColor: border, color: text }}
              >
                {allNames.map(n => (
                  <option key={n} value={n}>{n}{n === myName ? ' (yo)' : ''}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: sub }} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: sub }}>
              ¿Para cuándo? <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span>
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 text-[13px] rounded-xl border focus:outline-none"
              style={{ background: input, borderColor: border, color: text }}
            />
          </div>

          <button
            type="submit"
            disabled={!texto.trim() || saving}
            className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-40 cursor-pointer mt-1"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            {saving ? 'Asignando…' : `Asignar${assignee !== myName ? ` a ${assignee.split(' ')[0]}` : 'me'}`}
          </button>
        </form>
      </div>
    </div>
  )
}
