import { collection, doc, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore'
import { auth, db } from '@/services/firebase/client'
import type { HubActividad, Proyecto } from '../types'
import { fromActivity, legacyTasks, stripUndefined, toActivity, validate, type Task } from './domain'

export async function saveTasks(project: Proyecto, before: Task[], after: Task[]) {
  if (!navigator.onLine) throw new Error('Sin conexión. Conservamos tu borrador; vuelve a intentar cuando regreses a internet.')
  const error = validate(after); if (error) throw new Error(error)
  const old = new Map(before.map(t => [t.id, t])), next = new Map(after.map(t => [t.id, t]))
  const changed = after.filter(t => JSON.stringify(toActivity(t, project.id)) !== JSON.stringify(old.has(t.id) ? toActivity(old.get(t.id)!, project.id) : null))
  const removed = before.filter(t => !next.has(t.id))
  const migration = !project.tasksMigrated ? legacyTasks(project) : []
  const ids = [...new Set([...before, ...after, ...migration].map(t => t.id))]
  if (ids.length > 450 && migration.length) throw new Error('Este cronograma requiere una migración por lotes. No se modificaron los datos originales.')
  await runTransaction(db, async tx => {
    const ref = doc(db, 'cmhub_proyectos', project.id), snap = await tx.get(ref)
    if (!snap.exists() || snap.data().archived) throw new Error('El proyecto está archivado o ya no existe.')
    const snapshots = await Promise.all(ids.map(id => tx.get(doc(db, 'hubActividades', id))))
    const current = new Map(snapshots.filter(s => s.exists()).map(s => [s.id, fromActivity({ id: s.id, ...s.data() } as HubActividad)]))
    for (const t of changed) {
      const prev = old.get(t.id), live = current.get(t.id)
      if (prev && live) {
        const prevData = toActivity(prev, project.id), liveData = toActivity(live, project.id), newData = toActivity(t, project.id)
        for (const key of Object.keys(newData) as (keyof typeof newData)[]) {
          if (JSON.stringify(prevData[key]) !== JSON.stringify(newData[key]) && JSON.stringify(prevData[key]) !== JSON.stringify(liveData[key])) throw new Error(`Otra persona cambió «${t.nombre}». Cierra el editor, revisa la versión actual y vuelve a intentarlo.`)
        }
      } else if (prev && !live && snap.data().tasksMigrated) throw new Error('Una tarea ya no existe. Actualiza la vista.')
    }
    if ((removed.length || changed.some(t => t.parentId !== old.get(t.id)?.parentId || JSON.stringify(t.dependencies) !== JSON.stringify(old.get(t.id)?.dependencies))) && snap.data().taskRevision !== (project as Proyecto & {taskRevision?: number}).taskRevision) throw new Error('El cronograma cambió. Actualiza la vista antes de modificar su estructura.')
    const effective = new Map(current)
    if (!snap.data().tasksMigrated) for (const t of legacyTasks({ id: project.id, ...snap.data() } as Proyecto)) if (!effective.has(t.id)) effective.set(t.id, t)
    for (const t of changed) {
      const prev = old.get(t.id), live = effective.get(t.id)
      const patch = prev ? Object.fromEntries(Object.entries(t).filter(([key,value]) => JSON.stringify(value) !== JSON.stringify(prev[key as keyof Task]))) : t
      effective.set(t.id, { ...live, ...patch } as Task)
    }
    removed.forEach(t => effective.delete(t.id))
    const issue = validate([...effective.values()].filter(t => !t.archived)); if (issue) throw new Error(issue)
    if (!snap.data().tasksMigrated) for (const t of legacyTasks({ id: project.id, ...snap.data() } as Proyecto)) if (!current.has(t.id) && !removed.some(r => r.id === t.id)) tx.set(doc(db, 'hubActividades', t.id), stripUndefined({ ...toActivity(t, project.id), createdAt: serverTimestamp(), migratedFrom: t.id }))
    for (const t of changed) {
      const prev = old.get(t.id), newData = toActivity(t, project.id), prevData = prev ? toActivity(prev, project.id) : null
      const patch = prevData ? Object.fromEntries(Object.entries(newData).filter(([k,v]) => JSON.stringify(v) !== JSON.stringify(prevData[k as keyof typeof prevData]))) : newData
      tx.set(doc(db, 'hubActividades', t.id), { ...patch, completionSource: 'project-workspace', updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || '', ...(!current.has(t.id) ? { ...newData, createdAt: serverTimestamp() } : {}) }, { merge: true })
    }
    removed.forEach(t => tx.set(doc(db, 'hubActividades', t.id), { ...(!current.has(t.id) ? toActivity(t, project.id) : {}), archived: true, updatedAt: serverTimestamp() }, { merge: true }))
    tx.update(ref, { tasksMigrated: true, taskRevision: (snap.data().taskRevision || 0) + 1, updatedAt: new Date().toISOString() })
  })
}
export async function setSharing(project: Proyecto, enabled: boolean) {
  const token = enabled ? crypto.randomUUID() : ''
  const batch = writeBatch(db)
  if (project.shareToken) batch.delete(doc(db, 'projectShares', project.shareToken))
  if (token) batch.set(doc(db, 'projectShares', token), { projectId: project.id, createdAt: serverTimestamp() })
  batch.update(doc(db, 'cmhub_proyectos', project.id), { shareToken: token })
  await batch.commit(); return token
}
export function newTaskId() { return doc(collection(db, 'hubActividades')).id }

export async function migrateProject(project: Proyecto): Promise<void> {
  if (project.tasksMigrated) return
  const tasks = legacyTasks(project)
  if (!tasks.length) {
    const { updateDoc, doc: firestoreDoc } = await import('firebase/firestore')
    await updateDoc(firestoreDoc(db, 'cmhub_proyectos', project.id), { tasksMigrated: true, updatedAt: new Date().toISOString() })
    return
  }
  const asFull = tasks.map(t => ({ ...t, archived: false })) as Task[]
  await saveTasks(project, asFull, asFull)
}
