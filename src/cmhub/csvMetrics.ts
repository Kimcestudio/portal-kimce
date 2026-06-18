import type { Content, ContentMetrics, Network } from './types'

export type CsvPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin'

export interface ParsedMetricRow {
  rawDate?: string
  rawUrl?: string
  rawTitle?: string
  metrics: ContentMetrics
  confidence: 'url' | 'date' | 'none'
}

export interface MatchedRow {
  row: ParsedMetricRow
  content: Content | null
}

function normHeader(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Handles comma, semicolon, and tab delimiters; respects quoted fields
function parseCsvText(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM
  const cleaned = text.replace(/^﻿/, '')
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const firstLine = lines[0]
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','

  function splitLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = splitLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = splitLine(lines[i])
    if (vals.every(v => !v)) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (vals[idx] ?? '').replace(/^"|"$/g, '').trim()
    })
    rows.push(row)
  }

  return rows
}

function findCol(row: Record<string, string>, candidates: string[]): string | undefined {
  for (const key of Object.keys(row)) {
    const nKey = normHeader(key)
    for (const c of candidates) {
      if (nKey === c || nKey.includes(c)) return row[key] || undefined
    }
  }
  return undefined
}

function toNum(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = parseFloat(v.replace(/[%,\s]/g, ''))
  return isNaN(n) ? undefined : n
}

type ColMap = {
  date: string[]
  url: string[]
  title: string[]
  reach: string[]
  impressions: string[]
  likes: string[]
  comments: string[]
  shares: string[]
  saves: string[]
  clicks: string[]
  views: string[]
  engagementRate: string[]
}

const COLUMN_MAP: Record<CsvPlatform, ColMap> = {
  instagram: {
    date:          ['date', 'fecha', 'publish time', 'fecha publicación'],
    url:           ['permalink', 'post url', 'url', 'link'],
    title:         ['caption', 'post caption', 'descripción', 'title', 'texto'],
    reach:         ['reach', 'alcance'],
    impressions:   ['impressions', 'impresiones'],
    likes:         ['likes', 'me gusta', 'like count'],
    comments:      ['comments', 'comentarios', 'comment count'],
    shares:        ['shares', 'compartidos', 'veces compartido'],
    saves:         ['saves', 'guardados', 'saved'],
    clicks:        ['link clicks', 'clics en enlace', 'link_clicks', 'clicks'],
    views:         ['video views', 'plays', 'video plays', 'vistas'],
    engagementRate:['engagement rate', 'tasa de engagement'],
  },
  facebook: {
    date:          ['date', 'fecha', 'post created time'],
    url:           ['permalink', 'post url', 'url', 'link'],
    title:         ['message', 'caption', 'title', 'descripción', 'texto'],
    reach:         ['post reach', 'reach', 'alcance'],
    impressions:   ['post impressions', 'impressions', 'impresiones'],
    likes:         ['reactions', 'likes', 'me gusta', 'total reactions'],
    comments:      ['comments', 'comentarios'],
    shares:        ['shares', 'compartidos'],
    saves:         ['saves', 'guardados'],
    clicks:        ['post clicks', 'link clicks', 'clicks'],
    views:         ['video views', 'plays'],
    engagementRate:['engagement rate'],
  },
  tiktok: {
    date:          ['date posted', 'publish time', 'date', 'fecha'],
    url:           ['video link', 'url', 'link', 'permalink'],
    title:         ['video title', 'title', 'título', 'caption'],
    reach:         ['reach', 'alcance', 'unique viewers'],
    impressions:   ['impressions', 'impresiones'],
    likes:         ['net likes', 'likes', 'me gusta', 'total likes'],
    comments:      ['comments', 'comentarios'],
    shares:        ['shares', 'compartidos'],
    saves:         ['saves', 'guardados', 'favorited'],
    clicks:        ['clicks', 'clics', 'profile visits'],
    views:         ['video views', 'plays', 'views', 'vistas'],
    engagementRate:['engagement rate'],
  },
  linkedin: {
    date:          ['date', 'fecha', 'post date'],
    url:           ['post url', 'url', 'permalink', 'link'],
    title:         ['post text', 'caption', 'title', 'texto'],
    reach:         ['reach', 'alcance'],
    impressions:   ['impressions', 'impressions (organic)', 'impresiones'],
    likes:         ['reactions', 'reactions (organic)', 'likes', 'reacciones'],
    comments:      ['comments', 'comentarios'],
    shares:        ['shares', 'compartidos', 'reposts'],
    saves:         ['saves', 'guardados'],
    clicks:        ['clicks', 'clics', 'link clicks'],
    views:         ['video views', 'views'],
    engagementRate:['engagement rate', 'engagement rate (organic)', 'tasa de engagement'],
  },
}

