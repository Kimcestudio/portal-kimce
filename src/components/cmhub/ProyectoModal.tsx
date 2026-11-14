'use client'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Proyecto, Brand, TeamMember } from '@/cmhub/types'
import ProjectWorkspace from './projects/ProjectWorkspace'
export interface ModalActivity { id:string; title:string; status:'pendiente'|'en_curso'|'completado'; dueDate?:string; assignee?:string; assignees?:string[]; category?:string }
interface Props {
  proyecto:Proyecto; activities:ModalActivity[]; brands:Brand[]; team?:TeamMember[]; isDark:boolean; currentUser?:string;
  onClose:()=>void; onOpenActivity:(a:ModalActivity)=>void; onNewActivity:()=>void; onToggleObjetivo:(index:number)=>void;
  onUpdateProyecto?:(field:string,value:unknown)=>void|Promise<void>; pageMode?:boolean;
}
// Existing entry points share the same workspace, calculations and permission checks.
export default function ProyectoModal({proyecto,isDark,onClose,pageMode=false}:Props) {
  const panel=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(pageMode)return;const previous=document.activeElement as HTMLElement;panel.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>previous?.focus()},[pageMode])
  if(pageMode)return <ProjectWorkspace project={proyecto} isDark={isDark}/>
  return createPortal(<div className="project-work pw-overlay" data-dark={isDark} style={{alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div ref={panel} role="dialog" aria-modal="true" aria-label={proyecto.nombre} style={{width:'min(1280px, 96vw)',height:'92vh',background:'var(--pw-bg)',borderRadius:12,overflow:'hidden',display:'flex',flexDirection:'column'}} onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const controls=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)');if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}}><div style={{padding:'8px 16px',textAlign:'right'}}><button className="pw-button" onClick={onClose} aria-label="Cerrar proyecto"><X size={16}/></button></div><ProjectWorkspace project={proyecto} isDark={isDark}/></div></div>,document.body)
}
