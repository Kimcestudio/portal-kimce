// Helpers compartidos entre NotificationBell (campanita) y NotificationsModal (vista ampliada).
import type { AppNotification } from './types'

export type NotifGroup = 'Actividad' | 'Contenidos' | 'Comentarios' | 'Vencidos' | 'Solicitudes'

export const GROUP_COLOR: Record<NotifGroup, string> = {
  Actividad:   '#0d9488',
  Contenidos:  '#6366f1',
  Comentarios: '#ec4899',
  Vencidos:    '#ef4444',
  Solicitudes: '#7c3aed',
}

export function notifGroup(n: Pick<AppNotification, 'type'>): NotifGroup {
  if (n.type === 'task_overdue' || n.type === 'activity_overdue') return 'Vencidos'
  if (n.type === 'activity_new' || n.type === 'call_incoming') return 'Actividad'
  if (n.type === 'content_comment_new') return 'Comentarios'
  if (n.type === 'content_request_new') return 'Solicitudes'
  return 'Contenidos'
}

export function timeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

export function toDate(createdAt: unknown): Date {
  if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
    return (createdAt as { toDate: () => Date }).toDate()
  }
  return new Date()
}