export function parsePlatformCsv(text: string, platform: CsvPlatform): ParsedMetricRow[] {
  const rawRows = parseCsvText(text)
  const map = COLUMN_MAP[platform]

  return rawRows
    .map(row => {
      const rawDate = findCol(row, map.date)
      const rawUrl  = findCol(row, map.url)
      const rawTitle = findCol(row, map.title)

      const reach         = toNum(findCol(row, map.reach))
      const impressions   = toNum(findCol(row, map.impressions))
      const likes         = toNum(findCol(row, map.likes))
      const comments      = toNum(findCol(row, map.comments))
      const shares        = toNum(findCol(row, map.shares))
      const saves         = toNum(findCol(row, map.saves))
      const clicks        = toNum(findCol(row, map.clicks))
      const views         = toNum(findCol(row, map.views))
      const engagementRate = toNum(findCol(row, map.engagementRate))

      const metrics: ContentMetrics = {}
      if (reach !== undefined)         metrics.reach = reach
      if (impressions !== undefined)   metrics.impressions = impressions
      if (likes !== undefined)         metrics.likes = likes
      if (comments !== undefined)      metrics.comments = comments
      if (shares !== undefined)        metrics.shares = shares
      if (saves !== undefined)         metrics.saves = saves
      if (clicks !== undefined)        metrics.clicks = clicks
      if (views !== undefined)         metrics.views = views
      if (engagementRate !== undefined) metrics.engagementRate = engagementRate

      // Derive interactions if not explicit
      if (metrics.interactions === undefined) {
        const sum = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0)
        if (sum > 0) metrics.interactions = sum
      }

      return { rawDate, rawUrl, rawTitle, metrics, confidence: 'none' as const }
    })
    .filter(r => Object.keys(r.metrics).length > 0)
}

function normUrl(url: string): string {
  try {
    const u = new URL(url)
    return (u.hostname + u.pathname).replace(/\/$/, '').toLowerCase()
  } catch {
    return url.toLowerCase().replace(/\/$/, '')
  }
}

function normDate(s: string): string {
  if (!s) return ''
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  // DD/MM/YYYY or similar — assume DMY for Latin America
  const dmy = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return s
}

export function matchRows(rows: ParsedMetricRow[], contents: Content[]): MatchedRow[] {
  return rows.map(row => {
    // 1. URL match (most reliable)
    if (row.rawUrl) {
      const nUrl = normUrl(row.rawUrl)
      const found = contents.find(c => c.postUrl && normUrl(c.postUrl) === nUrl)
      if (found) return { row: { ...row, confidence: 'url' }, content: found }
    }

    // 2. Date match
    if (row.rawDate) {
      const rowDate = normDate(row.rawDate)
      const byDate = contents.filter(c => c.date === rowDate)
      if (byDate.length === 1) return { row: { ...row, confidence: 'date' }, content: byDate[0] }
      // Multiple same date → try title similarity
      if (byDate.length > 1 && row.rawTitle) {
        const rtl = row.rawTitle.toLowerCase()
        const byTitle = byDate.find(c =>
          c.title.toLowerCase().includes(rtl.slice(0, 20)) ||
          rtl.includes(c.title.toLowerCase().slice(0, 20))
        )
        if (byTitle) return { row: { ...row, confidence: 'date' }, content: byTitle }
      }
    }

    return { row: { ...row, confidence: 'none' }, content: null }
  })
}

export const PLATFORM_INSTRUCTIONS: Record<CsvPlatform, string> = {
  instagram: 'Meta Business Suite → Contenido → selecciona período → Exportar',
  facebook:  'Meta Business Suite → Insights → Publicaciones → Exportar',
  tiktok:    'TikTok Studio → Analytics → Contenido → Exportar datos',
  linkedin:  'LinkedIn Pages → Analíticas → Actualizaciones → Exportar',
}

export const PLATFORM_NETWORK: Record<CsvPlatform, Network> = {
  instagram: 'instagram',
  facebook:  'facebook',
  tiktok:    'tiktok',
  linkedin:  'linkedin',
}
