'use client'
import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { SALA_LABELS, type SalasConfig } from '@/services/presence'
import { Users } from 'lucide-react'

interface SalaAlert {
  id: string
  name: string
  initials: string
  salaLabel: string
  color: string
}

const COLORS = ['#7c3aed','#2563eb','#16a34a','#d97706','#dc2626','#0891b2']
function colorFor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return COLORS[h % COLORS.length]
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [880, 1108, 1320]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.start(t); osc.stop(t + 0.4)
    })
  } catch { /* no audio context in SSR/tests */ }
}

export default function SalaAlertProvider({ children }: { children: React.ReactNode }) {
  const auth    = useOptionalAuth()
  const myUid   = auth?.authUser?.uid ?? null
  const prevMap = useRef<Record<string, string | null>>({})
  const [alerts, setAlerts] = useState<SalaAlert[]>([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'userDirectory'), snap => {
      const newAlerts: SalaAlert[] = []

      snap.docs.forEach(d => {
        const uid  = d.id
        const data = d.data()
        const sala = (data.currentSala as string | null) ?? null

        if (uid === myUid) { prevMap.current[uid] = sala; return }

        const prev = prevMap.current[uid] ?? null
        // Trigger only when ENTERING a sala (null/undefined → salaKey)
        if (sala && sala !== prev) {
          const name  = data.displayName || data.name || 'Alguien'
          const label = SALA_LABELS[sala as keyof SalasConfig] ?? sala
          newAlerts.push({
            id:        `${uid}-${Date.now()}`,
            name,
            initials:  name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
            salaLabel: label,
            color:     colorFor(name),
          })
        }
        prevMap.current[uid] = sala
      })

      if (newAlerts.length) {
        playChime()
        setAlerts(prev => [...prev, ...newAlerts])
        newAlerts.forEach(a => {
          setTimeout(() => setAlerts(p => p.filter(x => x.id !== a.id)), 5000)
        })
      }
    })
    return unsub
  }, [myUid])

  return (
    <>
      {children}
      {/* Toast stack — bottom right */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end',
        pointerEvents: 'none',
      }}>
        {alerts.map(a => (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 14, padding: '10px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            animation: 'slideIn 0.25s ease',
            pointerEvents: 'auto',
            minWidth: 220, maxWidth: 300,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: a.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>{a.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>{a.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={10} style={{ display: 'inline' }} /> {a.salaLabel}
              </p>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '2px 6px', borderRadius: 20, flexShrink: 0 }}>EN SALA</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
