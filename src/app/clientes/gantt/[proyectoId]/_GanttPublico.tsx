'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Proyecto } from '@/cmhub/types'
import GanttChart from '@/components/cmhub/GanttChart'
import { projectProgress, type Task } from '@/cmhub/projects/domain'
export default function GanttPublico() {
  const pathname=usePathname(), [data,setData]=useState<{project:Proyecto;brandName:string;updatedAt:string}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0)
  useEffect(()=>{const controller=new AbortController();const token=window.location.pathname.split('/').filter(Boolean).pop();setLoading(true);setError('');setData(null);fetch(`/api/projects/gantt?token=${encodeURIComponent(token||'')}`,{signal:controller.signal,cache:'no-store'}).then(async res=>{const value=await res.json();if(!res.ok)throw new Error(value.error||'Enlace no disponible');setData(value)}).catch(e=>{if(e.name!=='AbortError')setError(e.message||'No se pudo cargar el cronograma.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[pathname,reload])
  return <main className="project-work pw-shell" style={{minHeight:'100vh',maxWidth:1600,margin:'0 auto'}}>{loading?<p role="status">Cargando cronograma…</p>:error||!data?<div className="pw-empty"><h1>Cronograma no disponible</h1><p role="alert">{error}</p><p>El enlace puede haber sido revocado. Solicita uno nuevo al equipo.</p><button className="pw-button" onClick={()=>setReload(n=>n+1)}>Reintentar</button></div>:<><header className="pw-heading"><div><p className="pw-muted">{data.brandName} · KIMCE Studio</p><h1>{data.project.nombre}</h1><p className="pw-muted">{projectProgress(data.project.ganttTareas as Task[])}% completado · Vista de consulta</p></div><button className="pw-button" onClick={()=>setReload(n=>n+1)}>Actualizar</button></header><GanttChart proyecto={data.project} brandName={data.brandName} isDark={false} color="#6d28d9" readOnly canPlan={false}/></>}</main>
}
