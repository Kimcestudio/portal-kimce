'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Megaphone } from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useOptionalAuth } from '@/components/auth/AuthProvider'

export default function SalaPage() {
  const { mensajesSala, sendMensajeSala, team } = useHub()
  const auth = useOptionalAuth()
  const authUser = auth?.authUser
  const profile  = auth?.profile ?? auth?.user
  const myName   = profile?.displayName ?? authUser?.email ?? 'Yo'

  const yo = team.find(m => m.email === authUser?.email)
    ?? { name: myName, initials: myName.slice(0,2).toUpperCase(), color: '#7c3aed', email: '' }

  const [texto, setTexto] = useState('')
  const [tipo, setTipo]   = useState<'mensaje' | 'anuncio'>('mensaje')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [mensajesSala])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    await sendMensajeSala({
      autor: yo.name, autorInitials: yo.initials,
      autorColor: yo.color, texto: texto.trim(), tipo,
    })
    setTexto('')
    setTipo('mensaje')
  }

  const formatHora = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' }) }
    catch { return '' }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc] rounded-2xl">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center gap-3 shrink-0 rounded-t-2xl">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[13px] text-[#9ca3af]">Dashboard</span>
          <span className="text-[#d1d5db] mx-1.5">›</span>
          <span className="text-[13px] font-semibold text-[#111827]">La Sala</span>
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-[12px] text-[#9ca3af]">General — {team.length} miembros</span>
        </div>
        <span className="text-[12px] font-medium text-[#9ca3af] bg-[#f3f4f6] px-3 py-1 rounded-full">
          {mensajesSala.length} mensajes
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div ref={listRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            {mensajesSala.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                <div className="text-3xl mb-3">💬</div>
                <p className="text-[15px] font-bold text-[#111827]">La Sala está vacía</p>
                <p className="text-[13px] text-[#9ca3af] mt-1">Enviá el primer mensaje al equipo</p>
              </div>
            )}
            {mensajesSala.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.tipo==='anuncio' ? 'bg-[#fef9c3] rounded-2xl p-4 border border-[#fde68a]' : ''}`}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5"
                  style={{ background: m.autorColor }}>
                  {m.autorInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-[#111827]">{m.autor}</span>
                    <span className="text-[11px] text-[#9ca3af]">{formatHora(m.createdAt)}</span>
                    {m.tipo==='anuncio' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#d97706] bg-[#fef3c7] px-2 py-0.5 rounded-full">
                        <Megaphone size={9} /> ANUNCIO
                      </span>
                    )}
                  </div>
                  <div className={`text-[13px] rounded-2xl px-3.5 py-2.5 inline-block max-w-full break-words ${
                    m.tipo==='anuncio' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-white border border-[#e5e7eb] text-[#111827]'
                  }`}>
                    {m.texto}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border-t border-[#e5e7eb] p-4 shrink-0">
            <form onSubmit={enviar} className="flex gap-2 items-center">
              {tipo==='anuncio' && (
                <span className="text-[11px] text-[#d97706] font-semibold shrink-0 flex items-center gap-1">
                  <Megaphone size={11}/> Anuncio
                </span>
              )}
              <input value={texto} onChange={e=>setTexto(e.target.value)}
                placeholder={tipo==='anuncio' ? '📢 Escribí el anuncio...' : 'Escribí un mensaje...'}
                className="flex-1 px-3.5 py-2.5 text-[13px] rounded-xl border border-[#e5e7eb] focus:outline-none focus:border-[#7c3aed] transition-colors" />
              <button type="button" onClick={() => setTipo(t=>t==='mensaje'?'anuncio':'mensaje')}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                  tipo==='anuncio'
                    ? 'bg-[#fef3c7] text-[#d97706] border border-[#fde68a]'
                    : 'border border-[#e5e7eb] text-[#9ca3af] hover:bg-[#f9fafb]'
                }`} title="Cambiar a anuncio">
                <Megaphone size={15} />
              </button>
              <button type="submit"
                className="w-10 h-10 rounded-xl bg-[#7c3aed] hover:bg-[#5b21b6] flex items-center justify-center text-white transition-colors shadow-sm cursor-pointer">
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>

        {/* Panel lateral — miembros agrupados por categoría */}
        <div className="w-52 bg-white border-l border-[#e5e7eb] flex flex-col shrink-0 rounded-br-2xl">
          <div className="px-4 py-3.5 border-b border-[#f3f4f6]">
            <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest">EQUIPO — {team.length}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto py-1">
            {(() => {
              const ORDER = ['Estrategia', 'Diseño', 'Audiovisual', 'Otro']
              const grouped: Record<string, typeof team> = {}
              team.forEach(m => {
                const key = m.category ?? 'Otro'
                if (!grouped[key]) grouped[key] = []
                grouped[key].push(m)
              })
              const keys = ORDER.filter(k => grouped[k]?.length)
              return keys.map(cat => (
                <div key={cat}>
                  <p className="px-4 pt-3 pb-1 text-[9px] font-bold text-[#9ca3af] uppercase tracking-[0.1em]">
                    {cat}
                  </p>
                  {grouped[cat].map(m => (
                    <div key={m.id} className="flex items-center gap-2.5 px-4 py-2 hover:bg-[#f9fafb] transition-colors">
                      <div className="relative shrink-0">
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: m.color }}>{m.initials}</div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${m.status === 'active' ? 'bg-green-400' : 'bg-amber-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-[#111827] truncate">{m.name}</p>
                        <p className="text-[10px] text-[#9ca3af] truncate">{m.position ?? m.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
