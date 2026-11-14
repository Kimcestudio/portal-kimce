import type { HubActividad } from './types'

// Categorías seleccionables al crear o editar una actividad. 'Reunión' y 'Llamada' se quitaron
// a pedido del equipo, pero las actividades antiguas que ya las tengan asignadas conservan el dato
// — solo dejan de poder elegirse de nuevo. Las vistas de filtro siguen usando la lista completa
// (incluyendo 'Reunión'/'Llamada') para que esas actividades antiguas sigan siendo encontrables.
export const ACTIV_CATEGORIES = [
  'Entrega', 'Revisión', 'Diseño',
  'Edición', 'Estrategia', 'Investigación', 'Otro',
]

type ActividadAssigneeFields = Pick<HubActividad, 'assignee' | 'assignees'>

export function getActividadAssignees(a: ActividadAssigneeFields): string[] {
  if (a.assignees?.length) return a.assignees
  return a.assignee ? [a.assignee] : []
}

export function actividadHasAssignee(a: ActividadAssigneeFields, name: string): boolean {
  const target = name.trim().toLowerCase()
  return getActividadAssignees(a).some((n) => n.trim().toLowerCase() === target)
}
