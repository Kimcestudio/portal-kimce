import type { Brand, Content } from './types'

function hex(color: string): string {
  return color.replace('#', '').toUpperCase().padEnd(6, '0')
}

function tr(str: string | undefined, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ── URL helpers ──────────────────────────────────────────────────────────────

function isDriveFolder(url: string): boolean {
  return /drive\.google\.com\/(drive\/)?(?:u\/\d+\/)?folders\//.test(url)
}
function isDriveFile(url: string): boolean {
  return /drive\.google\.com\/file\/d\//.test(url) || /drive\.google\.com\/uc\?/.test(url)
}
function isCanvaUrl(url: string): boolean {
  return /canva\.com/.test(url)
}
function isVideoUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|\.mp4|\.mov|\.webm/.test(url)
}

// Returns a static thumbnail URL for known video platforms, or null
function videoThumbnailUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg`

  const drive = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
  if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1600`

  return null
}

async function vimeoThumbnail(url: string): Promise<string | null> {
  if (!url.includes('vimeo.com')) return null
  try {
    const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`)
    if (!r.ok) return null
    const d = await r.json() as { thumbnail_url?: string }
    return d.thumbnail_url ?? null
  } catch { return null }
}

async function urlToBase64(url: string): Promise<string | null> {
  if (isDriveFolder(url) || isCanvaUrl(url)) return null
  // For Drive video thumbnails use the thumbnail endpoint (already a direct image)
  const targetUrl = isDriveFile(url) && isVideoUrl(url) ? (videoThumbnailUrl(url) ?? url) : url
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(targetUrl)}`)
    if (!res.ok) return null
    const json = await res.json() as { data?: string }
    return json.data ?? null
  } catch { return null }
}

// ── Folder listing ────────────────────────────────────────────────────────────

type DriveFile = { id: string; name: string; mimeType: string }
type FolderResult = {
  noApiKey?: boolean
  images: DriveFile[]
  videos: DriveFile[]
  folders: DriveFile[]
  total: number
}

async function listDriveFolder(folderUrl: string): Promise<FolderResult> {
  try {
    const res = await fetch(`/api/drive-folder?url=${encodeURIComponent(folderUrl)}`)
    if (!res.ok) return { images: [], videos: [], folders: [], total: 0 }
    return await res.json() as FolderResult
  } catch { return { images: [], videos: [], folders: [], total: 0 } }
}

// ── Collage renderer ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addCollage(slide: any, imgs: string[], x: number, y: number, w: number, h: number) {
  const n = Math.min(imgs.length, 4)
  const gap = 0.06
  if (n === 1) {
    slide.addImage({ data: imgs[0], x, y, w, h, sizing: { type: 'cover', w, h } })
  } else if (n === 2) {
    const hw = (w - gap) / 2
    slide.addImage({ data: imgs[0], x,          y, w: hw, h, sizing: { type: 'cover', w: hw, h } })
    slide.addImage({ data: imgs[1], x: x+hw+gap, y, w: hw, h, sizing: { type: 'cover', w: hw, h } })
  } else if (n === 3) {
    const hw = (w - gap) / 2
    const hh = (h - gap) / 2
    slide.addImage({ data: imgs[0], x,          y,          w: hw, h: hh, sizing: { type: 'cover', w: hw, h: hh } })
    slide.addImage({ data: imgs[1], x: x+hw+gap, y,          w: hw, h: hh, sizing: { type: 'cover', w: hw, h: hh } })
    slide.addImage({ data: imgs[2], x,          y: y+hh+gap, w,    h: hh, sizing: { type: 'cover', w, h: hh } })
  } else {
    const hw = (w - gap) / 2
    const hh = (h - gap) / 2
    slide.addImage({ data: imgs[0], x,          y,          w: hw, h: hh, sizing: { type: 'cover', w: hw, h: hh } })
    slide.addImage({ data: imgs[1], x: x+hw+gap, y,          w: hw, h: hh, sizing: { type: 'cover', w: hw, h: hh } })
    slide.addImage({ data: imgs[2], x,          y: y+hh+gap, w: hw, h: hh, sizing: { type: 'cover', w: hw, h: hh } })
    slide.addImage({ data: imgs[3], x: x+hw+gap, y: y+hh+gap, w: hw, h: hh, sizing: { type: 'cover', w: hw, h: hh } })
  }
}

