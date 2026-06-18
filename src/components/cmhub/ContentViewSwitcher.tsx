'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, CalendarDays, AlignLeft, LayoutGrid } from 'lucide-react'
import { useHubBase } from '@/cmhub/useHubBase'

const VIEWS = [
  { key: 'calendario',   label: 'Mensual',  Icon: Calendar,     suffix: '/calendario'   },
  { key: 'semana',       label: 'Semana',   Icon: CalendarDays, suffix: '/semana'        },
  { key: 'publicaciones',label: 'Lista',    Icon: AlignLeft,    suffix: '/publicaciones' },
  { key: 'kanban',       label: 'Kanban',   Icon: LayoutGrid,   suffix: '/kanban'        },
]

export default function ContentViewSwitcher() {
  const base = useHubBase()
  const pathname = usePathname()

  return (
    <div className="flex border border-[#e5e7eb] rounded-xl overflow-hidden shrink-0">
      {VIEWS.map(({ key, label, Icon, suffix }) => {
        const active = pathname.endsWith(key) || pathname.endsWith(key + '/')
        return (
          <Link
            key={key}
            href={`${base}${suffix}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors
              ${active ? 'bg-[#7c3aed] text-white font-semibold' : 'text-[#6b7280] hover:bg-[#f9fafb]'}`}
          >
            <Icon size={12} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
