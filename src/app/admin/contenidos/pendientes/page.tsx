'use client'
import { useHub } from '@/cmhub/context'
import { useHubMeta } from '@/cmhub/theme'
import { STATUS_META, PRIORITY_META } from '@/cmhub/data'
import { Clock, AlertCircle } from 'lucide-react'

const PENDIENTE_STATES = ['idea', 'produccion', 'revision', 'cambios', 'enviado', 'redaccion', 'diseno', 'audiovisual']

export default function PendientesPage() {
  const { contents, getBrandById } = useHub()
  const { STATUS_META, PRIORITY_META } = useHubMeta()
  const smeta = STATUS_META as Record<string, { label: string; bg: string; text: string; dot: string }>

  const pendientes = contents.filter(c => PENDIENTE_STATES.includes(c.status))

  const porEstado = PENDIENTE_STATES.map(s => ({
    estado: s, meta: smeta[s],
    items: pendientes.filter(c => c.status === s),
  })).filter(g => g.items.length > 0 && g.meta)

  const urgentes = pendientes.filter(c => c.priority === 'urgente' || c.priority === 'alta')
  const vencidos = pendientes.filter(c => c.date && new Date(c.date) < new Date())


  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc] rounded-2xl">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center shrink-0 rounded-t-2xl">
        <div className="flex-1">
          <span className="text-[13px] text-[#9ca3af]">Dashboard</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">Pendientes</span>
        </div>
        <span className="text-[12px] font-bold text-white bg-[#7c3aed] px-3 py-1 rounded-full">{pendientes.length} pendientes</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Pendientes</h1>
          <p className="text-[13px] text-[#9ca3af] mt-0.5">Contenidos que requieren acción del equipo</p>
        </div>

        {(urgentes.length > 0 || vencidos.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {urgentes.length > 0 && (
              <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-[#d97706] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-bold text-[#92400e]">{urgentes.length} de alta prioridad</p>
                  <p className="text-[12px] text-[#d97706] mt-0.5">Requieren atención urgente</p>
                </div>
              </div>
            )}
            {vencidos.length > 0 && (
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-4 flex items-start gap-3">
                <Clock size={18} className="text-[#dc2626] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-bold text-[#7f1d1d]">{vencidos.length} con fecha vencida</p>
                  <p className="text-[12px] text-[#dc2626] mt-0.5">La fecha de publicación ya pasó</p>
                </div>
              </div>
            )}
          </div>
        )}

        {porEstado.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e5e7eb] p-12 text-center">
            <div className="text-3xl mb-3">🎉</div>
            <p className="text-[15px] font-bold text-[#111827]">¡Todo al día!</p>
            <p className="text-[13px] text-[#9ca3af] mt-1">No hay contenidos pendientes de acción</p>
          </div>
        ) : (
          porEstado.map(({ estado, meta, items }) => (
            <div key={estado} className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6] flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.dot }} />
                <span className="text-[15px] font-bold text-[#111827]">{meta.label}</span>
                <span className="text-[12px] bg-[#f3f4f6] text-[#6b7280] px-2.5 py-0.5 rounded-full font-medium ml-auto">{items.length}</span>
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#f9fafb]">
                    {['Cliente', 'Título', 'Canal', 'Prioridad', 'Fecha', 'Responsable'].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-[#6b7280] uppercase tracking-wide border-b border-[#f3f4f6]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(c => {
                    const brand = getBrandById(c.brandId)
                    const isVencido = c.date && new Date(c.date) < new Date()
                    const ps = PRIORITY_META[c.priority] ?? PRIORITY_META.baja
                    return (
                      <tr key={c.id} className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ background: brand?.color ?? '#7c3aed' }}>{brand?.initials}</div>
                            <span className="text-[#4b5563]">{brand?.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-medium text-[#111827]">{c.title}</td>
                        <td className="px-5 py-3 text-[#6b7280] capitalize">{c.channel}</td>
                        <td className="px-5 py-3">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: ps.bg, color: ps.text }}>{c.priority}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[12px] font-medium font-mono ${isVencido ? 'text-red-500 font-bold' : 'text-[#6b7280]'}`}>
                            {c.date ?? '—'}{isVencido ? ' ⚠' : ''}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#6b7280]">{c.responsible}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