// ── Video play-button overlay ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addPlayOverlay(slide: any, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2
  const cy = y + h / 2
  slide.addShape('ellipse', { x: cx - 0.45, y: cy - 0.45, w: 0.9, h: 0.9, fill: { color: '000000', transparency: 35 }, line: { color: '000000', transparency: 35 } })
  slide.addText('▶', { x: cx - 0.45, y: cy - 0.45, w: 0.9, h: 0.9, fontSize: 22, color: 'FFFFFF', align: 'center', valign: 'middle' })
}

// May 2026: starts on Friday → offset 4 from Monday
const MAY_OFFSET = 4
const MAY_DAYS = 31

function calCells() {
  const out: { day: number; thisMonth: boolean }[] = []
  for (let i = 0; i < MAY_OFFSET; i++) out.push({ day: 27 + i, thisMonth: false })
  for (let d = 1; d <= MAY_DAYS; d++) out.push({ day: d, thisMonth: true })
  return out
}

const NET: Record<string, { bg: string; text: string; dot: string; label: string; emoji: string }> = {
  instagram: { bg: 'FCE7F3', text: 'BE185D', dot: 'E1306C', label: 'Instagram', emoji: '📷' },
  tiktok:    { bg: 'F3F4F6', text: '111827', dot: '010101', label: 'TikTok',    emoji: '♪'  },
  facebook:  { bg: 'DBEAFE', text: '1E40AF', dot: '1877F2', label: 'Facebook',  emoji: 'f'  },
  linkedin:  { bg: 'DBEAFE', text: '0A66C2', dot: '0A66C2', label: 'LinkedIn',  emoji: 'in' },
  youtube:   { bg: 'FEE2E2', text: 'B91C1C', dot: 'FF0000', label: 'YouTube',   emoji: '▶'  },
  whatsapp:  { bg: 'DCFCE7', text: '166534', dot: '25D366', label: 'WhatsApp',  emoji: '💬' },
  blog:      { bg: 'FEF3C7', text: '92400E', dot: 'F59E0B', label: 'Blog',      emoji: '📝' },
  email:     { bg: 'EDE9FE', text: '5B21B6', dot: '7C3AED', label: 'Email',     emoji: '✉'  },
  web:       { bg: 'F3F4F6', text: '374151', dot: '6B7280', label: 'Web',       emoji: '🌐' },
  stories:   { bg: 'FAE8FF', text: '7E22CE', dot: 'A855F7', label: 'Stories',   emoji: '⭕' },
}

const ST: Record<string, { label: string; dot: string }> = {
  idea:       { label: 'Idea',            dot: '94A3B8' },
  redaccion:  { label: 'En Redacción',    dot: '3B82F6' },
  diseno:     { label: 'En Diseño',       dot: 'A855F7' },
  revision:   { label: 'En Revisión',     dot: 'F59E0B' },
  enviado:    { label: 'Enviado',         dot: '0EA5E9' },
  cambios:    { label: 'Cambios',         dot: 'F43F5E' },
  aprobado:   { label: 'Aprobado',        dot: '22C55E' },
  programado: { label: 'Programado',      dot: '16A34A' },
  publicado:  { label: 'Publicado',       dot: '8B5CF6' },
  reportado:  { label: 'Reportado',       dot: '94A3B8' },
}

const PR: Record<string, { label: string; bg: string; text: string }> = {
  baja:    { label: 'Baja',    bg: 'F1F5F9', text: '64748B' },
  media:   { label: 'Media',   bg: 'FEF3C7', text: '92400E' },
  alta:    { label: 'Alta',    bg: 'FFEDD5', text: 'C2410C' },
  urgente: { label: 'Urgente', bg: 'FEE2E2', text: 'B91C1C' },
}

