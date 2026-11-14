// Constantes y helpers del sistema de puntos del CM Hub.

export const PUNTOS = {
  // Tareas diarias
  TAREA_COMPLETADA:          10,
  TAREA_A_TIEMPO:             5,  // bonus antes o exactamente en la fecha límite
  TAREA_AUTORRECLAMO:        10,
  // Actividades — 3 niveles de puntualidad
  ACTIVIDAD_COMPLETADA:      25,  // base siempre
  ACTIVIDAD_A_TIEMPO:        10,  // bonus: entregada ANTES del límite
  ACTIVIDAD_EN_FECHA:         5,  // bonus: entregada el mismo día límite ("justo a tiempo")
  ACTIVIDAD_AUTORRECLAMO:    25,
  // Iniciativas propias completadas
  INICIATIVA_COMPLETADA:     75,
  INICIATIVA_A_TIEMPO:       25,
  // Fichas para Slot Machine
  FICHAS_POR_SEMANA:          3,
} as const

/** Clasifica la puntualidad de una entrega en base a fechas ISO (YYYY-MM-DD). */
export type DeliveryTiming = 'early' | 'on_time' | 'late'

export function classifyDelivery(completedAtISO: string, dueDate?: string | null): DeliveryTiming {
  if (!dueDate) return 'late'
  const day = completedAtISO.slice(0, 10)
  if (day < dueDate) return 'early'
  if (day === dueDate) return 'on_time'
  return 'late'
}

export function pointsForDelivery(timing: DeliveryTiming, base = PUNTOS.ACTIVIDAD_COMPLETADA): number {
  if (timing === 'early')   return base + PUNTOS.ACTIVIDAD_A_TIEMPO
  if (timing === 'on_time') return base + PUNTOS.ACTIVIDAD_EN_FECHA
  return base
}

export const DELIVERY_META: Record<DeliveryTiming, { label: string; color: string; bg: string; emoji: string }> = {
  early:   { label: 'Antes de fecha', emoji: '🚀', color: '#16a34a', bg: 'rgba(22,163,74,0.12)'   },
  on_time: { label: 'En el límite',   emoji: '⚡', color: '#d97706', bg: 'rgba(217,119,6,0.12)'   },
  late:    { label: 'Con retraso',    emoji: '⏰', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
}

export const BOT_AVATAR = {
  autor:         'Portal KIMCE',
  autorInitials: '⚡',
  autorColor:    '#7c3aed',
} as const

// Plantillas de mensajes para La Sala
export function botMsg(event: BotEvent, data: BotData): string {
  switch (event) {
    case 'tarea_completada':
      return `✅ *${data.quien}* completó "${data.titulo}" — +${data.puntos} pts`
    case 'tarea_a_tiempo':
      return `🎯 *${data.quien}* entregó "${data.titulo}" a tiempo — +${data.puntos} pts`
    case 'actividad_completada':
      return `🚀 *${data.quien}* completó la actividad "${data.titulo}" — +${data.puntos} pts`
    case 'actividad_reclamada':
      return `💪 *${data.quien}* se puso en "${data.titulo}"`
    case 'quick_assign':
      return `⚡ *${data.quien}* le asignó a *${data.destino}*: "${data.titulo}"`
    case 'puntos_milestone':
      return `🏆 *${data.quien}* alcanzó ${data.puntos} puntos — ¡sigue así!`
    default:
      return `📣 ${data.titulo}`
  }
}

export type BotEvent =
  | 'tarea_completada'
  | 'tarea_a_tiempo'
  | 'actividad_completada'
  | 'actividad_reclamada'
  | 'quick_assign'
  | 'puntos_milestone'

export interface BotData {
  quien: string
  titulo: string
  puntos?: number
  destino?: string
}

// Milestones de puntos que generan mensaje especial en La Sala
export const MILESTONES = [100, 250, 500, 1000, 2500]

export function checkMilestone(antes: number, despues: number): number | null {
  for (const m of MILESTONES) {
    if (antes < m && despues >= m) return m
  }
  return null
}
