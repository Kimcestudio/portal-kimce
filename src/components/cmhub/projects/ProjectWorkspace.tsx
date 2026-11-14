'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Link2, Archive, RotateCcw, Pin, X, ExternalLink, Pencil, Users, NotebookPen, Target, Calendar, CheckCircle2, AlertTriangle, TrendingUp, Clock, Lightbulb, FileText, File, Image, Video, FolderOpen, ListChecks, FileDown, Sparkles } from 'lucide-react'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { useAuth } from '@/components/auth/AuthProvider'
import { canManageProject } from '@/cmhub/projects/permissions'
import { projectTasks, projectProgress, today, validDate, safeUrl } from '@/cmhub/projects/domain'
import { setSharing } from '@/cmhub/projects/repository'
import type { Proyecto, ProyectaNota } from '@/cmhub/types'
import ProjectWork from './ProjectWork'
import ProjectAgenda from './ProjectAgenda'
import { Avatar, AvatarGroup } from './Avatar'
import './projects.css'
import './project-context.css'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase/client'

type _ProjMeeting = { id: string; title: string; date: string; summary: string; participants: { name: string }[]; actionItems: { done: boolean }[]; recordingUrl: string }

const TIPO_CFG: Record<string,{label:string;color:string;bg:string}> = {
  campaña:{label:'Campaña',color:'#7c3aed',bg:'#f5f3ff'},
  lanzamiento:{label:'Lanzamiento',color:'#ea580c',bg:'#fff7ed'},
  estrategia:{label:'Estrategia',color:'#2563eb',bg:'#eff6ff'},
  web:{label:'Web',color:'#0891b2',bg:'#ecfeff'},
  contenido_especial:{label:'Cont. especial',color:'#db2777',bg:'#fdf2f8'},
  interno:{label:'Interno',color:'#64748b',bg:'#f8fafc'},
  propuesta:{label:'Propuesta',color:'#16a34a',bg:'#f0fdf4'},
}