export async function exportPPT(brand: Brand, contents: Content[]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pptxMod = await import('pptxgenjs') as any
  const PptxGenJS = pptxMod.default ?? pptxMod
  const prs = new PptxGenJS()
  prs.layout = 'LAYOUT_WIDE' // 13.33" × 7.5"

  const BHX = hex(brand.color)

  // ── helpers ──────────────────────────────────────────────────────────────
  const published = contents.filter(c => c.status === 'publicado')
  const pending   = contents.filter(c => ['revision', 'enviado', 'cambios'].includes(c.status))
  const approved  = contents.filter(c => c.status === 'aprobado')
  const rates     = published.flatMap(c => c.metrics?.engagementRate ? [c.metrics.engagementRate] : [])
  const avgEng    = rates.length ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1) + '%' : '—'

  // ── SLIDE 1: PORTADA ─────────────────────────────────────────────────────
  const s1 = prs.addSlide()
  s1.background = { color: BHX }

  // decorative circle (large, white transparent)
  s1.addShape('ellipse', {
    x: -1, y: -1, w: 5, h: 5,
    fill: { color: 'FFFFFF', transparency: 88 },
    line: { color: BHX },
  })
  s1.addShape('ellipse', {
    x: 9.5, y: 3.5, w: 6, h: 6,
    fill: { color: 'FFFFFF', transparency: 92 },
    line: { color: BHX },
  })

  // initials badge
  s1.addShape('ellipse', {
    x: 0.8, y: 1.4, w: 1.8, h: 1.8,
    fill: { color: 'FFFFFF', transparency: 75 },
    line: { color: 'FFFFFF', transparency: 60, pt: 1.5 },
  })
  s1.addText(brand.initials, {
    x: 0.8, y: 1.4, w: 1.8, h: 1.8,
    fontSize: 36, bold: true, color: 'FFFFFF',
    align: 'center', valign: 'middle',
  })

  // brand name
  s1.addText(brand.name, {
    x: 3.0, y: 1.5, w: 9.5, h: 1.0,
    fontSize: 44, bold: true, color: 'FFFFFF',
  })

  // subtitle line
  s1.addText('Informe de contenidos  ·  Mayo 2026', {
    x: 3.0, y: 2.6, w: 9.5, h: 0.5,
    fontSize: 16, color: 'FFFFFF', transparency: 20,
  })

  // industry + country
  s1.addText(`${brand.industry}  ·  ${brand.country}`, {
    x: 3.0, y: 3.2, w: 9.5, h: 0.4,
    fontSize: 13, color: 'FFFFFF', transparency: 35, italic: true,
  })

  // stats row
  const stats = [
    { label: 'Contenidos',  value: String(contents.length) },
    { label: 'Publicados',  value: String(published.length) },
    { label: 'Aprobados',   value: String(approved.length) },
    { label: 'Pendientes',  value: String(pending.length) },
    { label: 'Engagement',  value: avgEng },
  ]
  stats.forEach((s, i) => {
    const bx = 0.8 + i * 2.35
    s1.addShape('roundRect', {
      x: bx, y: 4.9, w: 2.15, h: 1.45,
      fill: { color: 'FFFFFF', transparency: 82 },
      line: { color: 'FFFFFF', transparency: 65, pt: 1 },
      rectRadius: 0.1,
    })
    s1.addText(s.value, {
      x: bx, y: 5.0, w: 2.15, h: 0.75,
      fontSize: 30, bold: true, color: 'FFFFFF',
      align: 'center', valign: 'middle',
    })
    s1.addText(s.label, {
      x: bx, y: 5.75, w: 2.15, h: 0.35,
      fontSize: 10, color: 'FFFFFF', transparency: 25,
      align: 'center',
    })
  })

  // ── SLIDE 2: VISTA CALENDARIO ─────────────────────────────────────────────
  const s2 = prs.addSlide()
  s2.background = { color: 'F8FAFC' }

  // header bar
  s2.addShape('rect', { x: 0, y: 0, w: 13.33, h: 1.05, fill: { color: '111827' }, line: { color: '111827' } })
  s2.addShape('rect', { x: 0, y: 0, w: 0.35, h: 1.05, fill: { color: BHX }, line: { color: BHX } })
  s2.addText('Vista Calendario', { x: 0.55, y: 0, w: 6, h: 1.05, fontSize: 22, bold: true, color: 'FFFFFF', valign: 'middle' })
  s2.addText(`${brand.name}  ·  Mayo 2026`, { x: 6, y: 0, w: 7.1, h: 1.05, fontSize: 12, color: 'FFFFFF', transparency: 30, align: 'right', valign: 'middle' })

  // day headers
  const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const CW = 13.33 / 7        // cell width  ≈ 1.90"
  const GT = 1.05             // grid top
  const HH = 0.38             // header row height
  const CH = (7.5 - GT - HH - 0.12) / 5  // cell height ≈ 1.19"

  DAYS.forEach((d, i) => {
    s2.addShape('rect', { x: i * CW, y: GT, w: CW, h: HH, fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB', pt: 0.5 } })
    s2.addText(d, { x: i * CW, y: GT, w: CW, h: HH, fontSize: 9, bold: true, color: '9CA3AF', align: 'center', valign: 'middle' })
  })

  // calendar cells
  calCells().forEach((cell, idx) => {
    const col = idx % 7
    const row = Math.floor(idx / 7)
    const cx = col * CW
    const cy = GT + HH + row * CH

    s2.addShape('rect', {
      x: cx, y: cy, w: CW, h: CH,
      fill: { color: cell.thisMonth ? 'FFFFFF' : 'F9FAFB' },
      line: { color: 'E5E7EB', pt: 0.5 },
    })
    s2.addText(String(cell.day), {
      x: cx + 0.05, y: cy + 0.04, w: 0.32, h: 0.26,
      fontSize: cell.day === 26 ? 10 : 9,
      bold: cell.thisMonth,
      color: cell.thisMonth ? (cell.day === 26 ? 'FFFFFF' : '374151') : 'D1D5DB',
    })
    // today highlight
    if (cell.thisMonth && cell.day === 26) {
      s2.addShape('ellipse', { x: cx + 0.05, y: cy + 0.04, w: 0.26, h: 0.26, fill: { color: '7C3AED' }, line: { color: '7C3AED' } })
    }

    if (cell.thisMonth) {
      const dayStr = `2026-05-${String(cell.day).padStart(2, '0')}`
      const dayC = contents.filter(c => c.date === dayStr)
      dayC.slice(0, 3).forEach((c, ci) => {
        const n = NET[c.channel]
        const chipY = cy + 0.34 + ci * 0.25
        if (chipY + 0.22 > cy + CH - 0.04) return
        s2.addShape('roundRect', {
          x: cx + 0.05, y: chipY, w: CW - 0.1, h: 0.21,
          fill: { color: n?.dot ?? '94A3B8' },
          line: { color: n?.dot ?? '94A3B8' },
          rectRadius: 0.05,
        })
        s2.addText(`${n?.emoji ?? ''} ${tr(c.title, 16)}`, {
          x: cx + 0.08, y: chipY, w: CW - 0.16, h: 0.21,
          fontSize: 7, color: 'FFFFFF', valign: 'middle',
        })
      })
      if (dayC.length > 3) {
        s2.addText(`+${dayC.length - 3} más`, {
          x: cx + 0.05, y: cy + CH - 0.22, w: CW - 0.1, h: 0.18,
          fontSize: 7, color: '9CA3AF', align: 'right',
        })
      }
    }
  })

  // ── SLIDE 3: VISTA LISTA ─────────────────────────────────────────────────
  const s3 = prs.addSlide()
  s3.background = { color: 'F8FAFC' }

  s3.addShape('rect', { x: 0, y: 0, w: 13.33, h: 1.05, fill: { color: '111827' }, line: { color: '111827' } })
  s3.addShape('rect', { x: 0, y: 0, w: 0.35, h: 1.05, fill: { color: BHX }, line: { color: BHX } })
  s3.addText('Vista Lista', { x: 0.55, y: 0, w: 6, h: 1.05, fontSize: 22, bold: true, color: 'FFFFFF', valign: 'middle' })
  s3.addText(`${brand.name}  ·  ${contents.length} publicaciones`, { x: 6, y: 0, w: 7.1, h: 1.05, fontSize: 12, color: 'FFFFFF', transparency: 30, align: 'right', valign: 'middle' })

  const headerCell = (t: string) => ({ text: t, options: { bold: true, fill: { color: 'F3F4F6' }, color: '6B7280', fontSize: 8, align: 'center', valign: 'middle', margin: [2, 4, 2, 4] } })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableRows: any[][] = [
    ['#', 'Título', 'Canal', 'Formato', 'Estado', 'Fecha', 'Responsable'].map(headerCell),
    ...contents.map((c, i) => {
      const n = NET[c.channel]
      const s = ST[c.status]
      const even = i % 2 === 0
      const bg = even ? 'FFFFFF' : 'F9FAFB'
      const cell = (t: string, opts = {}) => ({ text: t, options: { fontSize: 9, color: '374151', fill: { color: bg }, valign: 'middle', margin: [2, 4, 2, 4], ...opts } })
      return [
        cell(String(i + 1), { align: 'center', color: '9CA3AF' }),
        cell(tr(c.title, 40), { bold: true, color: '111827' }),
        cell(`${n?.emoji ?? ''} ${n?.label ?? c.channel}`, { color: n?.text ?? '374151' }),
        cell(c.format),
        cell(s?.label ?? c.status, { color: s?.dot ?? '374151' }),
        cell(c.date ? c.date.replace('2026-', '') : '—', { align: 'center', color: '9CA3AF' }),
        cell(tr(c.responsible, 20) || '—'),
      ]
    }),
  ]

  s3.addTable(tableRows, {
    x: 0.25, y: 1.25, w: 12.8,
    colW: [0.38, 3.7, 1.5, 1.1, 1.5, 1.12, 3.5],
    border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
    autoPage: true,
    autoPageRepeatHeader: true,
    autoPageHeaderRows: 1,
    newSlideStartY: 0.5,
  })

  // ── SLIDES 4+: DESGLOSE POR CONTENIDO ────────────────────────────────────
  for (const c of contents) {
    const n = NET[c.channel]
    const s = ST[c.status]
    const p = PR[c.priority]
    const sColor = s?.dot ?? '94A3B8'

    // ── Resolve media for the right column ───────────────────────────────────
    // postUrl = link final (gráfica publicada) → fuente de imagen del informe
    // designUrl = link Canva (referencia para diseñadora) → solo enlace secundario
    const imgSrc  = c.postUrl || null
    const canvaSrc = c.designUrl || null
    const canvaLink = false  // Canva never used as main image
    let collageImages: string[] = []      // folder with images → collage
    let singleImage: string | null = null  // single image or video thumbnail
    let isVideo = false
    let folderMeta: FolderResult | null = null

    if (imgSrc && !canvaLink) {
      if (isDriveFolder(imgSrc)) {
        // List folder contents via Drive API
        folderMeta = await listDriveFolder(imgSrc)
        if (folderMeta.images.length > 0) {
          // Fetch up to 4 images in parallel
          const fetches = folderMeta.images.slice(0, 4).map(f =>
            urlToBase64(`https://drive.google.com/uc?export=view&id=${f.id}`)
          )
          const results = await Promise.all(fetches)
          collageImages = results.filter(Boolean) as string[]
        }
        // If no images but has videos, show first video thumbnail
        if (collageImages.length === 0 && folderMeta.videos.length > 0) {
          isVideo = true
          singleImage = await urlToBase64(`https://drive.google.com/thumbnail?id=${folderMeta.videos[0].id}&sz=w1600`)
        }
      } else if (isVideoUrl(imgSrc)) {
        isVideo = true
        const thumbUrl = videoThumbnailUrl(imgSrc)
        if (thumbUrl) {
          singleImage = await urlToBase64(thumbUrl)
        } else {
          // Vimeo: get thumbnail via oEmbed then proxy it
          const vThumb = await vimeoThumbnail(imgSrc)
          if (vThumb) singleImage = await urlToBase64(vThumb)
        }
      } else {
        singleImage = await urlToBase64(imgSrc)
      }
    }

    const slide = prs.addSlide()
    slide.background = { color: 'FFFFFF' }

    // thin accent stripe at top
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.07, fill: { color: sColor }, line: { color: sColor } })

    // header bar
    slide.addShape('rect', { x: 0, y: 0.07, w: 13.33, h: 1.18, fill: { color: '111827' }, line: { color: '111827' } })
    slide.addShape('rect', { x: 0, y: 0.07, w: 0.35, h: 1.18, fill: { color: BHX }, line: { color: BHX } })

    // brand badge
    slide.addShape('roundRect', { x: 0.5, y: 0.25, w: 0.65, h: 0.65, fill: { color: BHX }, line: { color: BHX }, rectRadius: 0.08 })
    slide.addText(brand.initials, { x: 0.5, y: 0.25, w: 0.65, h: 0.65, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })

    // title
    slide.addText(tr(c.title, 55), {
      x: 1.3, y: 0.12, w: 8.0, h: 1.0,
      fontSize: 20, bold: true, color: 'FFFFFF', valign: 'middle',
    })

    // status badge
    slide.addShape('roundRect', { x: 9.5, y: 0.3, w: 1.65, h: 0.42, fill: { color: sColor }, line: { color: sColor }, rectRadius: 0.08 })
    slide.addText(s?.label ?? c.status, { x: 9.5, y: 0.3, w: 1.65, h: 0.42, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })

    // priority badge
    if (p) {
      slide.addShape('roundRect', { x: 11.3, y: 0.3, w: 1.65, h: 0.42, fill: { color: p.bg }, line: { color: p.bg }, rectRadius: 0.08 })
      slide.addText(p.label, { x: 11.3, y: 0.3, w: 1.65, h: 0.42, fontSize: 9, bold: true, color: p.text, align: 'center', valign: 'middle' })
    }

    // ── LEFT COLUMN ──────────────────────────────────────────────────────
    const LX = 0.4
    const LW = 6.3
    let ly = 1.42

    // channel chip
    slide.addShape('roundRect', { x: LX, y: ly, w: 1.7, h: 0.36, fill: { color: n?.bg ?? 'F3F4F6' }, line: { color: n?.bg ?? 'F3F4F6' }, rectRadius: 0.08 })
    slide.addText(`${n?.emoji ?? ''} ${n?.label ?? c.channel}`, { x: LX, y: ly, w: 1.7, h: 0.36, fontSize: 10, bold: true, color: n?.text ?? '374151', align: 'center', valign: 'middle' })

    // date chip
    if (c.date) {
      slide.addShape('roundRect', { x: LX + 1.82, y: ly, w: 1.8, h: 0.36, fill: { color: 'F3F4F6' }, line: { color: 'F3F4F6' }, rectRadius: 0.08 })
      slide.addText(`📅 ${c.date.replace('2026-', '')}${c.time ? '  ' + c.time : ''}`, { x: LX + 1.82, y: ly, w: 1.8, h: 0.36, fontSize: 9, color: '4B5563', align: 'center', valign: 'middle' })
    }

    // format chip
    slide.addShape('roundRect', { x: LX + 3.74, y: ly, w: 1.2, h: 0.36, fill: { color: 'F3F4F6' }, line: { color: 'F3F4F6' }, rectRadius: 0.08 })
    slide.addText(c.format, { x: LX + 3.74, y: ly, w: 1.2, h: 0.36, fontSize: 9, color: '6B7280', align: 'center', valign: 'middle' })

    ly += 0.52

    // campaign
    if (c.campaign) {
      slide.addText(`📁 ${c.campaign}`, { x: LX, y: ly, w: LW, h: 0.3, fontSize: 10, color: '7C3AED', italic: true })
      ly += 0.38
    }

    // COPY label
    slide.addText('COPY', { x: LX, y: ly, w: LW, h: 0.24, fontSize: 8, bold: true, color: '9CA3AF' })
    ly += 0.27

    const copyText = c.copy || '—'
    const copyLines = Math.min(9, Math.max(3, Math.ceil(copyText.length / 62)))
    const copyH = copyLines * 0.215

    slide.addShape('roundRect', { x: LX, y: ly, w: LW, h: copyH + 0.22, fill: { color: 'F9FAFB' }, line: { color: 'E5E7EB', pt: 0.5 }, rectRadius: 0.1 })
    slide.addText(copyText, { x: LX + 0.15, y: ly + 0.1, w: LW - 0.3, h: copyH, fontSize: 10, color: '374151', wrap: true })
    ly += copyH + 0.36

    // CTA
    if (c.cta && ly < 6.8) {
      slide.addText('CTA', { x: LX, y: ly, w: LW, h: 0.24, fontSize: 8, bold: true, color: '9CA3AF' })
      ly += 0.27
      slide.addShape('roundRect', { x: LX, y: ly, w: LW, h: 0.36, fill: { color: 'EDE9FE' }, line: { color: 'DDD6FE', pt: 0.5 }, rectRadius: 0.08 })
      slide.addText(`→  ${c.cta}`, { x: LX + 0.12, y: ly, w: LW - 0.24, h: 0.36, fontSize: 11, bold: true, color: '7C3AED', valign: 'middle' })
      ly += 0.5
    }

    // Hashtags
    if (c.hashtags && ly < 6.8) {
      slide.addText('HASHTAGS', { x: LX, y: ly, w: LW, h: 0.24, fontSize: 8, bold: true, color: '9CA3AF' })
      ly += 0.27
      slide.addText(tr(c.hashtags, 120), { x: LX, y: ly, w: LW, h: 0.4, fontSize: 9, color: '0369A1', wrap: true })
      ly += 0.5
    }

    // responsible
    if (c.responsible && ly < 7.2) {
      slide.addText(`👤  ${c.responsible}`, { x: LX, y: ly, w: LW, h: 0.3, fontSize: 10, color: '6B7280' })
    }

    // ── RIGHT COLUMN: IMAGE ──────────────────────────────────────────────
    const RX = 7.0
    const RW = 5.9
    const RY = 1.42
    const RH = 5.85

    if (collageImages.length > 0) {
      // ── Collage (folder with images) ────────────────────────────────────
      addCollage(slide, collageImages, RX, RY, RW, RH)

      // "N more" badge if folder has more than 4 images
      const extra = (folderMeta?.images.length ?? 0) - collageImages.length
      if (extra > 0) {
        slide.addShape('roundRect', { x: RX + RW - 1.1, y: RY + 0.12, w: 0.95, h: 0.38, fill: { color: '111827', transparency: 30 }, line: { color: '111827', transparency: 30 }, rectRadius: 0.06 })
        slide.addText(`+${extra} más`, { x: RX + RW - 1.1, y: RY + 0.12, w: 0.95, h: 0.38, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
      }

      // Sub-folder / video indicators
      const badges: string[] = []
      if (folderMeta?.folders.length) badges.push(`📁 ${folderMeta.folders.length} carpeta${folderMeta.folders.length > 1 ? 's' : ''}`)
      if (folderMeta?.videos.length)  badges.push(`🎬 ${folderMeta.videos.length} video${folderMeta.videos.length > 1 ? 's' : ''}`)
      if (badges.length > 0) {
        slide.addShape('roundRect', { x: RX + 0.1, y: RY + 0.12, w: 2.4, h: 0.38, fill: { color: '111827', transparency: 30 }, line: { color: '111827', transparency: 30 }, rectRadius: 0.06 })
        slide.addText(badges.join('  '), { x: RX + 0.1, y: RY + 0.12, w: 2.4, h: 0.38, fontSize: 8, color: 'FFFFFF', align: 'center', valign: 'middle' })
      }

      // Clickable link overlay at bottom
      if (imgSrc) {
        slide.addShape('roundRect', { x: RX + 0.7, y: RY + RH - 0.7, w: RW - 1.4, h: 0.45, fill: { color: '111827', transparency: 45 }, line: { color: '111827', transparency: 45 }, rectRadius: 0.06 })
        slide.addText('🔗  Abrir carpeta', { x: RX + 0.7, y: RY + RH - 0.7, w: RW - 1.4, h: 0.45, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', hyperlink: { url: imgSrc } })
      }
      // Canva reference link
      if (canvaSrc) {
        slide.addShape('roundRect', { x: RX + 0.1, y: RY + RH - 0.55, w: 1.5, h: 0.36, fill: { color: '7C3AED', transparency: 30 }, line: { color: '7C3AED', transparency: 30 }, rectRadius: 0.06 })
        slide.addText('🎨 Canva', { x: RX + 0.1, y: RY + RH - 0.55, w: 1.5, h: 0.36, fontSize: 8, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', hyperlink: { url: canvaSrc } })
      }

    } else if (singleImage) {
      // ── Single image or video thumbnail ─────────────────────────────────
      slide.addImage({ data: singleImage, x: RX, y: RY, w: RW, h: RH, sizing: { type: 'contain', w: RW, h: RH } })
      if (isVideo) {
        addPlayOverlay(slide, RX, RY, RW, RH)
        if (imgSrc) {
          slide.addShape('roundRect', { x: RX + 0.7, y: RY + RH - 0.7, w: RW - 1.4, h: 0.45, fill: { color: '111827', transparency: 45 }, line: { color: '111827', transparency: 45 }, rectRadius: 0.06 })
          slide.addText('▶  Ver video', { x: RX + 0.7, y: RY + RH - 0.7, w: RW - 1.4, h: 0.45, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', hyperlink: { url: imgSrc } })
        }
      }
      // Canva reference link (small badge, bottom-left)
      if (canvaSrc) {
        slide.addShape('roundRect', { x: RX + 0.1, y: RY + RH - 0.55, w: 1.5, h: 0.36, fill: { color: '7C3AED', transparency: 30 }, line: { color: '7C3AED', transparency: 30 }, rectRadius: 0.06 })
        slide.addText('🎨 Canva', { x: RX + 0.1, y: RY + RH - 0.55, w: 1.5, h: 0.36, fontSize: 8, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', hyperlink: { url: canvaSrc } })
      }

    } else {
      // ── Placeholder ──────────────────────────────────────────────────────
      const isFolderNoKey = isDriveFolder(imgSrc ?? '') && folderMeta?.noApiKey
      const isFolderEmpty = isDriveFolder(imgSrc ?? '') && !folderMeta?.noApiKey && (folderMeta?.total ?? 0) === 0
      const icon  = canvaLink ? '🎨' : isDriveFolder(imgSrc ?? '') ? '📁' : isVideo ? '🎬' : (n?.emoji ?? '🖼')
      const label = canvaLink         ? 'Diseño en Canva'
                  : isFolderNoKey     ? 'Carpeta de Drive'
                  : isFolderEmpty     ? 'Carpeta vacía'
                  : isDriveFolder(imgSrc ?? '') ? 'Solo carpetas / videos'
                  : isVideo           ? 'Previsualizando video…'
                  : 'Sin imagen'
      const note  = isFolderNoKey ? 'Configura GOOGLE_DRIVE_API_KEY para ver imágenes'
                  : canvaLink     ? 'Abre el diseño en Canva'
                  : ''

      slide.addShape('roundRect', { x: RX, y: RY, w: RW, h: RH, fill: { color: 'F3F4F6' }, line: { color: 'E5E7EB', pt: 1 }, rectRadius: 0.15 })
      slide.addText(`${icon}\n\n${label}`, { x: RX, y: RY + 1.5, w: RW, h: 1.6, fontSize: 16, color: 'D1D5DB', align: 'center', valign: 'middle' })
      if (note) slide.addText(note, { x: RX + 0.3, y: RY + 3.4, w: RW - 0.6, h: 0.5, fontSize: 9, color: 'C4B5FD', align: 'center', wrap: true })
      const linkSrc = imgSrc || canvaSrc
      if (linkSrc) {
        slide.addShape('roundRect', { x: RX + 0.7, y: RY + RH - 0.85, w: RW - 1.4, h: 0.52, fill: { color: 'EDE9FE' }, line: { color: 'DDD6FE', pt: 0.5 }, rectRadius: 0.08 })
        slide.addText(`🔗  Ver ${canvaLink ? 'diseño' : isDriveFolder(linkSrc) ? 'carpeta' : 'enlace'}`, {
          x: RX + 0.7, y: RY + RH - 0.85, w: RW - 1.4, h: 0.52,
          fontSize: 11, bold: true, color: '7C3AED', align: 'center', valign: 'middle',
          hyperlink: { url: linkSrc },
        })
      }
    }
  }

  // ── SLIDE FINAL: RESUMEN ──────────────────────────────────────────────────
  const sf = prs.addSlide()
  sf.background = { color: BHX }
  sf.addShape('ellipse', { x: -2, y: -2, w: 7, h: 7, fill: { color: 'FFFFFF', transparency: 90 }, line: { color: BHX } })
  sf.addShape('ellipse', { x: 10, y: 4, w: 5, h: 5, fill: { color: 'FFFFFF', transparency: 92 }, line: { color: BHX } })
  sf.addText(brand.name, { x: 1, y: 2.5, w: 11.33, h: 1.0, fontSize: 36, bold: true, color: 'FFFFFF', align: 'center' })
  sf.addText(`${contents.length} publicaciones · Mayo 2026`, { x: 1, y: 3.6, w: 11.33, h: 0.55, fontSize: 18, color: 'FFFFFF', transparency: 25, align: 'center' })
  sf.addText('Generado por Kimce Content Hub', { x: 1, y: 6.7, w: 11.33, h: 0.4, fontSize: 10, color: 'FFFFFF', transparency: 45, align: 'center' })

  const blob = await prs.write({ outputType: 'blob' }) as Blob
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${brand.name} - Mayo 2026.pptx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
