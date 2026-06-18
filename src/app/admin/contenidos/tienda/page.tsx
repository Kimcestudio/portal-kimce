'use client'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { useHubTheme } from '@/cmhub/theme'

const PRODUCTOS = [
  { id:1, emoji:'☕', nombre:'Café gratis',           desc:'Un café pagado por el equipo',         precio:100,  stock:5  },
  { id:2, emoji:'🎬', nombre:'Día sin reuniones',      desc:'Un día libre de calls y stand-ups',    precio:500,  stock:2  },
  { id:3, emoji:'🎵', nombre:'Playlist a elección',    desc:'Vos elegís la música de la semana',    precio:150,  stock:10 },
  { id:4, emoji:'🏆', nombre:'Bonus mensual',           desc:'Bono extra de fin de mes',             precio:1000, stock:1  },
  { id:5, emoji:'🎮', nombre:'1h sin notificaciones',  desc:'Una hora en modo deep work',           precio:200,  stock:3  },
  { id:6, emoji:'📚', nombre:'Curso online',            desc:'Acceso a cualquier curso de elección', precio:750,  stock:2  },
]

export default function TiendaPage(){
  const { isDark } = useHubTheme()
  const[puntos,setPuntos]=useState(320)
  const[comprado,setComprado]=useState<number|null>(null)
  const[stocks,setStocks]=useState<Record<number,number>>(Object.fromEntries(PRODUCTOS.map(p=>[p.id,p.stock])))

  function canjear(p:typeof PRODUCTOS[0]){
    if(puntos<p.precio||stocks[p.id]===0)return
    setPuntos(pts=>pts-p.precio); setStocks(s=>({...s,[p.id]:s[p.id]-1})); setComprado(p.id)
    setTimeout(()=>setComprado(null),2500)
  }

  return(
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc] rounded-2xl">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center shrink-0 rounded-t-2xl">
        <div className="flex-1"><span className="text-[13px] text-[#9ca3af]">Dashboard</span><span className="text-[#d1d5db] mx-1.5">›</span><span className="text-[13px] font-semibold text-[#111827]">Tienda de Sala</span></div>
        <div className="flex items-center gap-2 bg-[#f5f3ff] border border-[#c4b5fd] px-4 py-2 rounded-xl">
          <Star size={14} className="text-[#7c3aed]"/>
          <span className="text-[14px] font-bold text-[#5b21b6]">{puntos}</span>
          <span className="text-[12px] text-[#9ca3af]">puntos de sala</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-5">
        <div><h1 className="text-[22px] font-bold text-[#111827]">🛍️ Tienda de Sala</h1><p className="text-[13px] text-[#9ca3af] mt-0.5">Canjeá tus puntos por premios del equipo</p></div>
        <div className="bg-[#f5f3ff] border border-[#c4b5fd] rounded-2xl p-4 flex items-start gap-3">
          <Star size={18} className="text-[#7c3aed] shrink-0 mt-0.5"/>
          <div>
            <p className="text-[13px] font-bold text-[#5b21b6] mb-1">¿Cómo ganar puntos?</p>
            <p className="text-[12px] text-[#6b7280] leading-relaxed">Completá publicaciones a tiempo <strong>+50pts</strong>, ganá en la Slot Machine, girá la Ruleta Semanal, o recibí puntos del administrador por buen trabajo.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {PRODUCTOS.map(p=>{
            const puedePagar=puntos>=p.precio,agotado=stocks[p.id]===0,esCanjeado=comprado===p.id
            return(
              <div key={p.id} className="bg-white rounded-2xl border transition-all hover:shadow-sm group"
                style={{borderColor:esCanjeado?(isDark?'rgba(34,197,94,0.35)':'#86efac'):(isDark?'rgba(255,255,255,0.07)':'#e5e7eb')}}>
                <div className="p-5 flex flex-col h-full">
                  <span className="text-4xl mb-3">{p.emoji}</span>
                  <p className="text-[14px] font-bold text-[#111827] mb-1">{p.nombre}</p>
                  <p className="text-[12px] text-[#6b7280] flex-1 mb-4 leading-relaxed">{p.desc}</p>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1"><Star size={13} className="text-[#7c3aed]"/><span className="text-[14px] font-bold text-[#5b21b6]">{p.precio}</span><span className="text-[11px] text-[#9ca3af]">pts</span></div>
                    <span className="text-[11px] text-[#9ca3af]">{agotado?'Agotado':`${stocks[p.id]} disp.`}</span>
                  </div>
                  <button onClick={()=>canjear(p)} disabled={!puedePagar||agotado}
                    className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:cursor-not-allowed cursor-pointer"
                    style={{
                      background: esCanjeado
                        ? (isDark ? 'rgba(34,197,94,0.15)' : '#dcfce7')
                        : puedePagar && !agotado
                          ? '#7c3aed'
                          : (isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'),
                      color: esCanjeado
                        ? (isDark ? '#4ade80' : '#16a34a')
                        : puedePagar && !agotado
                          ? 'white'
                          : (isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af'),
                    }}>
                    {esCanjeado?'✓ ¡Canjeado!':agotado?'Sin stock':!puedePagar?'Puntos insuficientes':'Canjear'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
