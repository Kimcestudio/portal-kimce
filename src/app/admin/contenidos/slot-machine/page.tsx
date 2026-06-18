'use client'
import { useState } from 'react'

const PREMIOS = [
  { emoji:'🎬', label:'Día sin reuniones',        puntos:500  },
  { emoji:'☕', label:'Café pagado por el equipo', puntos:50   },
  { emoji:'🏆', label:'Bonus del mes',             puntos:1000 },
  { emoji:'🎵', label:'Playlist a elección',       puntos:100  },
  { emoji:'💸', label:'Bono extra',                puntos:750  },
  { emoji:'🎮', label:'1h sin notificaciones',     puntos:200  },
  { emoji:'❌', label:'Sin premio esta vez',        puntos:0    },
  { emoji:'⭐', label:'+50 puntos de sala',         puntos:50   },
]

export default function SlotMachinePage() {
  const [carrete, setCarrete]   = useState([PREMIOS[0], PREMIOS[1], PREMIOS[2]])
  const [girando, setGirando]   = useState(false)
  const [resultado, setResultado] = useState<{ texto:string; jackpot:boolean }|null>(null)
  const [fichas, setFichas]     = useState(10)
  const [historial, setHistorial] = useState<string[]>([])

  function girar() {
    if (girando || fichas<=0) return
    setFichas(f=>f-1); setGirando(true); setResultado(null)
    let ticks=0
    const iv=setInterval(()=>{
      setCarrete([PREMIOS[Math.floor(Math.random()*PREMIOS.length)],PREMIOS[Math.floor(Math.random()*PREMIOS.length)],PREMIOS[Math.floor(Math.random()*PREMIOS.length)]])
      if(++ticks>14){
        clearInterval(iv)
        const final=[PREMIOS[Math.floor(Math.random()*PREMIOS.length)],PREMIOS[Math.floor(Math.random()*PREMIOS.length)],PREMIOS[Math.floor(Math.random()*PREMIOS.length)]]
        setCarrete(final); setGirando(false)
        const jackpot=final[0].label===final[1].label&&final[1].label===final[2].label
        const texto=jackpot?`🎉 ¡JACKPOT! ${final[0].label}`:final.map(p=>p.emoji).join('  ')
        setResultado({texto,jackpot}); setHistorial(h=>[texto,...h].slice(0,8))
      }
    },75)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc] rounded-2xl">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center shrink-0 rounded-t-2xl">
        <div className="flex-1"><span className="text-[13px] text-[#9ca3af]">Dashboard</span><span className="text-[#d1d5db] mx-1.5">›</span><span className="text-[13px] font-semibold text-[#111827]">Slot Machine</span></div>
        <span className="text-[12px] font-semibold text-[#7c3aed] bg-[#f5f3ff] px-3 py-1 rounded-full">🎟️ {fichas} fichas</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <div><h1 className="text-[22px] font-bold text-[#111827]">🎰 Slot Machine</h1><p className="text-[13px] text-[#9ca3af] mt-0.5">Usá tus fichas para ganar premios del equipo</p></div>
          <div className="bg-white rounded-2xl border-2 border-[#7c3aed]/20 p-8 shadow-sm">
            <div className="flex gap-4 justify-center mb-6">
              {carrete.map((p,i)=>(
                <div key={i} className="w-32 h-32 rounded-2xl border-2 border-[#e5e7eb] flex flex-col items-center justify-center gap-1.5 bg-[#f9fafb]" style={{transition:girando?'none':'all 0.3s'}}>
                  <span className="text-5xl">{p.emoji}</span>
                  <span className="text-[10px] text-[#9ca3af] text-center px-2 leading-tight">{p.label}</span>
                </div>
              ))}
            </div>
            <button onClick={girar} disabled={girando||fichas<=0}
              className="w-full py-3.5 rounded-xl text-white text-[15px] font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
              style={{background:girando?'#d1d5db':'linear-gradient(135deg,#7c3aed,#4f46e5)'}}>
              {girando?'Girando...':fichas<=0?'Sin fichas':'🎰  GIRAR  (-1 ficha)'}
            </button>
            {resultado&&<div className={`mt-4 py-3 px-5 rounded-xl text-[13px] font-semibold text-center ${resultado.jackpot?'bg-[#dcfce7] border border-[#86efac] text-[#16a34a]':'bg-[#f3f4f6] border border-[#e5e7eb] text-[#4b5563]'}`}>{resultado.texto}</div>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]"><span className="text-[13px] font-bold text-[#111827]">Premios disponibles</span></div>
              {PREMIOS.filter(p=>p.puntos>0).map(p=>(
                <div key={p.label} className="flex items-center gap-3 px-5 py-3 border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa]">
                  <span className="text-xl">{p.emoji}</span><span className="flex-1 text-[13px] text-[#4b5563]">{p.label}</span>
                  <span className="text-[12px] font-bold text-[#7c3aed] bg-[#f5f3ff] px-2 py-0.5 rounded-full">+{p.puntos}pts</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f3f4f6]"><span className="text-[13px] font-bold text-[#111827]">Últimas tiradas</span></div>
              {historial.length===0?<div className="py-10 text-center text-[13px] text-[#9ca3af]">Aún sin tiradas</div>:historial.map((h,i)=>(
                <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-[#f3f4f6] last:border-0">
                  <span className="text-[12px] text-[#4b5563] flex-1">{h}</span>
                  {i===0&&<span className="text-[10px] text-[#7c3aed] font-semibold bg-[#f5f3ff] px-2 py-0.5 rounded-full">último</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
