'use client'
import { useMemo, useState } from 'react'
import { Archive, FolderKanban, X } from 'lucide-react'
import { collection, doc, runTransaction, serverTimestamp, updateDoc, deleteField, writeBatch } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useAuth } from '@/components/auth/AuthProvider'
import { projectTasks, fromActivity, descendants, type Task } from '@/cmhub/projects/domain'
import { getActividadAssignees } from '@/cmhub/activities'
import { saveTasks } from '@/cmhub/projects/repository'
import { canManageProject } from '@/cmhub/projects/permissions'
import type { Proyecto } from '@/cmhub/types'
import GanttChart from '../GanttChart'
export default function ProjectWork({project,isDark}:{project:Proyecto;isDark:boolean}) {
  const { projectActivities: actividades, team, brands, loadingActividades } = useHub(), { profile, authUser } = useAuth()
  const [restoreError,setRestoreError]=useState(''),[restoring,setRestoring]=useState(false)
  const [convertConfirm,setConvertConfirm]=useState<{phase:Task;kids:Task[]}|null>(null),[converting,setConverting]=useState(false)
  const archived=actividades.filter(a=>a.proyectoId===project.id&&a.archived).map(fromActivity)
  const manager = canManageProject(project,{uid:authUser?.uid,role:profile?.role}) && !project.archived
  const tasks = useMemo(()=>projectTasks(project,actividades),[project,actividades])
  const mine = (t:Task) => !project.archived && !!authUser?.uid && t.assigneeIds?.includes(authUser.uid) === true
  async function save(next:Task[], before:Task[]=tasks) {
    if(manager) return saveTasks(project,before,next.map(t => ({...t, assigneeIds: t.assigneeIds?.length ? t.assigneeIds : team.filter(m => (t.assignees || [t.responsable]).includes(m.name)).map(m => m.id)})))
    const added = next.filter(t => !before.some(x=>x.id===t.id))
    if(added.length > 0) {
      // Solo modificar las tareas nuevas — nunca tocar tareas existentes (collab no puede actualizar assigneeIds via reglas Firestore)
      const withSelf = next.map(t => {
        if (!added.some(a => a.id === t.id)) return t
        const ids = t.assigneeIds?.length ? t.assigneeIds : team.filter(m => (t.assignees || [t.responsable]).includes(m.name)).map(m => m.id)
        return {...t, assigneeIds: ids.length ? ids : (authUser?.uid ? [authUser.uid] : [])}
      })
      return saveTasks(project, before, withSelf)
    }
    const changed=next.filter(t=>JSON.stringify(before.find(x=>x.id===t.id))!==JSON.stringify(t))
    await runTransaction(db,async tx=>{
      const snapshots=await Promise.all(changed.map(t=>tx.get(doc(db,'hubActividades',t.id))))
      changed.forEach((t,i)=>{
        const prev=before.find(x=>x.id===t.id), snapshot=snapshots[i]
        if(!prev||!snapshot.exists())throw new Error('El responsable del proyecto debe crear o unificar primero esta tarea.')
        if(!mine(prev)||t.isGroup)throw new Error('Solo puedes actualizar tus tareas asignadas.')
        const live=fromActivity({id:snapshot.id,...snapshot.data()} as Parameters<typeof fromActivity>[0])
        const fields=['estado','avance','blockedReason'] as const
        for(const key of fields)if((prev[key]||'')!==(t[key]||'')&&(prev[key]||'')!==(live[key]||''))throw new Error('Otra persona actualizó esta tarea. Cierra el editor y revisa la versión actual.')
        const patch:Record<string,unknown>={completionSource:'project-workspace',updatedAt:serverTimestamp(),updatedBy:authUser?.uid}
        if(t.estado!==prev.estado)patch.status=t.estado
        if(t.avance!==prev.avance)patch.progress=t.avance
        if(t.blockedReason!==prev.blockedReason)patch.blockedReason=t.blockedReason||''
        tx.update(snapshot.ref,patch)
      })
    })
  }
  async function doConvert() {
    if(!convertConfirm) return
    setConverting(true)
    try {
      // kids = todos los descendientes (grupos + no-grupos), pasados desde GanttChart
      const {phase, kids} = convertConfirm
      const today = new Date().toISOString().slice(0,10)
      const legacyPrefix = `legacy_${project.id}_`
      const isLegacyId = (id: string) => id.startsWith(legacyPrefix)

      const legacyKids = kids.filter(t => isLegacyId(t.id))
      const modernKids = kids.filter(t => !isLegacyId(t.id))
      const isLegacyPhase = isLegacyId(phase.id)

      // Usar todos los descendientes para calcular fechas y nombres
      const nonGroupKids = kids.filter(t => !t.isGroup)
      const starts = nonGroupKids.map(t=>t.fechaInicio).filter(Boolean) as string[]
      const ends   = nonGroupKids.map(t=>t.fechaFin).filter(Boolean) as string[]
      const endsSorted = ends.sort()

      const modernNonGroup = modernKids.filter(t => !t.isGroup)
      const modernNames = [...new Set(modernNonGroup.flatMap(t => {
        const acts = actividades.filter(a => a.id === t.id)
        return acts.flatMap(a => getActividadAssignees(a))
      }).filter(Boolean))]
      const legacyNames = legacyKids.filter(t => !t.isGroup).map(t => t.responsable).filter(Boolean) as string[]
      const allNames = [...new Set([...modernNames, ...legacyNames])]

      const baseP = {
        nombre: phase.nombre,
        brandId: project.brandId,
        estado: 'activo' as const,
        avance: 0,
        fechaInicio: starts.sort()[0] ?? phase.fechaInicio ?? today,
        ...(endsSorted[endsSorted.length-1] ? { fechaFin: endsSorted[endsSorted.length-1] } : {}),
        responsable: allNames[0] ?? project.responsable,
        responsables: allNames.length > 0 ? allNames : project.responsables ?? [],
        ownerIds: project.ownerIds ?? [],
      }

      // Ambos caminos usan writeBatch atómico: si algo falla, nada queda escrito
      const projRef = doc(collection(db, 'cmhub_proyectos'))
      const isoNow = new Date().toISOString()
      const batch = writeBatch(db)

      if (legacyKids.length > 0 || isLegacyPhase) {
        const phaseOriginalId = isLegacyPhase ? phase.id.replace(legacyPrefix, '') : ''
        const kidOriginalIds = new Set(legacyKids.map(t => t.id.replace(legacyPrefix, '')))
        const ganttKids = (project.ganttTareas ?? [])
          .filter(t => kidOriginalIds.has(t.id))
          .map(({ parentId: _p, ...rest }) => ({ ...rest }))
        const remaining = (project.ganttTareas ?? []).filter(t =>
          t.id !== phaseOriginalId && !kidOriginalIds.has(t.id)
        )
        // Crear proyecto con ganttTareas legacy
        batch.set(projRef, { id: projRef.id, ...baseP, tasksMigrated: false, ganttTareas: ganttKids, createdAt: isoNow, updatedAt: isoNow, _ts: serverTimestamp() })
        // Eliminar kids + fase del proyecto original
        batch.update(doc(db,'cmhub_proyectos',project.id), { ganttTareas: remaining, updatedAt: isoNow })
        // Mover modern kids (si hay mezcla legacy+modern), grupos y no-grupos
        for (const t of modernKids) {
          batch.update(doc(db,'hubActividades',t.id), { proyectoId: projRef.id, ...(t.parentId === phase.id ? { parentId: deleteField() } : {}) })
        }
        if (!isLegacyPhase) batch.delete(doc(db,'hubActividades',phase.id))
      } else {
        // Camino totalmente moderno (hubActividades): mover todos los descendientes
        batch.set(projRef, { id: projRef.id, ...baseP, tasksMigrated: true, createdAt: isoNow, updatedAt: isoNow, _ts: serverTimestamp() })
        for (const t of modernKids) {
          // Limpiar parentId solo si apuntaba directamente a la fase raíz (pasan a ser top-level del nuevo proyecto)
          batch.update(doc(db,'hubActividades',t.id), { proyectoId: projRef.id, ...(t.parentId === phase.id ? { parentId: deleteField() } : {}) })
        }
        batch.delete(doc(db,'hubActividades',phase.id))
      }

      await batch.commit()

      setConvertConfirm(null)
    } catch(e) { console.error('[convert]',e) }
    finally { setConverting(false) }
  }

  if(loadingActividades)return <p className="pw-notice" role="status">Cargando tareas…</p>
  const brand=brands.find(b=>b.id===project.brandId)
  return <><GanttChart proyecto={project} tasks={tasks} team={team} isDark={isDark} color={brand?.color||'#7c3aed'} brandName={brand?.name||''} canPlan={manager} canAdd={!project.archived&&!!authUser?.uid} canExecute={mine} currentUserId={authUser?.uid} initialMine={!manager} onSave={save} onConvertPhase={manager?(phase,kids)=>setConvertConfirm({phase,kids}):undefined}/>{manager&&archived.length>0&&<details className="pw-archive-panel"><summary><Archive size={13}/>Archivo<span className="pw-archive-count">{archived.length}</span></summary>{restoreError&&<p role="alert" className="pw-error" style={{margin:'0 16px 8px'}}>{restoreError}</p>}{archived.map(t=><div className="pw-archive-row" key={t.id}><span className="pw-archive-name">{t.nombre}</span><button className="pw-button pw-archive-restore" disabled={restoring} onClick={async()=>{setRestoring(true);setRestoreError('');try{const ids=descendants(t.id,archived);ids.add(t.id);let p=t.parentId;while(p&&!ids.has(p)){ids.add(p);p=archived.find(x=>x.id===p)?.parentId}await save([...tasks,...archived.filter(x=>ids.has(x.id)).map(x=>({...x,archived:false}))])}catch(e){setRestoreError(e instanceof Error?e.message:'No se pudo restaurar.')}finally{setRestoring(false)}}}>Restaurar</button></div>)}</details>}
  {convertConfirm&&<div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)'}} onClick={()=>!converting&&setConvertConfirm(null)}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] p-6" onClick={e=>e.stopPropagation()}><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:'#f5f3ff'}}><FolderKanban size={18} style={{color:'#7c3aed'}}/></div><div><h2 className="text-[16px] font-bold text-[#111827]">Crear proyecto independiente</h2><p className="text-[12px] text-[#9ca3af] mt-0.5">"{convertConfirm.phase.nombre}"</p></div><button onClick={()=>setConvertConfirm(null)} disabled={converting} className="ml-auto text-[#9ca3af] hover:text-[#111827] transition-colors"><X size={16}/></button></div><p className="text-[13px] text-[#6b7280] mb-5">Las <strong>{convertConfirm.kids.filter(t=>!t.isGroup).length} actividades</strong>{convertConfirm.kids.some(t=>t.isGroup)?` y ${convertConfirm.kids.filter(t=>t.isGroup).length} subfase${convertConfirm.kids.filter(t=>t.isGroup).length!==1?'s':''}`:''} de esta fase se moverán al nuevo proyecto y la fase se eliminará del Gantt actual.</p><div className="flex gap-2"><button onClick={()=>setConvertConfirm(null)} disabled={converting} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb] transition-colors disabled:opacity-40">Cancelar</button><button onClick={doConvert} disabled={converting} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-60" style={{background:'#7c3aed'}}>{converting?'Creando…':'Confirmar'}</button></div></div></div>}
  </>
}