export default function ProjectWorkspace({project,isDark}:{project:Proyecto;isDark:boolean}) {
  const {brands,team,projectActivities:actividades,updateProyecto}=useHub(), {profile,authUser}=useAuth(), base=useHubBase()
  const manager=canManageProject(project,{uid:authUser?.uid,role:profile?.role}), writable=manager&&!project.archived
  const [tab,setTab]=useState('trabajo'), [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('')
  const [draft,setDraft]=useState<Proyecto|null>(null), [note,setNote]=useState(''), [noteType,setNoteType]=useState<ProyectaNota['tipo']>('anotacion'), [editingNote,setEditingNote]=useState<string|null>(null), [noteSearch,setNoteSearch]=useState('')
  const [linkName,setLinkName]=useState(''), [linkUrl,setLinkUrl]=useState(''), [objective,setObjective]=useState('')
  const [projectMeetings,setProjectMeetings]=useState<_ProjMeeting[]>([]), [meetingsLoaded,setMeetingsLoaded]=useState(false)
  const [briefEdit,setBriefEdit]=useState(false), [briefDraft,setBriefDraft]=useState('')
  const tasks=useMemo(()=>projectTasks(project,actividades),[project,actividades]), leaves=tasks.filter(t=>!t.isGroup), brand=brands.find(b=>b.id===project.brandId)
  const overdue=leaves.filter(t=>t.fechaFin&&t.fechaFin<today()&&t.estado!=='completado'), blocked=leaves.filter(t=>t.blockedReason&&t.estado!=='completado')
  const upcoming=leaves.filter(t=>t.fechaFin&&t.estado!=='completado').sort((a,b)=>a.fechaFin.localeCompare(b.fechaFin))[0]
  const daysLeft=project.fechaFin?Math.ceil((Date.parse(project.fechaFin+'T12:00:00Z')-Date.now())/86400000):null
  const teamMembers=team.filter(m=>tasks.some(t=>t.assigneeIds?.includes(m.id)||t.responsable===m.name)||project.ownerIds?.includes(m.id))
  const upcomingDays=upcoming?Math.ceil((Date.parse(upcoming.fechaFin+'T12:00:00Z')-Date.now())/86400000):null

  async function run(action:()=>Promise<unknown>,success='Guardado correctamente') {
    if(busy)return;setBusy(true);setError('');setMessage('')
    try{await action();if(success)setMessage(success)}
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar. Vuelve a intentarlo.')}
    finally{setBusy(false)}
  }
  async function patch(fields:Partial<Proyecto>) { await updateProyecto(project.id,fields) }
  async function share() {
    const token=project.shareToken||await setSharing(project,true)
    const url=`${window.location.origin}/clientes/gantt/${token}`
    try{await navigator.clipboard.writeText(url);setMessage('Enlace copiado. Solo incluye tareas, fechas y progreso.')}
    catch{setMessage(`Copia este enlace: ${url}`)}
  }
  function saveDetails() {
    if(!draft)return
    if(!draft.nombre.trim()){setError('Escribe el nombre del proyecto.');return}
    if((draft.fechaInicio&&!validDate(draft.fechaInicio))||(draft.fechaFin&&!validDate(draft.fechaFin))||(draft.fechaInicio&&draft.fechaFin&&draft.fechaFin<draft.fechaInicio)){setError('Revisa las fechas: la entrega no puede ser anterior al inicio.');return}
    void run(async()=>{await patch({nombre:draft.nombre.trim(),brandId:draft.brandId,descripcion:draft.descripcion||'',objetivoGeneral:draft.objetivoGeneral||'',fechaInicio:draft.fechaInicio,fechaFin:draft.fechaFin||'',estado:draft.estado,ownerIds:draft.ownerIds||[],responsables:team.filter(m=>draft.ownerIds?.includes(m.id)).map(m=>m.name),responsable:team.find(m=>draft.ownerIds?.includes(m.id))?.name||'',workingDays:draft.workingDays||[],weeklyCapacityHours:draft.weeklyCapacityHours||0,tipo:draft.tipo||undefined,criterioExito:draft.criterioExito||''});setDraft(null)})
  }
  function resourceIcon(url:string){
    const path=url.split('?')[0].toLowerCase()
    return /\.(png|jpg|jpeg|webp|gif)$/.test(path)?<Image size={18}/>:/\.(mp4|mov|webm)$/.test(path)||/youtube|vimeo/.test(path)?<Video size={18}/>:path.endsWith('.pdf')?<FileText size={18}/>:path.includes('/folders/')?<FolderOpen size={18}/>:<Link2 size={18}/>
  }
  function exportProject() {
    const esc=(s:string|undefined)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const pct=projectProgress(tasks)
    const exportDate=new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'})
    const owners=team.filter(m=>project.ownerIds?.includes(m.id)||(project.responsables||[]).includes(m.name)||project.responsable===m.name)
    const tipoMap:Record<string,string>={campaña:'Campaña',lanzamiento:'Lanzamiento',estrategia:'Estrategia',web:'Web',contenido_especial:'Contenido especial',interno:'Interno',propuesta:'Propuesta'}
    const tipoLabel=project.tipo?tipoMap[project.tipo]||project.tipo:''
    const estadoLabel=project.estado==='activo'?'Activo':project.estado==='prospecto'?'Próximamente':project.estado==='pausado'?'Pausado':'Completado'
    const estadoBg=project.estado==='activo'?'#dcfce7':project.estado==='completado'?'#dbeafe':project.estado==='pausado'?'#fef3c7':'#f3f4f6'
    const estadoColor=project.estado==='activo'?'#15803d':project.estado==='completado'?'#1d4ed8':project.estado==='pausado'?'#b45309':'#6b7280'
    const objs=project.objetivos||[]
    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Informe · ${esc(project.nombre)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;color:#111827;background:#fff;padding:52px 56px;max-width:800px;margin:0 auto;font-size:14px;line-height:1.6}h2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#7c3aed;margin:36px 0 10px;padding-bottom:7px;border-bottom:1px solid #e5e7eb}p{margin-bottom:8px}.chip{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}.brief{white-space:pre-wrap;background:#faf5ff;border-left:4px solid #7c3aed;padding:18px 20px;border-radius:0 8px 8px 0;font-size:14px;line-height:1.75;color:#1f2937}.bar-bg{height:8px;background:#e5e7eb;border-radius:4px;margin:10px 0 6px}.bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#7c3aed,#a78bfa)}.obj-row{display:flex;gap:8px;margin-bottom:7px;align-items:flex-start}.done{color:#16a34a;font-weight:700}.open{color:#9ca3af}.team-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}.team-chip{background:#f3f4f6;border-radius:20px;padding:4px 12px;font-size:12px;color:#374151}.footer{margin-top:52px;padding-top:14px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af}@media print{body{padding:28px 32px}}</style></head><body>
<div style="margin-bottom:36px"><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">KIMCE Studio · Informe de proyecto</div><div style="font-size:28px;font-weight:700;color:#111827;margin-bottom:8px;line-height:1.2">${esc(project.nombre)}</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">${brand?`<span class="chip" style="background:#f3f4f6;color:#374151">${esc(brand.name)}</span>`:''} ${tipoLabel?`<span class="chip" style="background:#f5f3ff;color:#7c3aed">${esc(tipoLabel)}</span>`:''} <span class="chip" style="background:${estadoBg};color:${estadoColor}">${esc(estadoLabel)}</span><span style="font-size:12px;color:#9ca3af;margin-left:4px">Exportado el ${exportDate}</span></div></div>
${project.brief?`<h2>Estado del proyecto</h2>${project.briefUpdatedAt?`<div style="font-size:11px;color:#9ca3af;margin-bottom:10px">Actualizado el ${esc(project.briefUpdatedAt.slice(0,10))}</div>`:''}<div class="brief">${esc(project.brief)}</div>`:''}
${(project.objetivoGeneral||project.descripcion)?`<h2>Objetivo general</h2><p>${esc(project.objetivoGeneral||project.descripcion)}</p>${project.criterioExito?`<p style="font-size:12px;color:#6b7280;margin-top:4px"><strong>Criterio de éxito:</strong> ${esc(project.criterioExito)}</p>`:''}`:''}
<h2>Progreso</h2><div style="font-size:22px;font-weight:700;color:#7c3aed">${pct}%</div><div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div><div style="font-size:12px;color:#6b7280;margin-top:4px">${project.fechaInicio?`Inicio: ${esc(project.fechaInicio)}`:''}${project.fechaFin?` → Entrega: ${esc(project.fechaFin)}`:''}</div>
${objs.length?`<h2>Objetivos verificables</h2>${objs.map(o=>`<div class="obj-row"><span class="obj-icon ${o.done?'done':'open'}">${o.done?'✓':'○'}</span><span style="text-decoration:${o.done?'line-through':'none'};opacity:${o.done?.6:1}">${esc(o.texto)}</span></div>`).join('')}`:''}
${owners.length?`<h2>Equipo</h2><div class="team-row">${owners.map(m=>`<span class="team-chip">${esc(m.name)}</span>`).join('')}</div>`:''}
<div class="footer"><span>Generado por Portal KIMCE · ${exportDate}</span><span>Confidencial</span></div>
<script>window.print()</script></body></html>`
    const win=window.open('','_blank')
    if(win){win.document.write(html);win.document.close()}
  }

  useEffect(()=>{
    if(tab!=='reuniones'||meetingsLoaded||!project.id)return
    getDocs(query(collection(db,'hubReuniones'),where('projectIds','array-contains',project.id)))
      .then(snap=>{setProjectMeetings(snap.docs.map(d=>d.data() as _ProjMeeting).sort((a,b)=>b.date.localeCompare(a.date)));setMeetingsLoaded(true)})
      .catch(()=>setMeetingsLoaded(true))
  },[tab,meetingsLoaded,project.id])

  const notes=(project.notas||[]).filter(n=>n.texto.toLowerCase().includes(noteSearch.toLowerCase())).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||b.createdAt.localeCompare(a.createdAt))
  const progress=projectProgress(tasks)

  const sidebarLabel=(text:string)=>(
    <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.09em',color:'var(--pw-muted)',margin:'0 0 7px'}}>{text}</p>
  )

  return (
    <div className="project-work flex flex-col h-full overflow-hidden" data-dark={isDark} style={{
      background:isDark?'linear-gradient(160deg, #0f111a 0%, #111422 60%, #12102a 100%)':'linear-gradient(160deg, #f8fafc 0%, #f0f4ff 60%, #f5f3ff 100%)',
      ...(brand?.color?{'--brand-color':brand.color} as React.CSSProperties:{})
    }}>

      {/* Full-width glass header */}
      <div className="shrink-0" style={{background:isDark?'rgba(13,15,18,0.97)':'rgba(255,255,255,0.97)',backdropFilter:'blur(20px) saturate(180%)',WebkitBackdropFilter:'blur(20px) saturate(180%)',borderBottom:`1px solid ${isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'}`,boxShadow:isDark?'none':'0 1px 0 rgba(255,255,255,1), 0 2px 12px rgba(0,0,0,0.04)',padding:'10px 24px 14px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0,flex:1,flexWrap:'wrap'}}>
            <Link className="pw-ws-back" href={`${base}/proyectos`}><ArrowLeft size={13}/>Proyectos</Link>
            {brand&&<span className="pw-project-brand-chip">{brand.name}</span>}
            {project.tipo&&TIPO_CFG[project.tipo]&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:TIPO_CFG[project.tipo].bg,color:TIPO_CFG[project.tipo].color}}>{TIPO_CFG[project.tipo].label}</span>}
            <span className="pw-pill pw-pill-sm" data-state={project.estado==='activo'?'en_curso':project.estado==='prospecto'?'pendiente':project.estado}>{project.archived?'Archivado':project.estado==='prospecto'?'Próximamente':project.estado==='activo'?'Activo':project.estado==='pausado'?'Pausado':'Completado'}</span>
          </div>
          <AvatarGroup team={team} ids={project.ownerIds} names={project.responsables||[project.responsable]}/>
        </div>
        <h1 style={{fontSize:17,fontWeight:750,letterSpacing:'-.025em',margin:'0 0 10px',lineHeight:1.25,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{project.nombre}</h1>
        <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso: ${progress}%`} style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1,height:6,background:isDark?'rgba(255,255,255,0.08)':'rgba(109,40,217,.10)',borderRadius:4,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg, #7c3aed, #a78bfa, #818cf8)',borderRadius:4,boxShadow:'0 0 8px rgba(124,58,237,.4)',transition:'width .5s cubic-bezier(.16,1,.3,1)'}}/>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:'#7c3aed',minWidth:32,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{progress}%</span>
        </div>
      </div>

      {(busy||message||error)&&<div className="pw-ws-statusbar" role="status" style={{margin:'0 24px'}}>{error?<span className="pw-ws-error" role="alert">{error}</span>:busy?'Guardando…':message}</div>}

      {/* Main area: scrollable content + right sidebar */}
      <div style={{flex:1,height:0,display:'flex',overflow:'hidden'}}>

        {/* Scrollable content */}
        <div className="pw-shell" data-dark={isDark} style={{flex:1,height:'100%',overflowY:'auto',padding:'14px 24px 32px',background:'transparent'}}>

          {/* KPI strip */}
          {leaves.length>0&&<div style={{display:'flex',gap:8,padding:'8px 0 4px',flexWrap:'wrap',marginBottom:4}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:20,background:isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.05)',fontSize:12,fontWeight:600,color:'var(--pw-muted)'}}><CheckCircle2 size={12} style={{color:'#22c55e'}}/>{leaves.filter(t=>t.estado==='completado').length}/{leaves.length} tareas</span>
            {overdue.length>0&&<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:20,background:isDark?'rgba(239,68,68,0.15)':'#fee2e2',fontSize:12,fontWeight:700,color:'#b91c1c'}}><AlertTriangle size={12}/>{overdue.length} vencida{overdue.length!==1?'s':''}</span>}
            {blocked.length>0&&<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:20,background:isDark?'rgba(245,158,11,0.15)':'#fef3c7',fontSize:12,fontWeight:700,color:'#b45309'}}><AlertTriangle size={12}/>{blocked.length} bloqueada{blocked.length!==1?'s':''}</span>}
            {daysLeft!==null&&daysLeft>=0&&<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:20,background:isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.05)',fontSize:12,fontWeight:600,color:daysLeft<=7?'#7c3aed':'var(--pw-muted)'}}><Clock size={12}/>{daysLeft===0?'Vence hoy':`${daysLeft}d restantes`}</span>}
            {daysLeft!==null&&daysLeft<0&&<span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:20,background:isDark?'rgba(239,68,68,0.15)':'#fee2e2',fontSize:12,fontWeight:700,color:'#b91c1c'}}><Clock size={12}/>Vencido hace {Math.abs(daysLeft)}d</span>}
          </div>}

          {/* Tabs — 3 tabs */}
          <nav className="pw-tabs" role="tablist" aria-label="Proyecto">
            {[['trabajo','Tareas'],['resumen','Resumen'],['reuniones','Reuniones']].map(([id,label])=><button key={id} role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab===id} onClick={()=>setTab(id)}>{label}</button>)}
            {project.archived&&<span className="pw-tabs-notice">Archivado · historial conservado</span>}
            {!project.archived&&(overdue.length>0||blocked.length>0)&&<span className="pw-tabs-notice">{[overdue.length?`${overdue.length} vencida${overdue.length===1?'':'s'}`:'',blocked.length?`${blocked.length} bloqueada${blocked.length===1?'':'s'}`:''].filter(Boolean).join(' · ')}</span>}
          </nav>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>

            {/* TAREAS */}
            {tab==='trabajo'&&<ProjectWork project={project} isDark={isDark}/>}

            {/* RESUMEN — Objetivo + Estado + Objetivos + Equipo + Calendario */}
            {tab==='resumen'&&<div className="pw-dashboard"><div className="pw-summary"><div>
              <div className="pw-card" style={{background:isDark?'rgba(124,58,237,0.07)':'rgba(124,58,237,0.04)',boxShadow:isDark?'0 0 0 1px rgba(124,58,237,0.2), 0 4px 16px rgba(124,58,237,0.1)':'0 0 0 1px rgba(124,58,237,0.1), 0 4px 20px rgba(124,58,237,0.07)'}}><div className="pw-card-header"><div className="pw-card-icon pw-ci-violet"><Target size={16}/></div><h2 className="pw-card-title" style={{fontSize:15,fontWeight:700,letterSpacing:'-.01em'}}>Objetivo del proyecto</h2></div><p style={{lineHeight:'1.8',whiteSpace:'pre-wrap',margin:0,fontSize:15,color:(project.objetivoGeneral||project.descripcion)?'var(--pw-ink)':'var(--pw-muted)'}}>{project.objetivoGeneral||project.descripcion||'Define el resultado que debe conseguir el equipo.'}</p>{project.criterioExito&&<p style={{marginTop:10,fontSize:12,color:'var(--pw-muted)',borderTop:'1px solid var(--pw-line)',paddingTop:10,margin:'10px 0 0'}}><strong style={{color:'#7c3aed',fontWeight:700}}>Criterio de éxito</strong><br/>{project.criterioExito}</p>}</div>
              <div className="pw-card" style={project.brief?{background:isDark?'rgba(34,197,94,0.05)':'rgba(34,197,94,0.03)',boxShadow:isDark?'0 0 0 1px rgba(34,197,94,0.15)':'0 0 0 1px rgba(34,197,94,0.1), 0 2px 12px rgba(34,197,94,0.06)'}:{}}><div className="pw-card-header"><div className="pw-card-icon pw-ci-green"><TrendingUp size={16}/></div><h2 className="pw-card-title">Estado del proyecto</h2>{project.briefUpdatedAt&&<span style={{display:'inline-flex',alignItems:'center',gap:6,marginLeft:'auto'}}><span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#f5f3ff',color:'#7c3aed'}}><Sparkles size={9}/>KIMCE AI</span><span style={{fontSize:11,color:'#9ca3af',whiteSpace:'nowrap'}}>{project.briefUpdatedAt.slice(0,10)}</span></span>}</div>{briefEdit?<><textarea rows={8} value={briefDraft} onChange={e=>setBriefDraft(e.target.value)} style={{width:'100%',marginBottom:8,fontFamily:'inherit',fontSize:13,lineHeight:1.6,resize:'vertical'}}/><div className="pw-toolbar"><button className="pw-button pw-primary" disabled={busy} onClick={()=>run(async()=>{await patch({brief:briefDraft,briefUpdatedAt:new Date().toISOString()});setBriefEdit(false)})}>Guardar</button><button type="button" className="pw-button" onClick={()=>setBriefEdit(false)}>Cancelar</button></div></>:<><p style={{lineHeight:'1.7',whiteSpace:'pre-wrap',margin:0,fontSize:14,color:project.brief?'inherit':'#9ca3af'}}>{project.brief||'KIMCE AI actualizará este brief automáticamente después de cada reunión vinculada al proyecto.'}</p>{writable&&<button className="pw-button" style={{marginTop:10}} onClick={()=>{setBriefDraft(project.brief||'');setBriefEdit(true)}}><Pencil size={14}/>Editar</button>}</>}</div>
              <div className="pw-card"><div className="pw-card-header"><div className="pw-card-icon pw-ci-green"><CheckCircle2 size={16}/></div><h2 className="pw-card-title">Objetivos</h2>{(project.objetivos||[]).length>0&&<span className="pw-kpi-label" style={{marginLeft:'auto'}}>{(project.objetivos||[]).filter(o=>o.done).length}/{(project.objetivos||[]).length}</span>}</div>{(project.objetivos||[]).map((o,i)=><label className="pw-objective-row" key={i}><input type="checkbox" checked={o.done} disabled={!writable||busy} onChange={()=>run(()=>patch({objetivos:project.objetivos!.map((x,j)=>i===j?{...x,done:!x.done}:x)}))}/><span style={{textDecoration:o.done?'line-through':'none',opacity:o.done?.55:1}}>{o.texto}</span></label>)}{writable&&<form className="pw-objective-add" onSubmit={e=>{e.preventDefault();if(objective.trim())void run(async()=>{await patch({objetivos:[...(project.objetivos||[]),{texto:objective.trim(),done:false}]});setObjective('')})}}><input aria-label="Nuevo objetivo" value={objective} onChange={e=>setObjective(e.target.value)} placeholder="Nuevo objetivo verificable"/><button className="pw-button" disabled={busy}>Añadir</button></form>}</div>
              {draft&&<div className="pw-card"><div className="pw-card-header"><div className="pw-card-icon pw-ci-muted"><Pencil size={16}/></div><h2 className="pw-card-title">Editar proyecto</h2></div><form className="pw-form" onSubmit={e=>{e.preventDefault();saveDetails()}}><label>Nombre<input required value={draft.nombre} onChange={e=>setDraft({...draft,nombre:e.target.value})}/></label><label>Cliente<select value={draft.brandId} onChange={e=>setDraft({...draft,brandId:e.target.value})}>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Objetivo general<textarea rows={3} value={draft.objetivoGeneral||''} onChange={e=>setDraft({...draft,objetivoGeneral:e.target.value})}/></label><label>Descripción<textarea rows={3} value={draft.descripcion||''} onChange={e=>setDraft({...draft,descripcion:e.target.value})}/></label><div className="pw-two"><label>Inicio<input type="date" value={draft.fechaInicio} onChange={e=>setDraft({...draft,fechaInicio:e.target.value})}/></label><label>Entrega<input type="date" min={draft.fechaInicio} value={draft.fechaFin||''} onChange={e=>setDraft({...draft,fechaFin:e.target.value})}/></label></div><label>Estado<select value={draft.estado} onChange={e=>setDraft({...draft,estado:e.target.value as Proyecto['estado']})}><option value="prospecto">Próximamente</option><option value="activo">Activo</option><option value="pausado">Pausado</option><option value="completado">Completado</option></select></label><div className="pw-two"><label>Tipo de proyecto<select value={draft.tipo||''} onChange={e=>setDraft({...draft,tipo:(e.target.value||undefined) as Proyecto['tipo']})}><option value="">Sin definir</option><option value="campaña">Campaña</option><option value="lanzamiento">Lanzamiento</option><option value="estrategia">Estrategia</option><option value="web">Web</option><option value="contenido_especial">Contenido especial</option><option value="interno">Interno</option><option value="propuesta">Propuesta</option></select></label><label>Criterio de éxito<input value={draft.criterioExito||''} onChange={e=>setDraft({...draft,criterioExito:e.target.value})} placeholder="¿Cómo saben que está bien?"/></label></div><fieldset><legend>Responsables de planificación</legend>{team.map(m=><label key={m.id} className="pw-check"><input type="checkbox" checked={draft.ownerIds?.includes(m.id)||false} onChange={e=>setDraft({...draft,ownerIds:e.target.checked?[...(draft.ownerIds||[]),m.id]:(draft.ownerIds||[]).filter(id=>id!==m.id)})}/>{m.name}</label>)}</fieldset><fieldset><legend>Días laborables (ninguno = días naturales)</legend><div className="pw-toolbar">{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d,i)=><label className="pw-check" key={d}><input type="checkbox" checked={draft.workingDays?.includes(i)||false} onChange={e=>setDraft({...draft,workingDays:e.target.checked?[...(draft.workingDays||[]),i]:(draft.workingDays||[]).filter(n=>n!==i)})}/>{d}</label>)}</div></fieldset><label>Capacidad semanal por persona para este proyecto (horas)<input type="number" min={0} step={1} value={draft.weeklyCapacityHours||0} onChange={e=>setDraft({...draft,weeklyCapacityHours:Number(e.target.value)})}/><span className="pw-muted">0 significa sin capacidad definida; no se asume una jornada.</span></label><div className="pw-toolbar"><button className="pw-button pw-primary" disabled={busy}>Guardar proyecto</button><button type="button" className="pw-button" onClick={()=>setDraft(null)}>Cancelar</button></div></form></div>}
              {/* Equipo — moved from equipo tab */}
              {teamMembers.length>0&&<div className="pw-card" style={{marginTop:16}}><div className="pw-card-header"><div className="pw-card-icon pw-ci-blue"><Users size={16}/></div><h2 className="pw-card-title">Carga del equipo</h2><p className="pw-muted" style={{fontSize:11,marginLeft:'auto',marginBottom:0}}>Esta semana</p></div><div className="pw-team-grid">{teamMembers.map(m=>{const own=leaves.filter(t=>t.assigneeIds?.includes(m.id)||t.responsable===m.name),active=own.filter(t=>t.estado!=='completado'),end=new Date(Date.parse(today()+'T12:00:00Z')+6*86400000).toISOString().slice(0,10),week=active.filter(t=>t.fechaFin&&t.fechaFin<=end);const hours=week.reduce((s,t)=>s+(t.effortHours||0)*(1-t.avance/100),0),vencidas=active.filter(t=>t.fechaFin&&t.fechaFin<today()).length,sinEst=active.filter(t=>!t.effortHours).length,overloaded=!!project.weeklyCapacityHours&&hours>project.weeklyCapacityHours,pct=project.weeklyCapacityHours?Math.min(100,hours/project.weeklyCapacityHours*100):0;return <div className={`pw-team-card${overloaded?' pw-team-overloaded':''}`} key={m.id}><Avatar member={m} name={m.name}/><div className="pw-team-info"><strong title={m.name}>{m.name.split(' ').slice(0,2).join(' ')}</strong><div className="pw-team-chips">{active.length===0?<span className="pw-chip pw-chip-green">Al día</span>:<span className="pw-chip pw-chip-muted">{active.length} tarea{active.length!==1?'s':''}</span>}{vencidas>0&&<span className="pw-chip pw-chip-red">{vencidas} vencida{vencidas!==1?'s':''}</span>}{sinEst>0&&<span className="pw-chip pw-chip-amber">{sinEst} sin estimar</span>}{overloaded&&<span className="pw-chip pw-chip-red">Sobrecarga</span>}</div>{(project.weeklyCapacityHours||0)>0&&<div className="pw-progress" style={{height:5}}><span style={{width:`${pct}%`,display:'block',height:'100%',borderRadius:4,background:overloaded?'#ef4444':'linear-gradient(90deg,var(--pw-accent),#a78bfa)'}}/></div>}<span className="pw-team-hours">{Math.round(hours*10)/10} h{project.weeklyCapacityHours?` / ${project.weeklyCapacityHours} h cap.`:' estimadas'} esta semana</span><details className="pw-person-tasks"><summary>Ver tareas ({own.length})</summary>{own.length===0?<p className="pw-muted">Sin tareas asignadas.</p>:own.map(t=><div className="pw-person-task" key={t.id}><span>{t.nombre}</span><span className="pw-pill" data-state={t.estado}>{t.avance}%</span></div>)}</details></div></div>})}</div></div>}
              <details style={{marginTop:16}}><summary style={{display:'flex',alignItems:'center',gap:7,padding:'10px 2px 10px 0',cursor:'pointer',listStyle:'none',userSelect:'none',fontSize:13,fontWeight:600,color:'var(--pw-muted)'}}><Calendar size={14}/> Calendario de entregas</summary><ProjectAgenda project={project} tasks={tasks}/></details>
            </div><aside>
              <div className="pw-card"><div className="pw-card-header"><div className="pw-card-icon pw-ci-blue"><Calendar size={16}/></div><h2 className="pw-card-title">Planificación</h2></div><div className="pw-plan-dates"><div className="pw-plan-date-block"><span>Inicio</span><strong>{project.fechaInicio||'Sin fecha'}</strong></div><div className="pw-plan-sep">→</div><div className="pw-plan-date-block"><span>Entrega</span><strong>{project.fechaFin||'Sin fecha'}</strong></div></div><div style={{marginBottom:12}}><div className="pw-progress" style={{height:6,borderRadius:3}}><span style={{width:`${progress}%`,display:'block',height:'100%',background:'linear-gradient(90deg,var(--pw-accent),#a78bfa)',borderRadius:3}}/></div><p className="pw-muted" style={{marginTop:5,fontSize:12}}>{progress}% completado</p></div><span className="pw-pill" data-state={project.estado==='activo'?'en_curso':project.estado==='prospecto'?'pendiente':project.estado}>{project.estado==='prospecto'?'Próximamente':project.estado==='activo'?'Activo':project.estado==='pausado'?'Pausado':'Completado'}</span>{(project.responsables||[project.responsable]).filter(Boolean).length>0&&<div style={{marginTop:14,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><AvatarGroup team={team} ids={project.ownerIds} names={project.responsables||[project.responsable]}/></div>}{upcoming&&<div className="pw-upcoming"><span>Próxima entrega</span><strong>{upcoming.fechaFin} · {upcoming.nombre}</strong></div>}<p className="pw-muted" style={{marginTop:10,fontSize:11}}>El progreso es el promedio de las tareas, sin contar las fases.</p></div>
            </aside></div></div>}

            {/* REUNIONES — Meetings + Recursos + Notas */}
            {tab==='reuniones'&&<section className="pw-section" style={{paddingTop:20}}>
              <div className="pw-card-header" style={{marginBottom:16}}>
                <div className="pw-card-icon pw-ci-violet"><ListChecks size={16}/></div>
                <h2 className="pw-card-title">Reuniones del proyecto</h2>
                {meetingsLoaded&&projectMeetings.length>0&&<span className="pw-kpi-label" style={{marginLeft:'auto'}}>{projectMeetings.length}</span>}
              </div>
              {!meetingsLoaded
                ?<p className="pw-muted" style={{textAlign:'center',padding:'30px 0'}}>Cargando…</p>
                :projectMeetings.length===0
                  ?<div className="pw-empty" style={{padding:'40px 20px',textAlign:'center'}}><ListChecks size={28} style={{margin:'0 auto 12px',opacity:.35,display:'block'}}/><p>Sin reuniones vinculadas todavía.</p><p className="pw-muted" style={{fontSize:12}}>KIMCE AI vincula reuniones a este proyecto automáticamente. Aparecerán aquí después de cada sesión.</p></div>
                  :<div style={{display:'flex',flexDirection:'column',gap:10}}>{projectMeetings.map(m=>{const pending=(m.actionItems||[]).filter(i=>!i.done).length,total=(m.actionItems||[]).length;return <div className="pw-card" key={m.id}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:6}}><Link href={`${base}/contenidos/reuniones/${m.id}`} style={{fontWeight:600,fontSize:14,color:'inherit',textDecoration:'none'}}>{m.title}</Link><span style={{fontSize:12,color:'#9ca3af',whiteSpace:'nowrap'}}>{m.date}</span></div>{m.summary&&<p style={{fontSize:13,lineHeight:1.5,margin:'0 0 10px',color:'#6b7280'}}>{m.summary.slice(0,160)}{m.summary.length>160?'…':''}</p>}<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>{(m.participants||[]).length>0&&<span style={{fontSize:12,color:'#9ca3af'}}>{(m.participants||[]).map(p=>p.name).join(' · ')}</span>}{total>0&&<span className={`pw-chip ${pending===0?'pw-chip-green':'pw-chip-muted'}`} style={{marginLeft:'auto'}}>{pending===0?'Cerrada':`${pending}/${total} pendientes`}</span>}</div></div>})}</div>
              }
              {/* Recursos y Notas en 2 columnas */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:28}}>
                <div className="pw-card"><div className="pw-card-header"><div className="pw-card-icon pw-ci-blue"><Link2 size={16}/></div><h2 className="pw-card-title">Recursos</h2></div>{(project.links||[]).length===0&&!writable&&<p className="pw-muted" style={{fontSize:13}}>Sin recursos añadidos.</p>}{(project.links||[]).map((l,i)=><div className="pw-resource-link-card" key={i}><a href={safeUrl(l.url)||'#'} target="_blank" rel="noopener noreferrer"><span className="pw-resource-kind">{resourceIcon(l.url)}</span><span>{l.label}</span><ExternalLink size={13}/></a>{writable&&<button className="pw-button pw-icon" aria-label={`Eliminar enlace ${l.label}`} onClick={()=>{if(confirm('¿Quitar este enlace?'))void run(()=>patch({links:project.links!.filter((_,j)=>j!==i)}))}}><X size={14}/></button>}</div>)}{writable&&<form className="pw-form" style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--pw-line)'}} onSubmit={e=>{e.preventDefault();const url=safeUrl(linkUrl);if(!url){setError('Introduce un enlace web válido (https://…).');return}void run(async()=>{await patch({links:[...(project.links||[]),{label:linkName.trim()||new URL(url).hostname,url}]});setLinkName('');setLinkUrl('')})}}><label>Nombre del recurso<input value={linkName} onChange={e=>setLinkName(e.target.value)}/></label><label>Enlace<input required value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://…"/></label><button className="pw-button" disabled={busy}>Añadir recurso</button></form>}</div>
                <div className="pw-card"><div className="pw-card-header"><div className="pw-card-icon pw-ci-amber"><NotebookPen size={16}/></div><h2 className="pw-card-title">Notas</h2></div><input type="search" aria-label="Buscar notas" placeholder="Buscar en las notas…" value={noteSearch} onChange={e=>setNoteSearch(e.target.value)} style={{marginBottom:14,width:'100%'}}/>{writable&&<form className="pw-form" style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--pw-line)'}} onSubmit={e=>{e.preventDefault();if(!note.trim())return;void run(async()=>{const item:ProyectaNota={id:editingNote||crypto.randomUUID(),texto:note.trim(),autor:profile?.displayName||'Equipo',tipo:noteType,createdAt:new Date().toISOString()};await patch({notas:editingNote?(project.notas||[]).map(n=>n.id===editingNote?{...n,texto:item.texto,tipo:noteType,updatedAt:item.createdAt}:n):[...(project.notas||[]),item]});setNote('');setEditingNote(null)})}}><label>{editingNote?'Editar nota':'Nueva nota'}<textarea rows={3} value={note} onChange={e=>setNote(e.target.value)}/></label><div className="pw-two"><select aria-label="Tipo de nota" value={noteType} onChange={e=>setNoteType(e.target.value as typeof noteType)}><option value="anotacion">Anotación</option><option value="idea">Idea</option><option value="resumen">Resumen</option><option value="otro">Otro</option></select><button className="pw-button" disabled={busy}>{editingNote?'Guardar nota':'Añadir nota'}</button></div></form>}{notes.length===0&&<div className="pw-empty" style={{padding:'32px 20px',borderTop:'1px solid var(--pw-line)'}}><NotebookPen size={24} style={{margin:'0 auto 10px',opacity:.35}}/><p>Sin notas todavía.</p></div>}{notes.map(n=><div className="pw-note-card" key={n.id}><div className="pw-note-meta"><span className={`pw-note-icon pw-ni-${n.tipo}`}>{n.tipo==='idea'?<Lightbulb size={14}/>:n.tipo==='resumen'?<FileText size={14}/>:n.tipo==='otro'?<File size={14}/>:<NotebookPen size={14}/>}</span><span className={`pw-note-tag pw-nt-${n.tipo}`}>{n.tipo}</span>{n.pinned&&<Pin size={12} style={{color:'var(--pw-accent)'}}/>}<span style={{marginLeft:'auto'}}><Avatar member={team.find(m=>m.name===n.autor)} name={n.autor}/></span></div><details className="pw-note-expand"><summary><span>{n.texto.slice(0,130)}{n.texto.length>130?'…':''}</span></summary><p>{n.texto}</p></details>{writable&&<div className="pw-toolbar" style={{paddingTop:8,paddingBottom:0}}><button className="pw-button" onClick={()=>{setEditingNote(n.id);setNote(n.texto);setNoteType(n.tipo)}} title="Editar nota" aria-label="Editar nota"><Pencil size={16}/></button><button className="pw-button" aria-label={n.pinned?'Desfijar nota':'Fijar nota'} disabled={busy} onClick={()=>run(()=>patch({notas:(project.notas||[]).map(x=>x.id===n.id?{...x,pinned:!x.pinned}:x)}))}><Pin size={14}/></button><button className="pw-button pw-danger" disabled={busy} onClick={()=>{if(confirm('¿Eliminar esta nota?'))void run(()=>patch({notas:(project.notas||[]).filter(x=>x.id!==n.id)}))}} title="Eliminar nota" aria-label="Eliminar nota"><X size={16}/></button></div>}</div>)}</div>
              </div>
            </section>}

          </div>
        </div>

        {/* Right sidebar — acciones rápidas + planificación */}
        <aside data-dark={isDark} style={{
          width:236,
          flexShrink:0,
          overflowY:'auto',
          padding:'16px 14px 32px',
          borderLeft:`1px solid ${isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'}`,
          background:isDark?'rgba(13,15,18,0.55)':'rgba(255,255,255,0.65)',
          backdropFilter:'blur(16px) saturate(160%)',
          WebkitBackdropFilter:'blur(16px) saturate(160%)',
          display:'flex',
          flexDirection:'column',
          gap:20
        }}>
          {/* Acciones rápidas */}
          <div>
            {sidebarLabel('Acciones rápidas')}
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {writable&&<button className="pw-button pw-primary" style={{justifyContent:'flex-start',gap:9,width:'100%',fontWeight:600}} onClick={()=>{setDraft({...project});setTab('resumen')}}><Pencil size={14}/>Editar proyecto</button>}
              {manager&&<button className="pw-button" style={{justifyContent:'flex-start',gap:9,width:'100%'}} onClick={exportProject}><FileDown size={14}/>Exportar informe</button>}
              {writable&&<button className="pw-button" style={{justifyContent:'flex-start',gap:9,width:'100%',color:'var(--pw-muted)',fontSize:12}} disabled={busy} onClick={()=>run(share,'')}><Link2 size={12}/>Compartir enlace</button>}
              {project.shareToken&&<button className="pw-button" style={{justifyContent:'flex-start',gap:9,width:'100%',fontSize:11,opacity:.8}} disabled={busy} onClick={()=>run(()=>setSharing(project,false),'El enlace anterior dejó de estar disponible.')}><X size={12}/>Revocar enlace</button>}
            </div>
          </div>

          {/* Planificación */}
          <div>
            {sidebarLabel('Planificación')}
            <div style={{background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.03)',borderRadius:12,padding:'11px 12px',display:'flex',flexDirection:'column',gap:9}}>
              <span className="pw-pill pw-pill-sm" data-state={project.estado==='activo'?'en_curso':project.estado==='prospecto'?'pendiente':project.estado}>{project.archived?'Archivado':project.estado==='prospecto'?'Próximamente':project.estado==='activo'?'Activo':project.estado==='pausado'?'Pausado':'Completado'}</span>
              {(project.fechaInicio||project.fechaFin)&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {project.fechaInicio&&<div><p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--pw-muted)',margin:'0 0 2px'}}>Inicio</p><p style={{fontSize:14,fontWeight:700,color:'var(--pw-ink)',margin:0,lineHeight:1.3,fontVariantNumeric:'tabular-nums'}}>{project.fechaInicio}</p></div>}
                {project.fechaFin&&<div><p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--pw-muted)',margin:'0 0 2px'}}>Entrega</p><p style={{fontSize:14,fontWeight:700,color:daysLeft!==null&&daysLeft<0?'#b91c1c':daysLeft!==null&&daysLeft<=7?'#b45309':'var(--pw-ink)',margin:0,lineHeight:1.3,fontVariantNumeric:'tabular-nums'}}>{project.fechaFin}</p></div>}
              </div>}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1,height:7,background:isDark?'rgba(255,255,255,0.08)':'rgba(109,40,217,.10)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,#7c3aed,#a78bfa)',borderRadius:4,transition:'width .5s cubic-bezier(.16,1,.3,1)',boxShadow:'0 0 6px rgba(124,58,237,0.4)'}}/>
                </div>
                <span style={{fontSize:15,fontWeight:800,color:'#7c3aed',minWidth:36,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{progress}%</span>
              </div>
            </div>
          </div>

          {/* Próxima entrega */}
          {upcoming&&upcomingDays!==null&&<div>
            {sidebarLabel('Próxima entrega')}
            <div style={{
              background:upcomingDays<0?(isDark?'rgba(239,68,68,0.1)':'#fff5f5'):upcomingDays<=3?(isDark?'rgba(245,158,11,0.1)':'#fffbeb'):(isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.03)'),
              borderRadius:12,
              padding:'11px 12px',
              borderLeft:upcomingDays<0?'3px solid #ef4444':upcomingDays<=3?'3px solid #f59e0b':'none'
            }}>
              <p style={{fontSize:12,fontWeight:600,margin:'0 0 5px',lineHeight:1.4,color:'var(--pw-ink)'}}>{upcoming.nombre}</p>
              <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:700,color:upcomingDays<0?'#b91c1c':upcomingDays<=3?'#b45309':'var(--pw-muted)'}}>
                {upcomingDays<0?<AlertTriangle size={10}/>:<Clock size={10}/>}
                {upcomingDays<0?`Vencida hace ${Math.abs(upcomingDays)}d`:upcomingDays===0?'Vence hoy':upcomingDays<=3?`Vence en ${upcomingDays}d`:upcoming.fechaFin}
              </span>
            </div>
          </div>}

          {/* Team compact */}
          {teamMembers.length>0&&<div>
            {sidebarLabel('Equipo')}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {teamMembers.slice(0,5).map(m=>{const own=leaves.filter(t=>t.assigneeIds?.includes(m.id)||t.responsable===m.name),active=own.filter(t=>t.estado!=='completado');return <div key={m.id} style={{display:'flex',alignItems:'center',gap:8}}><Avatar member={m} name={m.name}/><div style={{flex:1,minWidth:0}}><p style={{fontSize:12,fontWeight:600,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--pw-ink)'}}>{m.name.split(' ').slice(0,2).join(' ')}</p><p style={{fontSize:11,color:'var(--pw-muted)',margin:0}}>{active.length===0?'Al día':`${active.length} tarea${active.length!==1?'s':''}`}</p></div></div>})}
              {teamMembers.length>5&&<p style={{fontSize:11,color:'var(--pw-muted)',margin:0}}>+{teamMembers.length-5} más</p>}
            </div>
          </div>}

          {/* Archive / Restore — al fondo */}
          {manager&&<div style={{marginTop:'auto',paddingTop:16,borderTop:`1px solid ${isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'}`}}>
            {project.archived
              ?<button className="pw-button" style={{width:'100%',justifyContent:'flex-start',gap:9}} disabled={busy} onClick={()=>run(()=>patch({archived:false}))}><RotateCcw size={14}/>Restaurar proyecto</button>
              :writable&&<button className="pw-button pw-danger" style={{width:'100%',justifyContent:'flex-start',gap:9}} disabled={busy} onClick={()=>{if(confirm('¿Archivar el proyecto? Se conservarán todas las tareas y podrás restaurarlo.'))void run(()=>patch({archived:true}))}}><Archive size={14}/>Archivar proyecto</button>}
          </div>}
        </aside>

      </div>
    </div>
  )
}
