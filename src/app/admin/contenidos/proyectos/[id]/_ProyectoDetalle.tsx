'use client'
import { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { useHubTheme } from '@/cmhub/theme'
import ProjectWorkspace from '@/components/cmhub/projects/ProjectWorkspace'
import '@/components/cmhub/projects/projects.css'
export default function ProyectoDetalle() {
  const params=useParams(), pathname=usePathname(), router=useRouter(), base=useHubBase(), {isDark}=useHubTheme()
  const {proyectos,archivedProyectos,loadingProyectos,proyectosError}=useHub()
  const [browserPath,setBrowserPath]=useState('')
  useEffect(()=>setBrowserPath(window.location.pathname),[pathname])
  const id = (browserPath||pathname).split('/').filter(Boolean).pop() || String(params?.id||'')
  const project=proyectos.find(p=>p.id===id)??archivedProyectos.find(p=>p.id===id)
  if(loadingProyectos||proyectosError||!project)return <div className="project-work pw-shell" data-dark={isDark}><p role={proyectosError?'alert':'status'}>{loadingProyectos?'Cargando proyecto…':proyectosError||'Proyecto no encontrado.'}</p><button className="pw-button" onClick={()=>router.push(`${base}/proyectos`)}>Volver a proyectos</button>{proyectosError&&<button className="pw-button" onClick={()=>window.location.reload()}>Reintentar</button>}</div>
  return <ProjectWorkspace key={id} project={project} isDark={isDark}/>
}
