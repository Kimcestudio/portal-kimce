'use client'
import { useState, useEffect } from 'react'
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { Database, Trash2, CheckCircle, AlertCircle, Loader, Video, Save } from 'lucide-react'
import { db } from '@/services/firebase/client'
import { useHub } from '@/cmhub/context'
import { useAuth } from '@/components/auth/AuthProvider'
import type { Proyecto, GanttTarea } from '@/cmhub/types'
import { subscribeSalasConfig, saveSalasConfig, SALA_LABELS, type SalasConfig } from '@/services/presence'

type MigrationResult = { proyectoId: string; nombre: string; tasks: number; error?: string }

async function migrateProject(project: Proyecto): Promise<MigrationResult> {
  const gantt = project.ganttTareas ?? []
  if (gantt.length === 0) return { proyectoId: project.id, nombre: project.nombre, tasks: 0 }

  // Paso 1: pre-generar IDs para poder reasignar parentId antes de escribir
  const idMap = new Map<string, string>()
  const refs = gantt.map((t: GanttTarea) => {
    const ref = doc(collection(db, 'hubActividades'))
    idMap.set(t.id, ref.id)
    return ref
  })

  // Paso 2: construir docs con parentId ya remapeado
  const entries = gantt.map((t: GanttTarea, i: number) => ({
    ref: refs[i],
    data: {
      title: t.nombre || '',
      proyectoId: project.id,
      startDate: t.fechaInicio || '',
      dueDate: t.fechaFin || '',
      status: t.estado,
      progress: t.avance ?? 0,
      assignee: t.responsable || '',
      assignees: t.responsable ? [t.responsable] : [],
      assigneeIds: [] as string[],
      parentId: t.parentId ? (idMap.get(t.parentId) ?? '') : '',
      isGroup: t.isGroup ?? false,
      milestone: false,
      description: '',
      dependencies: [] as string[],
      blockedReason: '',
      effortHours: 0,
      archived: false,
      sortOrder: i,
      createdAt: serverTimestamp(),
      _migratedFrom: 'ganttTareas',
    },
  }))

  // Paso 3: escritura en batches de 490 (límite Firestore = 500 ops)
  let batch = writeBatch(db)
  let ops = 0

  for (const { ref, data } of entries) {
    batch.set(ref, data)
    ops++
    if (ops === 490) { await batch.commit(); batch = writeBatch(db); ops = 0 }
  }

  // En el último batch: marcar el proyecto como migrado
  batch.update(doc(db, 'cmhub_proyectos', project.id), {
    tasksMigrated: true,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()

  return { proyectoId: project.id, nombre: project.nombre, tasks: entries.length }
}

async function cleanupProject(project: Proyecto): Promise<void> {
  await writeBatch(db)
    .update(doc(db, 'cmhub_proyectos', project.id), { ganttTareas: [], updatedAt: serverTimestamp() })
    .commit()
}

export default function AdminSettingsPage() {
  const { proyectos, loadingProyectos } = useHub()
  const { profile } = useAuth()
  const [running, setRunning] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [results, setResults] = useState<MigrationResult[] | null>(null)

  // ── Salas config ──
  const [salas, setSalas] = useState<SalasConfig>({ general: '', diseno: '', cm: '', estrategia: '', audiovisual: '' })
  const [salasSaving, setSalasSaving] = useState(false)
  const [salasSaved, setSalasSaved]   = useState(false)
  useEffect(() => subscribeSalasConfig(setSalas), [])
  async function handleSaveSalas() {
    setSalasSaving(true)
    await saveSalasConfig(salas)
    setSalasSaving(false); setSalasSaved(true); setTimeout(() => setSalasSaved(false), 2500)
  }

  if (profile?.role !== 'admin') {
    return <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]"><p className="text-sm text-slate-500">Solo administradores.</p></div>
  }

  const legacyProjects = proyectos.filter(p => !p.tasksMigrated && (p.ganttTareas?.length ?? 0) > 0)
  const migratedWithData = proyectos.filter(p => p.tasksMigrated && (p.ganttTareas?.length ?? 0) > 0)

  async function runMigration() {
    setRunning(true)
    setResults(null)
    const out: MigrationResult[] = []
    for (const p of legacyProjects) {
      try {
        out.push(await migrateProject(p))
      } catch (e) {
        out.push({ proyectoId: p.id, nombre: p.nombre, tasks: 0, error: e instanceof Error ? e.message : 'Error desconocido' })
      }
    }
    setResults(out)
    setRunning(false)
  }

  async function runCleanup() {
    setCleaning(true)
    for (const p of migratedWithData) {
      try { await cleanupProject(p) } catch { /* ignore */ }
    }
    setCleaning(false)
  }

  const totalLegacyTasks = legacyProjects.reduce((s, p) => s + (p.ganttTareas?.length ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">

      {/* Links de salas virtuales por área */}
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex items-center gap-3 mb-1">
          <Video size={16} className="text-violet-600 shrink-0" />
          <h2 className="text-base font-semibold text-slate-900">Salas virtuales (Google Meet)</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5 ml-7">
          Links permanentes de Google Meet por área. Cada sala aparece en el tab Presencia de La Sala con un botón para unirse.
        </p>
        <div className="ml-7 grid grid-cols-2 gap-3">
          {(Object.keys(SALA_LABELS) as Array<keyof SalasConfig>).map(key => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">{SALA_LABELS[key]}</label>
              <input
                type="url"
                value={salas[key]}
                onChange={e => setSalas(s => ({ ...s, [key]: e.target.value }))}
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-violet-400 transition-colors"
              />
            </div>
          ))}
        </div>
        <div className="ml-7 mt-4">
          <button onClick={handleSaveSalas} disabled={salasSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 cursor-pointer transition-colors"
            style={{ background: salasSaved ? '#16a34a' : '#7c3aed' }}>
            {salasSaving ? <Loader size={14} className="animate-spin" /> : salasSaved ? <CheckCircle size={14} /> : <Save size={14} />}
            {salasSaved ? 'Guardado' : 'Guardar links'}
          </button>
        </div>
      </div>

      {/* Migración ganttTareas → hubActividades */}
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex items-center gap-3 mb-1">
          <Database size={16} className="text-violet-600 shrink-0" />
          <h2 className="text-base font-semibold text-slate-900">Migración de tareas legacy</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5 ml-7">
          Convierte los proyectos que aún almacenan tareas en <code className="bg-slate-100 px-1 rounded">ganttTareas[]</code> (sistema antiguo) al sistema moderno <code className="bg-slate-100 px-1 rounded">hubActividades</code>. Sin esto, operaciones como "convertir fase a proyecto" pueden fallar silenciosamente.
        </p>

        {loadingProyectos ? (
          <p className="text-xs text-slate-400 ml-7">Cargando proyectos…</p>
        ) : legacyProjects.length === 0 ? (
          <div className="flex items-center gap-2 ml-7 text-emerald-600 text-sm font-medium">
            <CheckCircle size={15} /> Todos los proyectos usan el sistema moderno.
          </div>
        ) : (
          <div className="ml-7">
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <strong>{legacyProjects.length} proyecto{legacyProjects.length !== 1 ? 's' : ''}</strong> con <strong>{totalLegacyTasks} tareas</strong> en formato legacy:
              <ul className="mt-2 space-y-0.5">
                {legacyProjects.map(p => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.nombre}</span>
                    <span className="font-mono">{p.ganttTareas?.length ?? 0} tareas</span>
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={runMigration}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors"
              style={{ background: '#7c3aed' }}
            >
              {running ? <><Loader size={14} className="animate-spin" /> Migrando…</> : 'Migrar ahora'}
            </button>
          </div>
        )}

        {results && (
          <div className="ml-7 mt-4 space-y-1.5">
            {results.map(r => (
              <div key={r.proyectoId} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${r.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {r.error ? <AlertCircle size={13} /> : <CheckCircle size={13} />}
                <span className="font-medium">{r.nombre}</span>
                {r.error ? <span>— {r.error}</span> : <span>— {r.tasks} tareas migradas</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Limpieza de ganttTareas residuales */}
      {migratedWithData.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <div className="flex items-center gap-3 mb-1">
            <Trash2 size={16} className="text-slate-500 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900">Limpieza de datos residuales</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4 ml-7">
            {migratedWithData.length} proyecto{migratedWithData.length !== 1 ? 's' : ''} ya migrado{migratedWithData.length !== 1 ? 's' : ''} pero aún conservan el campo <code className="bg-slate-100 px-1 rounded">ganttTareas</code>. Eliminar ese campo no afecta ninguna funcionalidad.
          </p>
          <button
            onClick={runCleanup}
            disabled={cleaning}
            className="ml-7 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            {cleaning ? <><Loader size={14} className="animate-spin" /> Limpiando…</> : 'Limpiar campos residuales'}
          </button>
        </div>
      )}

    </div>
  )
}
