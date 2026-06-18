import type { Content, Brand } from './types'
import { NETWORK_META, STATUS_META } from './data'
import { generateInsights, generateRecommendations } from './insights'

function download(content: string, filename: string, mime: string) {
  const blob = new Blob(['﻿' + content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function exportCSV(contents: Content[], brand: Brand): void {
  const headers = [
    'Título', 'Canal', 'Formato', 'Estado', 'Prioridad', 'Fecha', 'Hora',
    'Responsable', 'Campaña', 'Copy', 'CTA', 'Hashtags',
    'URL Diseño', 'URL Drive', 'URL Publicación',
    'Aprobación', 'Aprobado por', 'Fecha aprobación',
    'Alcance', 'Impresiones', 'Interacciones', 'Likes',
    'Comentarios', 'Compartidos', 'Guardados', 'Clics', 'Reproducciones',
    'Engagement Rate (%)', 'Observaciones métricas',
  ]

  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const rows = contents.map(c => [
    c.title, NETWORK_META[c.channel]?.label ?? c.channel, c.format,
    STATUS_META[c.status]?.label ?? c.status, c.priority,
    c.date ?? '', c.time ?? '', c.responsible, c.campaign ?? '',
    c.copy, c.cta ?? '', c.hashtags ?? '',
    c.designUrl ?? '', c.driveUrl ?? '', c.postUrl ?? '',
    c.approvalStatus, c.approvedBy ?? '', c.approvedAt ?? '',
    c.metrics?.reach ?? '', c.metrics?.impressions ?? '',
    c.metrics?.interactions ?? '', c.metrics?.likes ?? '',
    c.metrics?.comments ?? '', c.metrics?.shares ?? '',
    c.metrics?.saves ?? '', c.metrics?.clicks ?? '', c.metrics?.views ?? '',
    c.metrics?.engagementRate ?? '', c.metrics?.performanceNotes ?? '',
  ].map(escape).join(','))

  const date = new Date().toISOString().split('T')[0]
  download([headers.map(escape).join(','), ...rows].join('\n'), `kimce-${slugify(brand.name)}-${date}.csv`, 'text/csv')
}

export async function exportExcel(contents: Content[], brand: Brand): Promise<void> {
  const XLSX = await import('xlsx')

  const data = contents.map(c => ({
    'Título': c.title,
    'Canal': NETWORK_META[c.channel]?.label ?? c.channel,
    'Formato': c.format,
    'Estado': STATUS_META[c.status]?.label ?? c.status,
    'Prioridad': c.priority,
    'Fecha': c.date ?? '',
    'Hora': c.time ?? '',
    'Responsable': c.responsible,
    'Campaña': c.campaign ?? '',
    'Copy': c.copy,
    'CTA': c.cta ?? '',
    'Hashtags': c.hashtags ?? '',
    'URL Diseño': c.designUrl ?? '',
    'URL Drive': c.driveUrl ?? '',
    'URL Publicación': c.postUrl ?? '',
    'Estado aprobación': c.approvalStatus,
    'Aprobado por': c.approvedBy ?? '',
    'Fecha aprobación': c.approvedAt ?? '',
    'Alcance': c.metrics?.reach ?? '',
    'Impresiones': c.metrics?.impressions ?? '',
    'Interacciones': c.metrics?.interactions ?? '',
    'Likes': c.metrics?.likes ?? '',
    'Comentarios': c.metrics?.comments ?? '',
    'Compartidos': c.metrics?.shares ?? '',
    'Guardados': c.metrics?.saves ?? '',
    'Clics': c.metrics?.clicks ?? '',
    'Reproducciones': c.metrics?.views ?? '',
    'Engagement Rate (%)': c.metrics?.engagementRate ?? '',
    'Notas métricas': c.metrics?.performanceNotes ?? '',
    'Observaciones internas': c.internalNotes ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = Object.keys(data[0] ?? {}).map(k => ({ wch: Math.max(k.length + 2, 14) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Contenidos')

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `kimce-${slugify(brand.name)}-${date}.xlsx`)
}

export function openPrintReport(brand: Brand, contents: Content[]): void {
  const insights = generateInsights(contents, brand)
  const recs = generateRecommendations(contents, brand)
  const published = contents.filter(c => c.status === 'publicado')
  const month = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe ${brand.name} — ${month}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; color: #111827; background: #fff; padding: 48px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 20px; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #7c3aed; }
  .brand-avatar { width: 56px; height: 56px; border-radius: 16px; background: ${brand.color}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; flex-shrink: 0; }
  .brand-info h1 { font-size: 24px; font-weight: 800; }
  .brand-info p { color: #6b7280; font-size: 13px; margin-top: 4px; }
  .agency { margin-left: auto; text-align: right; }
  .agency strong { display: block; font-size: 14px; color: #7c3aed; font-weight: 700; }
  .agency small { color: #9ca3af; font-size: 12px; }
  h2 { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f3f4f6; }
  section { margin-bottom: 32px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
  .stat { background: #f8fafc; border-radius: 12px; padding: 16px; }
  .stat .val { font-size: 28px; font-weight: 800; color: #111827; }
  .stat .lbl { font-size: 11px; color: #9ca3af; margin-top: 2px; }
  ul { padding-left: 18px; }
  ul li { font-size: 13px; color: #374151; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f8fafc; padding: 8px 10px; text-align: left; font-weight: 700; color: #6b7280; text-transform: uppercase; font-size: 10px; letter-spacing: .05em; border-bottom: 1px solid #e5e7eb; }
  td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand-avatar">${brand.initials}</div>
  <div class="brand-info">
    <h1>${brand.name}</h1>
    <p>${brand.industry} · ${brand.country} · Informe ${month}</p>
  </div>
  <div class="agency">
    <strong>Kimce Studio</strong>
    <small>kimcestudio.com</small>
  </div>
</div>

<div class="stats">
  <div class="stat"><div class="val">${contents.length}</div><div class="lbl">Contenidos totales</div></div>
  <div class="stat"><div class="val">${published.length}</div><div class="lbl">Publicados</div></div>
  <div class="stat"><div class="val">${contents.filter(c => c.status === 'aprobado').length}</div><div class="lbl">Aprobados</div></div>
  <div class="stat"><div class="val">${contents.filter(c => ['revision','enviado','cambios'].includes(c.status)).length}</div><div class="lbl">Pendientes</div></div>
</div>

<section>
<h2>Insights del periodo</h2>
<ul>${insights.map(i => `<li>${i}</li>`).join('')}</ul>
</section>

<section>
<h2>Recomendaciones</h2>
<ul>${recs.map(r => `<li>${r}</li>`).join('')}</ul>
</section>

${published.length > 0 ? `
<section>
<h2>Contenidos publicados</h2>
<table>
<thead><tr><th>Título</th><th>Canal</th><th>Formato</th><th>Fecha</th><th>Alcance</th><th>Engagement</th></tr></thead>
<tbody>
${published.map(c => `<tr>
  <td>${c.title}</td>
  <td>${c.channel}</td>
  <td>${c.format}</td>
  <td>${c.date ?? '—'}</td>
  <td>${c.metrics?.reach?.toLocaleString('es-ES') ?? '—'}</td>
  <td>${c.metrics?.engagementRate ? c.metrics.engagementRate + '%' : '—'}</td>
</tr>`).join('')}
</tbody>
</table>
</section>` : ''}

<div class="footer">
  <span>Generado por Kimce Content Hub · ${new Date().toLocaleDateString('es-ES')}</span>
  <span>Kimce Studio — Agencia de Contenidos</span>
</div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.addEventListener('load', () => win.print())
}

export function exportWebReport(brand: Brand, contents: Content[]): void {
  const insights = generateInsights(contents, brand)
  const recs     = generateRecommendations(contents, brand)
  const published = contents.filter(c => c.status === 'publicado')
  const month     = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const date      = new Date().toISOString().split('T')[0]

  const totalReach = published.reduce((a, c) => a + (c.metrics?.reach ?? 0), 0)
  const avgEng = (() => {
    const rates = published.flatMap(c => c.metrics?.engagementRate != null ? [c.metrics.engagementRate] : [])
    return rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) : null
  })()

  const STATUS_LABELS: Record<string, string> = {
    idea: 'Idea', produccion: 'En producción', redaccion: 'En producción',
    diseno: 'En producción', audiovisual: 'En producción', revision: 'En revisión',
    enviado: 'En revisión', cambios: 'En revisión', aprobado: 'Aprobado',
    finalizado: 'Aprobado', programado: 'Programado', publicado: 'Publicado',
    reportado: 'Publicado',
  }
  const STATUS_COLORS: Record<string, string> = {
    idea: '#64748b', produccion: '#3b82f6', redaccion: '#3b82f6',
    diseno: '#3b82f6', audiovisual: '#3b82f6', revision: '#f59e0b',
    enviado: '#f59e0b', cambios: '#f59e0b', aprobado: '#10b981',
    finalizado: '#10b981', programado: '#16a34a', publicado: '#8b5cf6',
    reportado: '#8b5cf6',
  }
  const NETWORK_LABELS: Record<string, string> = {
    instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
    fb_comunidad: 'FB Comunidad', linkedin: 'LinkedIn', youtube: 'YouTube',
    whatsapp: 'WhatsApp', blog: 'Blog', email: 'Email', web: 'Web', stories: 'Stories',
  }
  const NETWORK_EMOJIS: Record<string, string> = {
    instagram: '📷', tiktok: '🎵', facebook: '📘', fb_comunidad: '👥',
    linkedin: '💼', youtube: '▶️', whatsapp: '💬', blog: '📝',
    email: '✉️', web: '🌐', stories: '⭕',
  }

  const allStatuses = [...new Set(contents.map(c => c.status))]
  const allNetworks  = [...new Set(contents.map(c => c.channel))]

  const contentsJson = JSON.stringify(contents.map(c => ({
    id: c.id,
    title: c.title,
    channel: c.channel,
    format: c.format,
    status: c.status,
    statusLabel: STATUS_LABELS[c.status] ?? c.status,
    statusColor: STATUS_COLORS[c.status] ?? '#9ca3af',
    networkLabel: NETWORK_LABELS[c.channel] ?? c.channel,
    networkEmoji: NETWORK_EMOJIS[c.channel] ?? '🔗',
    date: c.date ?? null,
    time: c.time ?? null,
    responsible: c.responsible ?? '',
    campaign: c.campaign ?? '',
    copy: c.copy ?? '',
    cta: c.cta ?? '',
    hashtags: c.hashtags ?? '',
    internalNotes: c.internalNotes ?? '',
    postUrl: c.postUrl ?? null,
    designUrl: c.designUrl ?? null,
    driveUrl: c.driveUrl ?? null,
    reach: c.metrics?.reach ?? null,
    engagement: c.metrics?.engagementRate ?? null,
    likes: c.metrics?.likes ?? null,
    impressions: c.metrics?.impressions ?? null,
    comments: c.metrics?.comments ?? null,
    shares: c.metrics?.shares ?? null,
    saves: c.metrics?.saves ?? null,
    views: c.metrics?.views ?? null,
    performanceNotes: c.metrics?.performanceNotes ?? null,
  })))

  const metricRows = published.map(c => `
    <tr>
      <td><span class="net-chip">${NETWORK_EMOJIS[c.channel] ?? '🔗'} ${NETWORK_LABELS[c.channel] ?? c.channel}</span></td>
      <td class="t-title">${escapeHtml(c.title)}</td>
      <td class="t-mono">${c.date ?? '—'}</td>
      <td class="t-num">${c.metrics?.reach != null ? c.metrics.reach.toLocaleString('es-ES') : '—'}</td>
      <td class="t-num">${c.metrics?.impressions != null ? c.metrics.impressions.toLocaleString('es-ES') : '—'}</td>
      <td class="t-num">${c.metrics?.engagementRate != null ? c.metrics.engagementRate + '%' : '—'}</td>
      <td class="t-num">${c.metrics?.likes != null ? c.metrics.likes.toLocaleString('es-ES') : '—'}</td>
      <td class="t-num">${c.metrics?.saves != null ? c.metrics.saves.toLocaleString('es-ES') : '—'}</td>
    </tr>`).join('')

  const pipelineRows = (['idea','produccion','revision','aprobado','programado','publicado'] as const).map(s => {
    const groups: Record<string, string[]> = {
      produccion: ['produccion','redaccion','diseno','audiovisual','proceso'],
      revision: ['revision','enviado','cambios'],
      aprobado: ['aprobado','finalizado'],
      publicado: ['publicado','reportado'],
    }
    const count = contents.filter(c => groups[s] ? groups[s].includes(c.status) : c.status === s).length
    const pct   = contents.length ? Math.round((count / contents.length) * 100) : 0
    const color = STATUS_COLORS[s] ?? '#94a3b8'
    const label = STATUS_LABELS[s] ?? s
    return `<div class="pipe-row">
      <span class="pipe-lbl" style="background:${color}22;color:${color}">${label}</span>
      <div class="pipe-track"><div class="pipe-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="pipe-num">${count}</span>
    </div>`
  }).join('')

  const networkRows = allNetworks.map(n => {
    const count = contents.filter(c => c.channel === n).length
    const pct   = contents.length ? Math.round((count / contents.length) * 100) : 0
    return `<div class="pipe-row">
      <span class="pipe-lbl" style="background:#f3f4f6;color:#374151">${NETWORK_EMOJIS[n] ?? '🔗'} ${NETWORK_LABELS[n] ?? n}</span>
      <div class="pipe-track"><div class="pipe-fill" style="width:${pct}%;background:#7c3aed"></div></div>
      <span class="pipe-num">${count}</span>
    </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Informe ${escapeHtml(brand.name)} — ${month}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:#f8fafc;color:#111827;min-height:100vh}
a{color:inherit;text-decoration:none}
/* topbar */
.topbar{background:#fff;border-bottom:1px solid #e5e7eb;padding:0 28px;height:58px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:100;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.b-dot{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0;background:${brand.color}}
.t-name{font-size:14px;font-weight:700} .t-sub{font-size:11px;color:#9ca3af;margin-top:1px}
.t-agency{margin-left:auto;text-align:right} .t-agency strong{font-size:12px;font-weight:700;color:#7c3aed;display:block} .t-agency small{font-size:11px;color:#9ca3af}
/* layout */
.wrap{max-width:1120px;margin:0 auto;padding:28px 20px}
/* main tabs */
.mtabs{display:flex;gap:3px;background:#fff;border-radius:13px;padding:4px;border:1px solid #e5e7eb;margin-bottom:24px}
.mt-btn{flex:1;padding:7px 12px;border:none;background:transparent;border-radius:9px;font-size:12px;font-weight:600;color:#9ca3af;cursor:pointer;transition:all .18s}
.mt-btn.on{background:#7c3aed;color:#fff;box-shadow:0 2px 8px rgba(124,58,237,.25)}
.mt-btn:hover:not(.on){background:#f3f4f6;color:#6b7280}
.mpanel{display:none}.mpanel.on{display:block}
/* stats grid */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
@media(max-width:600px){.stats{grid-template-columns:repeat(2,1fr)}}
.s-card{background:#fff;border-radius:14px;padding:18px;border:1px solid #e5e7eb}
.s-ico{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;margin-bottom:10px}
.s-val{font-size:26px;font-weight:800;color:#111827} .s-lbl{font-size:11px;color:#9ca3af;margin-top:2px;font-weight:500}
/* card */
.card{background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:18px}
.c-head{padding:14px 18px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.c-title{font-size:14px;font-weight:700} .c-sub{font-size:11px;color:#9ca3af;margin-top:1px}
/* view switcher (inside contenidos) */
.vsw{display:flex;gap:3px;margin-bottom:16px}
.vsw-btn{padding:7px 16px;border:1px solid #e5e7eb;background:#fff;border-radius:10px;font-size:12px;font-weight:600;color:#6b7280;cursor:pointer;transition:all .15s}
.vsw-btn.on{background:#111827;color:#fff;border-color:#111827}
.vsw-btn:hover:not(.on){background:#f3f4f6}
.vpanel{display:none}.vpanel.on{display:block}
/* filters bar */
.fbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;padding:12px 16px;border-bottom:1px solid #f3f4f6;background:#fafafa}
.fpill{border:1px solid #e5e7eb;background:#fff;padding:4px 11px;border-radius:18px;font-size:11px;font-weight:600;color:#6b7280;cursor:pointer;transition:all .14s;white-space:nowrap}
.fpill.on{background:#7c3aed;color:#fff;border-color:#7c3aed}
.fpill:hover:not(.on){background:#f3f4f6}
.srch{flex:1;min-width:180px;max-width:280px;position:relative}
.srch input{width:100%;border:1px solid #e5e7eb;border-radius:9px;padding:6px 10px 6px 28px;font-size:12px;outline:none;font-family:inherit;color:#111827;background:#fff}
.srch input:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.1)}
.srch-ico{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:13px;pointer-events:none}
/* CALENDAR */
.cal-nav{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #f3f4f6}
.cal-nav-btn{width:30px;height:30px;border:1px solid #e5e7eb;background:#fff;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .14s}
.cal-nav-btn:hover{background:#f3f4f6}
.cal-month-lbl{font-size:14px;font-weight:700;color:#111827;text-transform:capitalize}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);padding:0 12px 12px}
.cal-dow{text-align:center;font-size:10px;font-weight:700;color:#9ca3af;padding:10px 4px 6px;text-transform:uppercase;letter-spacing:.04em}
.cal-cell{min-height:90px;padding:6px;border:1px solid transparent;border-radius:8px;transition:background .12s;vertical-align:top}
.cal-cell:hover{background:#f9fafb}
.cal-cell.other-month .cal-day-num{color:#d1d5db}
.cal-cell.today .cal-day-num{background:#7c3aed;color:#fff;border-radius:50%}
.cal-day-num{width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#374151;margin-bottom:4px}
.cal-chip{font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default;display:block;line-height:1.4}
.cal-more{font-size:9px;color:#7c3aed;font-weight:700;padding:1px 4px;cursor:pointer;background:#ede9fe;border-radius:4px;display:inline-block;margin-top:1px}
/* LIST TABLE */
.list-table{width:100%;border-collapse:collapse;font-size:12px}
.list-table th{padding:9px 14px;text-align:left;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;background:#f9fafb;border-bottom:1px solid #e5e7eb}
.list-table td{padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#374151;vertical-align:middle}
.list-table tr:last-child td{border-bottom:none}
.list-table tr:hover td{background:#fafafa}
.t-title{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:#111827}
.t-mono{font-family:monospace;font-size:11px;color:#9ca3af}
.t-num{font-weight:600;color:#111827;text-align:right}
.net-chip{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:16px;font-size:10px;font-weight:600;background:#f3f4f6;color:#374151;white-space:nowrap}
.st-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:middle}
.lnk-btn{font-size:10px;padding:2px 7px;border-radius:6px;background:#f3f4f6;color:#6b7280;font-weight:600;border:none;cursor:pointer;text-decoration:none;display:inline-block}
.lnk-btn:hover{background:#ede9fe;color:#7c3aed}
/* DETAIL CARDS */
.d-card{border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:14px;background:#fff}
.d-card-head{display:flex;align-items:flex-start;gap:12px;padding:16px;border-bottom:1px solid #f3f4f6}
.d-card-bar{width:4px;border-radius:2px;flex-shrink:0;align-self:stretch}
.d-card-main{flex:1;min-width:0}
.d-card-title{font-size:14px;font-weight:700;color:#111827;line-height:1.4;margin-bottom:6px}
.d-card-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.d-card-body{padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:14px;border-bottom:1px solid #f3f4f6}
@media(max-width:600px){.d-card-body{grid-template-columns:1fr}}
.d-field label{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:3px}
.d-field p{font-size:12px;color:#374151;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.d-field.full{grid-column:1/-1}
.d-card-foot{padding:10px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fafafa}
.d-preview{border-bottom:1px solid #f3f4f6}
.d-preview-lbl{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;padding:10px 16px 6px;display:flex;align-items:center;justify-content:space-between;background:#f9fafb}
.d-preview iframe{width:100%;height:440px;border:none;display:block;background:#f3f4f6}
.d-preview img{width:100%;max-height:440px;object-fit:contain;display:block;background:#f3f4f6;cursor:zoom-in}
.d-preview-ph{padding:14px 16px;background:#f9fafb;display:flex;align-items:center;gap:10px;font-size:12px;color:#9ca3af}
.d-metric{font-size:11px;color:#6b7280;background:#f3f4f6;padding:3px 9px;border-radius:8px;font-weight:600}
/* pipeline */
.pipe-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #f9fafb}
.pipe-row:last-child{border-bottom:none}
.pipe-lbl{font-size:10px;font-weight:700;padding:3px 9px;border-radius:18px;width:126px;text-align:center;flex-shrink:0}
.pipe-track{flex:1;background:#f3f4f6;border-radius:99px;height:7px;overflow:hidden}
.pipe-fill{height:100%;border-radius:99px;transition:width .5s ease}
.pipe-num{font-size:11px;font-weight:700;color:#111827;width:22px;text-align:right;flex-shrink:0}
/* insights */
.ins-row{display:flex;align-items:flex-start;gap:10px;padding:12px 0;border-bottom:1px solid #f3f4f6}
.ins-row:last-child{border-bottom:none}
.ins-num{width:20px;height:20px;border-radius:50%;background:#ede9fe;color:#7c3aed;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.ins-arrow{width:20px;height:20px;border-radius:50%;background:#f0fdf4;color:#16a34a;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.ins-txt{font-size:12px;color:#374151;line-height:1.6}
/* metrics kpi */
.m-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px;border-bottom:1px solid #f3f4f6}
@media(max-width:600px){.m-kpi{grid-template-columns:repeat(2,1fr)}}
.kpi-c{text-align:center;padding:10px;background:#f9fafb;border-radius:10px}
.kpi-v{font-size:20px;font-weight:800;color:#111827} .kpi-l{font-size:10px;color:#9ca3af;margin-top:1px;font-weight:500}
/* util */
.empty{padding:44px;text-align:center;color:#9ca3af;font-size:13px}
.hidden{display:none!important}
/* footer */
.footer{margin-top:40px;padding:16px 0;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;flex-wrap:wrap;gap:6px}
</style>
</head>
<body>
<div class="topbar">
  <div class="b-dot">${escapeHtml(brand.initials)}</div>
  <div><div class="t-name">${escapeHtml(brand.name)}</div><div class="t-sub">${escapeHtml(brand.industry)} · ${escapeHtml(brand.country)} · Informe ${month}</div></div>
  <div class="t-agency"><strong>Kimce Studio</strong><small>kimcestudio.com</small></div>
</div>

<div class="wrap">

  <div class="stats">
    <div class="s-card"><div class="s-ico" style="background:#f5f3ff">📦</div><div class="s-val">${contents.length}</div><div class="s-lbl">Contenidos totales</div></div>
    <div class="s-card"><div class="s-ico" style="background:#ede9fe">✅</div><div class="s-val">${published.length}</div><div class="s-lbl">Publicados</div></div>
    <div class="s-card"><div class="s-ico" style="background:#f0fdf4">👍</div><div class="s-val">${contents.filter(c=>c.status==='aprobado').length}</div><div class="s-lbl">Aprobados</div></div>
    <div class="s-card"><div class="s-ico" style="background:#fef3c7">⏳</div><div class="s-val">${contents.filter(c=>['revision','enviado','cambios'].includes(c.status)).length}</div><div class="s-lbl">En revisión</div></div>
  </div>

  <div class="mtabs">
    <button class="mt-btn on"  onclick="switchTab('contenidos')">📋 Contenidos</button>
    <button class="mt-btn"     onclick="switchTab('metricas')">📊 Métricas</button>
    <button class="mt-btn"     onclick="switchTab('pipeline')">🔄 Pipeline</button>
    <button class="mt-btn"     onclick="switchTab('insights')">💡 Insights</button>
  </div>

  <!-- ── CONTENIDOS ── -->
  <div id="tab-contenidos" class="mpanel on">
    <div class="vsw">
      <button class="vsw-btn on" id="vsw-cal"    onclick="switchView('cal')">📅 Calendario</button>
      <button class="vsw-btn"    id="vsw-lista"  onclick="switchView('lista')">☰ Lista</button>
      <button class="vsw-btn"    id="vsw-detalle" onclick="switchView('detalle')">📄 Detalle</button>
    </div>

    <!-- Calendario -->
    <div id="vpanel-cal" class="vpanel on card">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="calPrev()">‹</button>
        <span class="cal-month-lbl" id="cal-lbl"></span>
        <button class="cal-nav-btn" onclick="calNext()">›</button>
      </div>
      <div class="cal-grid">
        <div class="cal-dow">Lun</div><div class="cal-dow">Mar</div><div class="cal-dow">Mié</div>
        <div class="cal-dow">Jue</div><div class="cal-dow">Vie</div><div class="cal-dow">Sáb</div><div class="cal-dow">Dom</div>
        <div id="cal-days"></div>
      </div>
    </div>

    <!-- Lista -->
    <div id="vpanel-lista" class="vpanel card">
      <div class="fbar" id="fbar-lista">
        <div class="srch"><span class="srch-ico">🔍</span><input type="text" id="srch-lista" placeholder="Buscar…" oninput="render('lista')" /></div>
        <button class="fpill on" data-v="lista" data-f="all" onclick="setFilter(this,'lista','all')">Todos</button>
        ${allStatuses.map(s=>`<button class="fpill" data-v="lista" data-f="${s}" onclick="setFilter(this,'lista','${s}')">${STATUS_LABELS[s]??s}</button>`).join('')}
      </div>
      <div style="overflow-x:auto">
        <table class="list-table">
          <thead><tr><th>#</th><th>Red</th><th>Título</th><th>Formato</th><th>Estado</th><th>Fecha</th><th>Links</th></tr></thead>
          <tbody id="tbody-lista"></tbody>
        </table>
      </div>
      <div id="empty-lista" class="empty hidden">Sin resultados.</div>
    </div>

    <!-- Detalle -->
    <div id="vpanel-detalle" class="vpanel">
      <div class="card">
        <div class="fbar" id="fbar-detalle">
          <div class="srch"><span class="srch-ico">🔍</span><input type="text" id="srch-detalle" placeholder="Buscar…" oninput="render('detalle')" /></div>
          <button class="fpill on" data-v="detalle" data-f="all" onclick="setFilter(this,'detalle','all')">Todos</button>
          ${allStatuses.map(s=>`<button class="fpill" data-v="detalle" data-f="${s}" onclick="setFilter(this,'detalle','${s}')">${STATUS_LABELS[s]??s}</button>`).join('')}
        </div>
      </div>
      <div id="detail-cards"></div>
      <div id="empty-detalle" class="empty hidden">Sin resultados.</div>
    </div>
  </div>

  <!-- ── MÉTRICAS ── -->
  <div id="tab-metricas" class="mpanel">
    <div class="card">
      <div class="m-kpi">
        <div class="kpi-c"><div class="kpi-v">${totalReach>0?(totalReach>999?(totalReach/1000).toFixed(1)+'K':totalReach):'—'}</div><div class="kpi-l">Alcance total</div></div>
        <div class="kpi-c"><div class="kpi-v">${avgEng!=null?avgEng+'%':'—'}</div><div class="kpi-l">Engagement prom.</div></div>
        <div class="kpi-c"><div class="kpi-v">${published.reduce((a,c)=>a+(c.metrics?.likes??0),0).toLocaleString('es-ES')||'—'}</div><div class="kpi-l">Likes totales</div></div>
        <div class="kpi-c"><div class="kpi-v">${published.reduce((a,c)=>a+(c.metrics?.impressions??0),0).toLocaleString('es-ES')||'—'}</div><div class="kpi-l">Impresiones</div></div>
      </div>
      <div class="c-head"><div class="c-title">Métricas por publicación</div></div>
      ${published.length>0?`<div style="overflow-x:auto"><table class="list-table">
        <thead><tr><th>Red</th><th>Publicación</th><th>Fecha</th><th style="text-align:right">Alcance</th><th style="text-align:right">Impr.</th><th style="text-align:right">Eng.%</th><th style="text-align:right">Likes</th><th style="text-align:right">Guardados</th></tr></thead>
        <tbody>${metricRows}</tbody>
      </table></div>`:'<div class="empty">Sin publicaciones con métricas aún.</div>'}
    </div>
  </div>

  <!-- ── PIPELINE ── -->
  <div id="tab-pipeline" class="mpanel">
    <div class="card">
      <div class="c-head"><div><div class="c-title">Estado del pipeline</div><div class="c-sub">Distribución por etapa</div></div></div>
      <div style="padding:16px 20px">${pipelineRows}</div>
    </div>
    <div class="card">
      <div class="c-head"><div class="c-title">Distribución por red social</div></div>
      <div style="padding:16px 20px">${networkRows}</div>
    </div>
  </div>

  <!-- ── INSIGHTS ── -->
  <div id="tab-insights" class="mpanel">
    <div class="card">
      <div class="c-head"><div><div class="c-title">Insights del periodo</div><div class="c-sub">Generados a partir de los datos registrados</div></div></div>
      <div style="padding:4px 18px 8px">
        ${insights.map((ins,i)=>`<div class="ins-row"><div class="ins-num">${i+1}</div><div class="ins-txt">${escapeHtml(ins)}</div></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="c-head"><div class="c-title">Recomendaciones estratégicas</div></div>
      <div style="padding:4px 18px 8px">
        ${recs.map(r=>`<div class="ins-row"><div class="ins-arrow">→</div><div class="ins-txt">${escapeHtml(r)}</div></div>`).join('')}
      </div>
    </div>
  </div>

  <div class="footer">
    <span>Generado por Kimce Content Hub · ${date}</span>
    <span>Kimce Studio — Agencia de Contenidos</span>
  </div>
</div>

<script>
var ALL = ${contentsJson};
var SC  = ${JSON.stringify(STATUS_COLORS)};
var MES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var calY, calM;
var fStatus = {lista:'all', detalle:'all'};
var fSearch = {lista:'', detalle:''};

/* init calendar month from content dates */
(function(){
  var dates = ALL.filter(function(c){return c.date;}).map(function(c){return c.date.substring(0,7);});
  if(!dates.length){ calY=new Date().getFullYear(); calM=new Date().getMonth(); return; }
  var cnt={};
  dates.forEach(function(d){cnt[d]=(cnt[d]||0)+1;});
  var best=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a];})[0];
  var p=best.split('-'); calY=parseInt(p[0]); calM=parseInt(p[1])-1;
})();

function switchTab(n){
  document.querySelectorAll('.mpanel').forEach(function(p){p.classList.remove('on');});
  document.querySelectorAll('.mt-btn').forEach(function(b){b.classList.remove('on');});
  document.getElementById('tab-'+n).classList.add('on');
  var idx=['contenidos','metricas','pipeline','insights'].indexOf(n);
  document.querySelectorAll('.mt-btn')[idx].classList.add('on');
}

function switchView(v){
  ['cal','lista','detalle'].forEach(function(x){
    document.getElementById('vpanel-'+x).classList.remove('on');
    document.getElementById('vsw-'+x).classList.remove('on');
  });
  document.getElementById('vpanel-'+v).classList.add('on');
  document.getElementById('vsw-'+v).classList.add('on');
}

function setFilter(el,view,f){
  document.querySelectorAll('[data-v="'+view+'"]').forEach(function(b){b.classList.remove('on');});
  el.classList.add('on');
  fStatus[view]=f;
  render(view);
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n){ return n!=null ? Number(n).toLocaleString('es-ES') : '—'; }

function filtered(view){
  var st=fStatus[view], q=(document.getElementById('srch-'+view)||{value:''}).value.toLowerCase();
  return ALL.filter(function(c){
    var ms = st==='all' || c.status===st;
    var mq = !q || c.title.toLowerCase().indexOf(q)>=0 || (c.copy||'').toLowerCase().indexOf(q)>=0 || (c.responsible||'').toLowerCase().indexOf(q)>=0;
    return ms && mq;
  });
}

/* ─── CALENDAR ─── */
function renderCal(){
  var lbl = MES_ES[calM] + ' ' + calY;
  document.getElementById('cal-lbl').textContent = lbl.charAt(0).toUpperCase()+lbl.slice(1);
  var first = new Date(calY, calM, 1);
  var dow = first.getDay(); // 0=sun
  var startOffset = dow === 0 ? 6 : dow - 1; // shift so Mon=0
  var daysInMonth = new Date(calY, calM+1, 0).getDate();
  var today = new Date(); var todayStr = today.toISOString().slice(0,10);

  /* build date→contents map */
  var byDate = {};
  ALL.forEach(function(c){
    if(!c.date) return;
    if(!byDate[c.date]) byDate[c.date]= [];
    byDate[c.date].push(c);
  });

  var cells = '';
  /* leading empty cells from prev month */
  var prevDays = new Date(calY, calM, 0).getDate();
  for(var i=0; i<startOffset; i++){
    var d = prevDays - startOffset + 1 + i;
    cells += '<div class="cal-cell other-month"><div class="cal-day-num">'+d+'</div></div>';
  }
  /* current month */
  for(var day=1; day<=daysInMonth; day++){
    var pad = calY+'-'+(calM+1<10?'0':'')+(calM+1)+'-'+(day<10?'0':'')+day;
    var isToday = pad===todayStr;
    var dayConts = byDate[pad] || [];
    var chips = '';
    var max = 3;
    dayConts.slice(0,max).forEach(function(c){
      var col = SC[c.status]||'#94a3b8';
      chips += '<span class="cal-chip" style="background:'+col+'22;color:'+col+'" title="'+esc(c.title)+'">'+c.networkEmoji+' '+esc(c.title)+'</span>';
    });
    if(dayConts.length>max) chips += '<span class="cal-more">+' + (dayConts.length-max) + ' más</span>';
    cells += '<div class="cal-cell'+(isToday?' today':'')+'"><div class="cal-day-num">'+day+'</div>'+chips+'</div>';
  }
  /* trailing cells */
  var total = startOffset + daysInMonth;
  var trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for(var t=1; t<=trailing; t++){
    cells += '<div class="cal-cell other-month"><div class="cal-day-num">'+t+'</div></div>';
  }
  /* wrap cells in a CSS grid container inside the placeholder div */
  document.getElementById('cal-days').outerHTML = '<div id="cal-days" style="display:contents">'+cells+'</div>';
}

function calPrev(){ calM--; if(calM<0){calM=11;calY--;} renderCal(); }
function calNext(){ calM++; if(calM>11){calM=0;calY++;} renderCal(); }

/* ─── LIST ─── */
function renderLista(){
  var rows = filtered('lista');
  var tbody = document.getElementById('tbody-lista');
  var empty = document.getElementById('empty-lista');
  if(!rows.length){ tbody.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = rows.map(function(c,i){
    var col = SC[c.status]||'#94a3b8';
    var links = '';
    if(c.postUrl)   links += '<a href="'+esc(c.postUrl)+'" target="_blank" class="lnk-btn" style="margin-right:3px">Post 🔗</a>';
    if(c.designUrl) links += '<a href="'+esc(c.designUrl)+'" target="_blank" class="lnk-btn" style="margin-right:3px">Diseño</a>';
    if(c.driveUrl)  links += '<a href="'+esc(c.driveUrl)+'" target="_blank" class="lnk-btn">Drive</a>';
    return '<tr>'
      +'<td style="color:#9ca3af;font-size:11px">'+(i+1)+'</td>'
      +'<td><span class="net-chip">'+c.networkEmoji+' '+esc(c.networkLabel)+'</span></td>'
      +'<td class="t-title" title="'+esc(c.title)+'">'+esc(c.title)+'</td>'
      +'<td style="font-size:11px;color:#6b7280">'+(c.format||'—')+'</td>'
      +'<td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:'+col+'22;color:'+col+'"><span class="st-dot" style="background:'+col+'"></span>'+esc(c.statusLabel)+'</span></td>'
      +'<td class="t-mono">'+(c.date||'—')+'</td>'
      +'<td>'+links+'</td>'
      +'</tr>';
  }).join('');
}

/* ─── PREVIEW HELPERS ─── */
function driveEmbedUrl(url) {
  if(!url) return null;
  var m1 = url.match(/\/file\/d\/([^\/\?#]+)/);
  if(m1) return 'https://drive.google.com/file/d/'+m1[1]+'/preview';
  var m2 = url.match(/docs\.google\.com\/document\/d\/([^\/\?#]+)/);
  if(m2) return 'https://docs.google.com/document/d/'+m2[1]+'/preview';
  var m3 = url.match(/docs\.google\.com\/presentation\/d\/([^\/\?#]+)/);
  if(m3) return 'https://docs.google.com/presentation/d/'+m3[1]+'/preview';
  var m4 = url.match(/docs\.google\.com\/spreadsheets\/d\/([^\/\?#]+)/);
  if(m4) return 'https://docs.google.com/spreadsheets/d/'+m4[1]+'/preview';
  return null;
}
function isImg(url){ return !!(url && /\.(png|jpg|jpeg|gif|webp|svg)(\?|#|$)/i.test(url)); }
function buildPreview(driveUrl, designUrl) {
  var embedUrl = driveEmbedUrl(driveUrl);
  if(embedUrl) {
    return '<div class="d-preview">'
      +'<div class="d-preview-lbl"><span>Vista previa · Drive 📁</span>'
      +'<a href="'+esc(driveUrl)+'" target="_blank" class="lnk-btn">Abrir ↗</a></div>'
      +'<iframe src="'+esc(embedUrl)+'" allow="autoplay" allowfullscreen loading="lazy"></iframe>'
      +'</div>';
  }
  var embedDesign = driveEmbedUrl(designUrl);
  if(embedDesign) {
    return '<div class="d-preview">'
      +'<div class="d-preview-lbl"><span>Vista previa · Diseño 🎨</span>'
      +'<a href="'+esc(designUrl)+'" target="_blank" class="lnk-btn">Abrir ↗</a></div>'
      +'<iframe src="'+esc(embedDesign)+'" allow="autoplay" allowfullscreen loading="lazy"></iframe>'
      +'</div>';
  }
  if(isImg(designUrl)) {
    return '<div class="d-preview">'
      +'<div class="d-preview-lbl"><span>Vista previa · Diseño 🎨</span>'
      +'<a href="'+esc(designUrl)+'" target="_blank" class="lnk-btn">Abrir ↗</a></div>'
      +'<img src="'+esc(designUrl)+'" alt="Vista previa" onclick="window.open(\''+esc(designUrl)+'\',\'_blank\')" />'
      +'</div>';
  }
  if(isImg(driveUrl)) {
    return '<div class="d-preview">'
      +'<div class="d-preview-lbl"><span>Vista previa · Imagen 🖼</span>'
      +'<a href="'+esc(driveUrl)+'" target="_blank" class="lnk-btn">Abrir ↗</a></div>'
      +'<img src="'+esc(driveUrl)+'" alt="Vista previa" onclick="window.open(\''+esc(driveUrl)+'\',\'_blank\')" />'
      +'</div>';
  }
  return '';
}

/* ─── DETAIL ─── */
function renderDetalle(){
  var rows = filtered('detalle').slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
  var wrap = document.getElementById('detail-cards');
  var empty = document.getElementById('empty-detalle');
  if(!rows.length){ wrap.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  wrap.innerHTML = rows.map(function(c){
    var col = SC[c.status]||'#94a3b8';
    var hasMetrics = c.reach!=null||c.likes!=null||c.engagement!=null||c.impressions!=null||c.comments!=null||c.saves!=null||c.views!=null;
    var metrics = hasMetrics ? [
      c.reach!=null      ? '👁 Alcance: '+fmt(c.reach)      : '',
      c.impressions!=null? '📣 Impr: '+fmt(c.impressions)    : '',
      c.engagement!=null ? '📈 Eng: '+c.engagement+'%'       : '',
      c.likes!=null      ? '❤️ Likes: '+fmt(c.likes)         : '',
      c.comments!=null   ? '💬 Coment: '+fmt(c.comments)     : '',
      c.saves!=null      ? '🔖 Guard: '+fmt(c.saves)         : '',
      c.views!=null      ? '▶️ Vistas: '+fmt(c.views)        : '',
    ].filter(Boolean).map(function(m){ return '<span class="d-metric">'+m+'</span>'; }).join('') : '';

    var preview = buildPreview(c.driveUrl, c.designUrl);

    var links = [
      c.postUrl   ? '<a href="'+esc(c.postUrl)+'"   target="_blank" class="lnk-btn">Ver post 🔗</a>'   : '',
      c.designUrl ? '<a href="'+esc(c.designUrl)+'" target="_blank" class="lnk-btn">Diseño 🎨</a>'     : '',
      c.driveUrl  ? '<a href="'+esc(c.driveUrl)+'"  target="_blank" class="lnk-btn">Drive 📁</a>'      : '',
    ].filter(Boolean).join(' ');

    var fields = '';
    // info row (only client-visible metadata)
    if(c.date||c.time) fields += '<div class="d-field"><label>Fecha / Hora</label><p class="t-mono">'+esc((c.date||'—')+(c.time?' · '+c.time:''))+'</p></div>';
    if(c.campaign)     fields += '<div class="d-field"><label>Campaña</label><p>'+esc(c.campaign)+'</p></div>';
    if(c.format)       fields += '<div class="d-field"><label>Formato</label><p>'+esc(c.format)+'</p></div>';
    // copy block
    if(c.copy)     fields += '<div class="d-field full"><label>Copy</label><p style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:10px 12px">'+esc(c.copy)+'</p></div>';
    if(c.cta)      fields += '<div class="d-field"><label>CTA</label><p>'+esc(c.cta)+'</p></div>';
    if(c.hashtags) fields += '<div class="d-field"><label>Hashtags</label><p style="color:#7c3aed;font-family:monospace;font-size:11px;word-break:break-all">'+esc(c.hashtags)+'</p></div>';
    if(c.performanceNotes) fields += '<div class="d-field full"><label>Observaciones</label><p>'+esc(c.performanceNotes)+'</p></div>';

    return '<div class="d-card">'
      +'<div class="d-card-head">'
        +'<div class="d-card-bar" style="background:'+col+'"></div>'
        +'<div class="d-card-main">'
          +'<div class="d-card-title">'+esc(c.title)+'</div>'
          +'<div class="d-card-meta">'
            +'<span class="net-chip">'+c.networkEmoji+' '+esc(c.networkLabel)+'</span>'
            +'<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:'+col+'22;color:'+col+'">'+esc(c.statusLabel)+'</span>'
            +(c.format ? '<span style="font-size:10px;background:#f3f4f6;color:#6b7280;padding:2px 7px;border-radius:6px;font-weight:600">'+esc(c.format)+'</span>' : '')
            +(c.date   ? '<span style="font-size:10px;font-family:monospace;color:#9ca3af">'+esc(c.date)+(c.time?' · '+esc(c.time):'')+'</span>' : '')
          +'</div>'
        +'</div>'
      +'</div>'
      +preview
      +(fields ? '<div class="d-card-body">'+fields+'</div>' : '')
      +'<div class="d-card-foot">'
        +links
        +metrics
      +'</div>'
    +'</div>';
  }).join('');
}

function render(view){
  if(view==='lista')   renderLista();
  if(view==='detalle') renderDetalle();
}

renderCal();
renderLista();
renderDetalle();
</script>
</body>
</html>`

  download(html, `informe-web-${slugify(brand.name)}-${date}.html`, 'text/html')
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
