'use client'
import { useState } from 'react'
import GanttChart from '@/components/cmhub/GanttChart'
import type { Task } from '@/cmhub/projects/domain'
import type { Proyecto, TeamMember } from '@/cmhub/types'
const initial: Task[] = [
{id:'phase',nombre:'Estrategia y planificación',fechaInicio:'2026-09-28',fechaFin:'2026-10-08',avance:0,estado:'pendiente',isGroup:true},
{id:'research',parentId:'phase',nombre:'Investigación de audiencia',fechaInicio:'2026-09-28',fechaFin:'2026-09-30',avance:100,estado:'completado',responsable:'Ana Torres',assigneeIds:['ana'],effortHours:8},
{id:'concept',parentId:'phase',nombre:'Concepto de campaña',fechaInicio:'2026-10-01',fechaFin:'2026-10-06',avance:40,estado:'en_curso',responsable:'Diego Ruiz',assigneeIds:['diego'],dependencies:['research'],effortHours:12},
{id:'approval',parentId:'phase',nombre:'Aprobación de estrategia',fechaInicio:'2026-10-07',fechaFin:'2026-10-07',avance:0,estado:'pendiente',milestone:true,dependencies:['concept']},
{id:'design',nombre:'Diseño y producción',fechaInicio:'2026-10-08',fechaFin:'2026-10-20',avance:0,estado:'pendiente',isGroup:true},
{id:'pieces',parentId:'design',nombre:'Diseño de piezas para redes sociales',fechaInicio:'2026-10-08',fechaFin:'2026-10-14',avance:0,estado:'pendiente',responsable:'Ana Torres',assigneeIds:['ana'],dependencies:['approval'],effortHours:16},
{id:'delivery',parentId:'design',nombre:'Revisión y entrega al cliente',fechaInicio:'2026-10-15',fechaFin:'2026-10-20',avance:0,estado:'pendiente',responsable:'Diego Ruiz',assigneeIds:['diego'],dependencies:['pieces'],effortHours:4},
]
export default function Demo(){const [tasks,setTasks]=useState(initial),[dark,setDark]=useState(false),[fail,setFail]=useState(false);const p={id:'demo',nombre:'Lanzamiento de campaña',brandId:'demo',estado:'activo',avance:0,fechaInicio:'2026-09-28',fechaFin:'2026-10-20',responsable:'Ana Torres',createdAt:'',updatedAt:''} as Proyecto;const team=[{id:'ana',name:'Ana Torres'},{id:'diego',name:'Diego Ruiz'}] as TeamMember[];return <main className="project-work pw-shell" data-dark={dark} style={{minHeight:'100vh'}}><div className="pw-heading"><div><h1>Lanzamiento de campaña</h1><p className="pw-muted">Datos de demostración · no se envían a Firebase</p></div><div className="pw-toolbar"><button className="pw-button" onClick={()=>setDark(!dark)}>Cambiar tema de prueba</button><label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/> Simular error de guardado</label></div></div><GanttChart proyecto={p} tasks={tasks} team={team} isDark={dark} color="#6d28d9" brandName="Cliente de demostración" onSave={async next=>{if(fail)throw new Error('Error simulado. Tu borrador se conserva.');setTasks(next)}}/></main>}
