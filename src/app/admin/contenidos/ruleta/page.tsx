'use client'
import { useState } from 'react'
import { useHub } from '@/cmhub/context'

function polarToXY(cx:number,cy:number,r:number,angleDeg:number){
  const rad=((angleDeg-90)*Math.PI)/180
  return{x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)}
}

export default function RuletaPage(){
  const{team}=useHub()
  const OPCIONES=[
    ...team.map(m=>({label:m.name,color:m.color})),
    {label:'Tarea extra',color:'#f97316'},{label:'Descanso libre',color:'#22c55e'},{label:'Bonus sorpresa',color:'#eab308'},
  ].slice(0,8)

  const[angulo,setAngulo]=useState(0)
  const[girando,setGirando]=useState(false)
  const[ganador,setGanador]=useState<string|null>(null)
  const[historial,setHistorial]=useState<Array<{label:string;color:string}>>([])

  function girar(){
    if(girando)return; setGirando(true); setGanador(null)
    const nuevo=angulo+(5+Math.floor(Math.random()*5))*360+Math.floor(Math.random()*360)
    setAngulo(nuevo)
    setTimeout(()=>{
      const angFinal=nuevo%360,sector=360/OPCIONES.length
      const idx=Math.floor(((360-angFinal+sector/2)%360)/sector)%OPCIONES.length
      const op=OPCIONES[idx]
      setGanador(op.label); setHistorial(h=>[op,...h].slice(0,6)); setGirando(false)
    },4000)
  }

  const sector=360/OPCIONES.length

  return(
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc] rounded-2xl">
      <div className="bg-white border-b border-[#e5e7eb] px-6 h-14 flex items-center shrink-0 rounded-t-2xl">
        <div className="flex-1"><span className="text-[13px] text-[#9ca3af]">Dashboard</span><span className="text-[#d1d5db] mx-1.5">›</span><span className="text-[13px] font-semibold text-[#111827]">Ruleta Semanal</span></div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <div><h1 className="text-[22px] font-bold text-[#111827]">🎡 Ruleta Semanal</h1><p className="text-[13px] text-[#9ca3af] mt-0.5">Girá para asignar tareas o premios al equipo de forma aleatoria</p></div>
          <div className="flex gap-6 items-start">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 z-10 text-2xl drop-shadow-md">▼</div>
                <svg width="300" height="300" style={{transform:`rotate(${angulo}deg)`,transition:girando?'transform 4s cubic-bezier(0.17,0.67,0.21,1)':'none',borderRadius:'50%',filter:'drop-shadow(0 4px 16px rgba(124,58,237,0.20))'}}>
                  {OPCIONES.map((op,i)=>{
                    const start=polarToXY(150,150,140,i*sector),end=polarToXY(150,150,140,(i+1)*sector),mid=polarToXY(150,150,95,i*sector+sector/2),large=sector>180?1:0
                    return(<g key={i}><path d={`M 150 150 L ${start.x} ${start.y} A 140 140 0 ${large} 1 ${end.x} ${end.y} Z`} fill={op.color} stroke="white" strokeWidth="2"/><text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="700" style={{pointerEvents:'none'}}>{op.label.split(' ')[0]}</text></g>)
                  })}
                  <circle cx="150" cy="150" r="20" fill="white" stroke="#e5e7eb" strokeWidth="2"/><circle cx="150" cy="150" r="8" fill="#7c3aed"/>
                </svg>
              </div>
              <button onClick={girar} disabled={girando}
                className="px-10 py-3 rounded-xl text-white text-[15px] font-bold transition-all disabled:opacity-40 shadow-sm cursor-pointer"
                style={{background:'linear-gradient(135deg,#7c3aed,#4f46e5)'}}>
                {girando?'Girando...':'🎡 GIRAR'}
              </button>
              {ganador&&<div className="text-center py-3 px-8 rounded-xl bg-[#f5f3ff] border border-[#c4b5fd] text-[#5b21b6] font-bold text-[15px]">🎉 {ganador}</div>}
            </div>
            <div className="flex-1 flex flex-col gap-4">
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#f3f4f6]"><span className="text-[13px] font-bold text-[#111827]">Opciones en la ruleta</span></div>
                {OPCIONES.map((op,i)=>(
                  <div key={i} className="flex items-center gap-3 px-5 py-2.5 border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa]">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{background:op.color}}/><span className="text-[13px] text-[#4b5563]">{op.label}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#f3f4f6]"><span className="text-[13px] font-bold text-[#111827]">Historial</span></div>
                {historial.length===0?<div className="py-8 text-center text-[13px] text-[#9ca3af]">Sin tiradas aún</div>:historial.map((h,i)=>(
                  <div key={i} className="flex items-center gap-3 px-5 py-2.5 border-b border-[#f3f4f6] last:border-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:h.color}}/><span className="text-[13px] text-[#4b5563] flex-1">{h.label}</span>
                    {i===0&&<span className="text-[10px] text-[#7c3aed] font-semibold bg-[#f5f3ff] px-2 py-0.5 rounded-full">último</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
