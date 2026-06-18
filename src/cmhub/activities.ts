import type { HubActividad } from './types'

type ActividadAssigneeFields = Pick<HubActividad, 'assignee' | 'assignees'>

export function getActividadAssignees(a: ActividadAssigneeFields): string[] {
  if (a.assignees?.length) return a.assignees
  return a.assignee ? [a.assignee] : []
}

export function actividadHasAssignee(a: ActividadAssigneeFields, name: string): boolean {
  const target = name.trim().toLowerCase()
  return getActividadAssignees(a).some((n) => n.trim().toLowerCase() === target)
}
