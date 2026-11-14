import type { GanttTarea, HubActividad, Proyecto } from '../types'
export type Task = GanttTarea & {
  description?: string; assigneeIds?: string[]; assignees?: string[]; dependencies?: string[];
  milestone?: boolean; blockedReason?: string; effortHours?: number; archived?: boolean; sortOrder?: number;
}
export const STATUS = { pendiente: 'Pendiente', en_curso: 'En curso', completado: 'Completado' } as const
export const STATUS_COLORS = {
  pendiente:  { label: 'Pendiente',  color: '#d97706', bg: '#fef3c7', darkBg: 'rgba(217,119,6,0.2)',  dot: '#f59e0b' },
  en_curso:   { label: 'En curso',   color: '#2563eb', bg: '#dbeafe', darkBg: 'rgba(37,99,235,0.2)',  dot: '#3b82f6' },
  completado: { label: 'Completado', color: '#16a34a', bg: '#dcfce7', darkBg: 'rgba(22,163,74,0.2)',  dot: '#22c55e' },
} as const
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
export function validDate(s?: string): s is string { return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s }
export function addDays(s: string, n: number) { if (!validDate(s)) return ''; return new Date(Date.parse(s + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10) }
export function days(a: string, b: string) { return validDate(a) && validDate(b) ? Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000) : 0 }
export function duration(t: Task, workdays?: number[]) { if (!validDate(t.fechaInicio) || !validDate(t.fechaFin)) return 0; if (!workdays?.length) return days(t.fechaInicio, t.fechaFin) + 1; let n = 0; for (let d = t.fechaInicio; d <= t.fechaFin; d = addDays(d, 1)) if (workdays.includes(new Date(d + 'T12:00:00Z').getUTCDay())) n++; return n }
export function progress(t: Task) { return t.estado === 'completado' ? 100 : t.estado === 'pendiente' ? 0 : Math.min(99, Math.max(0, t.avance || 0)) }
export function legacyTasks(p: Proyecto): Task[] { return (p.ganttTareas ?? []).map(t => ({ ...t, id: `legacy_${p.id}_${t.id}`, ...(t.parentId ? { parentId: `legacy_${p.id}_${t.parentId}` } : { parentId: '' }) })) }
export function fromActivity(a: HubActividad): Task {
  return { id: a.id, nombre: a.title, fechaInicio: a.startDate || a.dueDate || '', fechaFin: a.dueDate || '', estado: a.status,
    avance: progress({ estado: a.status, avance: a.progress ?? 0 } as Task), responsable: a.assignee || a.assignees?.[0] || '',
    assignees: a.assignees || (a.assignee ? [a.assignee] : []), assigneeIds: a.assigneeIds || [], parentId: a.parentId || '',
    isGroup: !!a.isGroup, milestone: !!a.milestone, description: a.description || '', dependencies: a.dependencies || [],
    blockedReason: a.blockedReason || '', effortHours: a.effortHours || 0, archived: !!a.archived, sortOrder: a.sortOrder ?? 999999 }
}
export function toActivity(t: Task, projectId: string) {
  return { title: t.nombre.trim(), proyectoId: projectId, startDate: t.fechaInicio, dueDate: t.fechaFin, status: t.estado,
    progress: progress(t), assignee: t.responsable || '', assignees: t.assignees || (t.responsable ? [t.responsable] : []), assigneeIds: t.assigneeIds || [],
    parentId: t.parentId || '', isGroup: !!t.isGroup, milestone: !!t.milestone, description: t.description || '', dependencies: t.dependencies || [],
    blockedReason: t.blockedReason || '', effortHours: t.effortHours || 0, archived: !!t.archived, sortOrder: t.sortOrder ?? 999999 }
}
export function projectTasks(p: Proyecto, activities: HubActividad[]): Task[] {
  const own = activities.filter(a => a.proyectoId === p.id).map(fromActivity)
  const ids = new Set(own.map(t => t.id))
  const all = [...own, ...(!p.tasksMigrated ? legacyTasks(p).filter(t => !ids.has(t.id)) : [])].filter(t => !t.archived)
  if (all.some(t => (t.sortOrder ?? 999999) < 999999)) all.sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999))
  return all
}
export function descendants(id: string, tasks: Task[]): Set<string> { const result = new Set<string>(); const queue = [id]; while (queue.length) { const p = queue.pop()!; for (const t of tasks) if (t.parentId === p && !result.has(t.id) && t.id !== id) { result.add(t.id); queue.push(t.id) } } return result }
export function effective(t: Task, tasks: Task[]): Task {
  if (!t.isGroup) return { ...t, avance: progress(t) }
  const ids = descendants(t.id, tasks); const leaves = tasks.filter(x => ids.has(x.id) && !x.isGroup && !x.archived)
  if (!leaves.length) return { ...t, avance: 0, estado: 'pendiente' }
  const starts = leaves.map(x => x.fechaInicio).filter(validDate).sort(), ends = leaves.map(x => x.fechaFin).filter(validDate).sort()
  const avance = Math.round(leaves.reduce((s, x) => s + progress(x), 0) / leaves.length)
  return { ...t, fechaInicio: starts[0] || '', fechaFin: ends[ends.length - 1] || '', avance, estado: avance === 100 ? 'completado' : leaves.some(x => x.estado !== 'pendiente') ? 'en_curso' : 'pendiente' }
}
export function projectProgress(tasks: Task[]) { const leaves = tasks.filter(t => !t.isGroup && !t.archived); return leaves.length ? Math.round(leaves.reduce((s, t) => s + progress(t), 0) / leaves.length) : 0 }
export function ordered(tasks: Task[], collapsed = new Set<string>()): { task: Task; depth: number }[] {
  const out: {task: Task; depth: number}[] = [], seen = new Set<string>(), ids = new Set(tasks.map(t => t.id))
  function visit(t: Task, depth: number) { if (seen.has(t.id)) return; seen.add(t.id); out.push({task: t, depth}); if (!collapsed.has(t.id)) tasks.filter(c => c.parentId === t.id).forEach(c => visit(c, depth + 1)) }
  tasks.filter(t => !t.parentId || !ids.has(t.parentId)).forEach(t => visit(t, 0))
  // Corrupt legacy cycles remain discoverable rather than silently disappearing.
  tasks.filter(t => !seen.has(t.id) && !tasks.some(p => collapsed.has(p.id) && descendants(p.id, tasks).has(t.id))).forEach(t => visit(t, 0))
  return out
}
export function validate(tasks: Task[]): string | null {
  const map = new Map(tasks.map(t => [t.id, t])); if (map.size !== tasks.length) return 'Hay identificadores de tarea duplicados.'
  for (const t of tasks) {
    if (!t.nombre.trim()) return 'Escribe el nombre de cada tarea.'
    if (t.fechaInicio || t.fechaFin) { if (!validDate(t.fechaInicio) || !validDate(t.fechaFin)) return `Completa ambas fechas de «${t.nombre}».`; if (t.fechaFin < t.fechaInicio) return `El fin de «${t.nombre}» no puede ser anterior al inicio.` }
    if (t.milestone && t.fechaInicio !== t.fechaFin) return 'Un hito debe comenzar y terminar el mismo día.'
    if ((t.effortHours ?? 0) < 0 || !Number.isFinite(t.effortHours ?? 0)) return 'El esfuerzo debe ser un número positivo.'
    const seen = new Set([t.id]); let p = t.parentId
    while (p) { if (seen.has(p)) return 'La jerarquía contiene un ciclo.'; seen.add(p); const parent = map.get(p); if (!parent || !parent.isGroup) break; p = parent.parentId }
    for (const id of t.dependencies || []) { const dep = map.get(id); if (!dep || dep.isGroup || t.isGroup || id === t.id) return 'Selecciona una dependencia válida entre tareas.'; if (validDate(dep.fechaFin) && validDate(t.fechaInicio) && t.fechaInicio <= dep.fechaFin) return `«${t.nombre}» debe comenzar después de «${dep.nombre}».` }
  }
  const done = new Set<string>(), stack = new Set<string>()
  function cycle(id: string): boolean { if (stack.has(id)) return true; if (done.has(id)) return false; stack.add(id); if ((map.get(id)?.dependencies || []).some(cycle)) return true; stack.delete(id); done.add(id); return false }
  return tasks.some(t => cycle(t.id)) ? 'Las dependencias contienen un ciclo.' : null
}
export function moveTask(tasks: Task[], id: string, offset: number, resize = false): Task[] {
  const root = tasks.find(t => t.id === id); if (!root) return tasks
  const ids = root.isGroup ? descendants(id, tasks) : new Set([id])
  return tasks.map(t => ids.has(t.id) ? { ...t, fechaInicio: resize ? t.fechaInicio : addDays(t.fechaInicio, offset), fechaFin: addDays(t.fechaFin, offset) } : t)
}
export function safeUrl(value: string) { try { const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? url.href : null } catch { return null } }
export function stripUndefined<T>(value: T): T { if (Array.isArray(value)) return value.map(v => v === undefined ? null : stripUndefined(v)) as T; if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k,stripUndefined(v)])) as T; return value }

