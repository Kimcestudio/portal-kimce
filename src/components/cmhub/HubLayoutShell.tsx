'use client'
import { X } from 'lucide-react'
import { useHubTheme } from '@/cmhub/theme'
import { useHub } from '@/cmhub/context'
import AttendanceReminderBanner from '@/components/attendance/AttendanceReminderBanner'

export default function HubLayoutShell({ children }: { children: React.ReactNode }) {
  const { isDark } = useHubTheme()
  const { viewAs, setViewAs } = useHub()

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col transition-colors duration-200"
      style={{ background: isDark ? '#09090b' : '#f1f3f6' }}
    >
      <AttendanceReminderBanner />
      {/* Banner "viendo como" */}
      {viewAs && (
        <div className="shrink-0 flex items-center justify-center gap-3 py-1.5 text-[12px] font-semibold"
          style={{ background: '#7c3aed', color: '#fff' }}>
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
            style={{ background: viewAs.color || '#4f46e5' }}>
            {viewAs.initials}
          </div>
          Viendo como {viewAs.name}
          <span className="opacity-60 font-normal">· {viewAs.position ?? viewAs.category}</span>
          <button
            onClick={() => setViewAs(null)}
            className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-[11px]"
          >
            <X size={11} /> Salir
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        {children}
      </div>
    </div>
  )
}
