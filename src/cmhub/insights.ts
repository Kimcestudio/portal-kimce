import type { Content, Brand } from './types'
import { NETWORK_META } from './data'

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

export function generateInsights(contents: Content[], brand: Brand): string[] {
  const insights: string[] = []
  const published = contents.filter(c => c.status === 'publicado')
  const withMetrics = published.filter(c => c.metrics)

  if (withMetrics.length === 0) {
    insights.push('Aún no hay publicaciones con métricas registradas para este mes.')
    insights.push(`Se han planificado ${contents.length} contenido(s) en total para ${brand.name}.`)
  } else {
    // Best channel by engagement
    const byChannel: Record<string, number[]> = {}
    withMetrics.forEach(c => {
      if (c.metrics?.engagementRate) {
        byChannel[c.channel] = byChannel[c.channel] ?? []
        byChannel[c.channel].push(c.metrics.engagementRate)
      }
    })
    const channelRanked = Object.entries(byChannel)
      .map(([ch, rates]) => ({ ch, avg: avg(rates) }))
      .sort((a, b) => b.avg - a.avg)
    if (channelRanked[0]) {
      const label = NETWORK_META[channelRanked[0].ch]?.label ?? channelRanked[0].ch
      insights.push(`El canal con mayor engagement fue ${label} con ${channelRanked[0].avg.toFixed(1)}% promedio.`)
    }

    // Best format
    const byFormat: Record<string, number[]> = {}
    withMetrics.forEach(c => {
      if (c.metrics?.engagementRate) {
        byFormat[c.format] = byFormat[c.format] ?? []
        byFormat[c.format].push(c.metrics.engagementRate)
      }
    })
    const formatRanked = Object.entries(byFormat)
      .map(([fmt, rates]) => ({ fmt, avg: avg(rates) }))
      .sort((a, b) => b.avg - a.avg)
    if (formatRanked[0]) {
      insights.push(`El formato con mejor rendimiento fue ${formatRanked[0].fmt} (${formatRanked[0].avg.toFixed(1)}% eng. promedio).`)
    }

    // Total reach
    const totalReach = withMetrics.reduce((acc, c) => acc + (c.metrics?.reach ?? 0), 0)
    if (totalReach > 0) {
      insights.push(`Alcance total acumulado: ${totalReach.toLocaleString('es-ES')} personas únicas.`)
    }

    // Avg engagement overall
    const allRates = withMetrics.flatMap(c => c.metrics?.engagementRate ? [c.metrics.engagementRate] : [])
    if (allRates.length > 0) {
      insights.push(`Engagement promedio global del periodo: ${avg(allRates).toFixed(2)}%.`)
    }
  }

  // Pending approval
  const pendingApproval = contents.filter(c => ['revision', 'enviado', 'cambios'].includes(c.status))
  if (pendingApproval.length > 0) {
    insights.push(`${pendingApproval.length} contenido(s) pendiente(s) de aprobación del cliente.`)
  }

  // Overdue
  const today = new Date().toISOString().split('T')[0]
  const overdue = contents.filter(c => c.date && c.date < today && !['publicado', 'reportado'].includes(c.status))
  if (overdue.length > 0) {
    insights.push(`${overdue.length} publicación(es) con fecha vencida sin publicar.`)
  }

  // Ideas
  const ideas = contents.filter(c => c.status === 'idea')
  if (ideas.length > 0) {
    insights.push(`${ideas.length} idea(s) en cartera pendientes de desarrollar.`)
  }

  // Urgent
  const urgent = contents.filter(c => c.priority === 'urgente' && !['publicado', 'reportado'].includes(c.status))
  if (urgent.length > 0) {
    insights.push(`${urgent.length} contenido(s) marcados como urgentes requieren atención inmediata.`)
  }

  return insights
}

export function generateRecommendations(contents: Content[], _brand: Brand): string[] {
  const recs: string[] = []
  const published = contents.filter(c => c.status === 'publicado')

  if (published.length < 8) {
    recs.push('Aumentar la frecuencia de publicación para mejorar el alcance orgánico.')
  }

  if (!contents.some(c => c.format === 'Reel')) {
    recs.push('Incorporar Reels para aprovechar el mayor alcance orgánico de este formato.')
  }

  if (!contents.some(c => c.format === 'Carrusel')) {
    recs.push('Probar carruseles educativos: generan alto engagement y guardados.')
  }

  const changesRequested = contents.filter(c => c.approvalStatus === 'changes_requested')
  if (changesRequested.length > 0) {
    recs.push(`Atender los ${changesRequested.length} contenido(s) con cambios solicitados por el cliente.`)
  }

  recs.push('Mantener consistencia en el tono y estética visual para fortalecer el reconocimiento de marca.')
  recs.push('Planificar el mes siguiente con al menos 2 semanas de anticipación.')

  return recs
}