// Reverse only this user's operation, never somebody else's newly arrived tasks.
export function undoChange(current: Task[], before: Task[], after: Task[]): Task[] {
  const result = new Map(current.map(t => [t.id, t])), prev = new Map(before.map(t => [t.id,t])), next = new Map(after.map(t => [t.id,t]))
  for (const t of after) {
    const old = prev.get(t.id), live = result.get(t.id)
    if (!old) { if (live && JSON.stringify(toActivity(live,'')) !== JSON.stringify(toActivity(t,''))) throw new Error('Otra persona modificó la tarea. No se puede deshacer automáticamente.'); result.delete(t.id); continue }
    const keys = (Object.keys(t) as (keyof Task)[]).filter(k => JSON.stringify(t[k]) !== JSON.stringify(old[k]))
    if (!keys.length) continue
    if (!live || keys.some(k => JSON.stringify(live[k]) !== JSON.stringify(t[k]))) throw new Error('Hay cambios posteriores. Revisa la tarea antes de deshacer.')
    result.set(t.id, { ...live, ...Object.fromEntries(keys.map(k=>[k,old[k]])) })
  }
  for (const t of before) if (!next.has(t.id)) { if(result.has(t.id)) throw new Error('La tarea ya fue restaurada.'); result.set(t.id,t) }
  return [...result.values()]
}
