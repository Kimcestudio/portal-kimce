'use strict'
const { onRequest } = require('firebase-functions/v2/https')

const NOTION_VERSION = '2022-06-28'

function notionToken() { return process.env.NOTION_TOKEN }
function notionDbId()  { return process.env.NOTION_DB_ID }

function notionFetch(path, method = 'GET', body) {
  return fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${notionToken()}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── Cache de usuarios Notion (nombre/email → id) ──────────────────────────────
// Se refresca cada 10 minutos para no llamar la API en cada guardado
let _userMap = null
let _userMapAt = 0

async function getNotionUserMap() {
  if (_userMap && Date.now() - _userMapAt < 10 * 60 * 1000) return _userMap
  try {
    const users = []
    let cursor
    do {
      const url = cursor ? `/users?start_cursor=${cursor}&page_size=100` : '/users?page_size=100'
      const r = await notionFetch(url)
      if (!r.ok) break
      const data = await r.json()
      users.push(...(data.results ?? []))
      cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
    } while (cursor)

    const map = {}
    for (const u of users) {
      if (u.type !== 'person') continue
      const name  = u.name?.trim()
      const email = u.person?.email?.trim()
      if (name)  map[name.toLowerCase()]  = u.id
      if (email) map[email.toLowerCase()] = u.id
    }
    _userMap   = map
    _userMapAt = Date.now()
  } catch {
    _userMap = _userMap ?? {}
  }
  return _userMap
}

// ── Property readers ──────────────────────────────────────────────────────────

function txt(prop) {
  if (!prop) return ''
  const arr = prop.rich_text ?? prop.title ?? []
  return arr.map(t => t.plain_text).join('').trim()
}
function sel(prop)  { return prop?.select?.name ?? '' }
function ms(prop)   { return (prop?.multi_select ?? []).map(x => x.name) }
function chk(prop)  { return prop?.checkbox ?? false }
function dt(prop)   { return prop?.date?.start ?? null }
function url(prop)  { return prop?.url ?? null }

// Lee nombres de campos tipo "people" — o cae a rich_text si no es people
function peopleNames(prop) {
  if (!prop) return []
  const arr = prop.people ?? []
  if (arr.length > 0) return arr.map(u => u.name ?? u.person?.email ?? '').filter(Boolean)
  // fallback rich_text
  const rt = prop.rich_text ?? []
  const raw = rt.map(t => t.plain_text).join('').trim()
  return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : []
}

// Lee una URL de campo url, rich_text o formula
function readUrl(prop) {
  if (!prop) return undefined
  if (prop.url) return prop.url
  return txt(prop) || undefined
}

// ── Mapas de conversión ───────────────────────────────────────────────────────

const RED_TO_CHANNEL = {
  'IG':           'instagram',
  'FB':           'facebook',
  'FB Comunidad': 'fb_comunidad',
  'Tik Tok':      'tiktok',
  'Linkedin':     'linkedin',
  'Whatsapp':     'whatsapp',
  'Correo':       'email',
  'YouTube':      'youtube',
  'Blog':         'blog',
  'Web':          'web',
  'Stories':      'stories',
}

const CHANNEL_TO_RED = {
  instagram:    'IG',
  facebook:     'FB',
  fb_comunidad: 'FB Comunidad',
  tiktok:       'Tik Tok',
  linkedin:     'Linkedin',
  whatsapp:     'Whatsapp',
  email:        'Correo',
  youtube:      'YouTube',
  blog:         'Blog',
  web:          'Web',
  stories:      'Stories',
}

const CHANNEL_PRIORITY = ['instagram','tiktok','facebook','linkedin','whatsapp','email','fb_comunidad']

const FORMAT_MAP = {
  'Reel':      'Reel',
  'Post':      'Post',
  'Historia':  'Historia',
  'Carrusel':  'Carrusel',
  'Gif':       'Post',
  'Gráfica':   'Post',
  'Encuesta':  'Post',
  'Portada':   'Post',
  'Triada':    'Carrusel',
  'Canva':     'Post',
  'Highlight': 'Historia',
  'Video':     'Video',
  'Blog':      'Blog',
  'Email':     'Email',
  'Story':     'Story',
  'Short':     'Short',
  'Mensaje':   'Mensaje',
}

// Notion status → portal status (simplificado)
const STATUS_MAP = {
  // Nuevos simplificados
  idea:        'idea',
  produccion:  'produccion',
  revision:    'revision',
  aprobado:    'aprobado',
  programado:  'programado',
  publicado:   'publicado',
  // Legacy Notion → mapean a los nuevos
  redaccion:   'produccion',
  diseno:      'produccion',
  audiovisual: 'produccion',
  enviado:     'revision',
  cambios:     'revision',
  finalizado:  'aprobado',
  reportado:   'publicado',
}

const BRAND_CONFIG = {
  'Fundación Belcorp': { color: '#a855f7', industry: 'Fundación / ONGs',  channels: ['instagram','facebook','linkedin','tiktok'], country: 'Perú' },
  'Kimce Studio':      { color: '#7c3aed', industry: 'Agencia / Estudio', channels: ['instagram','tiktok','linkedin'],             country: 'Perú' },
  'Comunidad MSL':     { color: '#0ea5e9', industry: 'Comunidad',         channels: ['instagram','facebook','fb_comunidad','whatsapp'], country: 'Perú' },
  'KZC':               { color: '#3b82f6', industry: 'General',           channels: ['instagram','tiktok'],                        country: 'Perú' },
  'EBALAB':            { color: '#22c55e', industry: 'General',           channels: ['instagram','linkedin'],                      country: 'Perú' },
  'VALENTINO':         { color: '#ef4444', industry: 'Moda / Lujo',       channels: ['instagram','facebook'],                      country: 'Perú' },
  'ALTIVIA':           { color: '#f97316', industry: 'General',           channels: ['instagram','tiktok'],                        country: 'Perú' },
  'TRIAL':             { color: '#64748b', industry: 'General',           channels: ['instagram'],                                 country: 'Perú' },
  'GOTZA':             { color: '#1e40af', industry: 'General',           channels: ['instagram','tiktok'],                        country: 'Perú' },
}

const AUTO_COLORS = ['#7c3aed','#3b82f6','#ef4444','#22c55e','#f59e0b','#0ea5e9','#ec4899','#14b8a6','#f97316','#6366f1']

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBrandId(name) {
  return 'brand-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20)
}

function mapStatus(notionStatus, publicado, realizado) {
  if (notionStatus && STATUS_MAP[notionStatus]) return STATUS_MAP[notionStatus]
  if (realizado || publicado) return 'publicado'
  return 'aprobado'
}

// ── Notion page → Content ─────────────────────────────────────────────────────

function pageToContent(page) {
  const p = page.properties
  const title = txt(p.Tarea)
  if (!title) return null
  const clienteName = sel(p.Cliente)
  if (!clienteName) return null

  // Canales
  const reds = ms(p.Red).map(r => RED_TO_CHANNEL[r]).filter(Boolean)
  const channels = reds.length > 0 ? reds : ['instagram']
  const channel  = CHANNEL_PRIORITY.find(c => channels.includes(c)) ?? channels[0]

  // Formato
  const formatos = ms(p.Formato)
  const format   = FORMAT_MAP[formatos[0]] ?? 'Post'

  // Estado
  const notionStatus = sel(p.Estado_CM)
  const status = mapStatus(notionStatus, chk(p.Publicado), chk(p.Realizado))

  // Equipo: campo Responsable (people type) — fuente única de verdad
  const allTeam = [...new Set(peopleNames(p.Responsable))]

  // Links por canal (campo URL de Notion si existe, o fallback a Link genérico)
  const linkIG = readUrl(p.Link_IG) ?? readUrl(p.Link_Instagram)
  const linkFB = readUrl(p.Link_FB) ?? readUrl(p.Link_Facebook)
  const linkTT = readUrl(p.Link_TT) ?? readUrl(p.Link_TikTok)
  const linkLI = readUrl(p.Link_LI) ?? readUrl(p.Link_LinkedIn)
  const linkWA = readUrl(p.Link_WA) ?? readUrl(p.Link_WhatsApp)
  const linkGenerico = readUrl(p.Link) ?? txt(p.Link)

  // Si no hay links específicos por canal, usar el link genérico para el canal primario
  const channelUrls = {}
  if (linkIG) channelUrls.instagram = linkIG
  if (linkFB) channelUrls.facebook  = linkFB
  if (linkTT) channelUrls.tiktok    = linkTT
  if (linkLI) channelUrls.linkedin  = linkLI
  if (linkWA) channelUrls.whatsapp  = linkWA
  if (!Object.keys(channelUrls).length && linkGenerico) {
    channelUrls[channel] = linkGenerico
  }

  return {
    id:          'n-' + page.id.replace(/-/g, '').slice(0, 20),
    notionPageId: page.id,
    brandId:     buildBrandId(clienteName),
    title,
    channel,
    channels,
    format,
    date:     dt(p.Publicación),
    dueDate:  dt(p.Finalización),
    time:     txt(p.Hora) || null,
    status,
    priority: sel(p.Prioridad)?.toLowerCase() || 'media',
    responsible:  allTeam[0] || '',
    responsables: allTeam.length > 0 ? allTeam : undefined,
    dueAssignee:  peopleNames(p.Responsable_Entrega)[0] || txt(p.Responsable_Entrega) || undefined,
    tags: [],
    copy:          txt(p.Copy),
    cta:           txt(p.CTA)      || undefined,
    hashtags:      txt(p.Hashtags) || undefined,
    message:       txt(p.Mensaje)  || undefined,
    designUrl:     txt(p.CANVA)    || undefined,
    driveUrl:      txt(p.Drive)    || undefined,
    postUrl:       linkGenerico    || undefined,
    pag:           (() => { const v = txt(p.PAG); return (v && !v.startsWith('n-')) ? v : undefined })(),
    channelUrls:   Object.keys(channelUrls).length > 0 ? channelUrls : undefined,
    approvalStatus: ['aprobado','programado','publicado'].includes(status) ? 'approved' : 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ── Content → Notion properties ───────────────────────────────────────────────

function contentToProperties(content, userMap = {}) {
  const props = {}

  if (content.title     !== undefined) props.Tarea    = { title: [{ text: { content: content.title } }] }
  if (content.brandName !== undefined) props.Cliente  = { select: { name: content.brandName } }

  // Canales
  if (content.channels?.length > 0) {
    const reds = content.channels.map(ch => ({ name: CHANNEL_TO_RED[ch] })).filter(x => x.name)
    if (reds.length) props.Red = { multi_select: reds }
  } else if (content.channel !== undefined) {
    const red = CHANNEL_TO_RED[content.channel]
    if (red) props.Red = { multi_select: [{ name: red }] }
  }

  // Formato
  if (content.format !== undefined) props.Formato = { multi_select: [{ name: content.format }] }

  // Fechas
  if (content.date    !== undefined) props.Publicación = content.date    ? { date: { start: content.date } }    : { date: null }
  if (content.dueDate !== undefined) props.Finalización = content.dueDate ? { date: { start: content.dueDate } } : { date: null }
  if (content.time    !== undefined) props.Hora = { rich_text: [{ text: { content: content.time ?? '' } }] }

  // Estado
  if (content.status !== undefined) {
    props.Estado_CM = { select: { name: content.status } }
    const isDone = content.status === 'publicado'
    props.Publicado = { checkbox: isDone }
    props.Realizado = { checkbox: isDone }
    // Estado (campo legado) se omite — puede ser tipo formula/rollup y rompe el PATCH entero
  }

  // Prioridad
  if (content.priority !== undefined) {
    const p = content.priority
    props.Prioridad = { select: { name: p.charAt(0).toUpperCase() + p.slice(1) } }
  }

  // Responsable (people type) — fuente única de verdad, se escribe con IDs de Notion
  if (content.responsables !== undefined) {
    const people = (content.responsables ?? [])
      .map(name => userMap[name?.toLowerCase()])
      .filter(Boolean)
      .map(id => ({ id }))
    if (people.length > 0 || content.responsables.length === 0)
      props.Responsable = { people }
  }

  // Responsable de entrega — escribe aunque esté vacío para permitir borrado
  if (content.dueAssignee !== undefined)
    props.Responsable_Entrega = { rich_text: [{ text: { content: content.dueAssignee ?? '' } }] }

  // Copy / texto — siempre se escribe para permitir borrado en Notion
  if (content.copy      !== undefined) props.Copy     = { rich_text: [{ text: { content: (content.copy ?? '').slice(0, 2000) } }] }
  if (content.hashtags  !== undefined) props.Hashtags = { rich_text: [{ text: { content: content.hashtags ?? '' } }] }
  if (content.cta       !== undefined) props.CTA      = { rich_text: [{ text: { content: content.cta ?? '' } }] }
  if (content.message   !== undefined) props.Mensaje  = { rich_text: [{ text: { content: (content.message ?? '').slice(0, 2000) } }] }

  // Links de producción
  if (content.designUrl !== undefined) props.CANVA = { rich_text: [{ text: { content: content.designUrl ?? '' } }] }
  if (content.driveUrl  !== undefined) props.Drive = { rich_text: [{ text: { content: content.driveUrl ?? '' } }] }

  // Link genérico — null limpia la URL en Notion
  if (content.postUrl !== undefined)
    props.Link = { url: content.postUrl || null }

  // Links por canal — null limpia; se escribe aunque esté vacío para permitir borrado
  if (content.channelUrls) {
    const cu = content.channelUrls
    if ('instagram' in cu) props.Link_IG = { url: cu.instagram || null }
    if ('facebook'  in cu) props.Link_FB = { url: cu.facebook  || null }
    if ('tiktok'    in cu) props.Link_TT = { url: cu.tiktok    || null }
    if ('linkedin'  in cu) props.Link_LI = { url: cu.linkedin  || null }
    if ('whatsapp'  in cu) props.Link_WA = { url: cu.whatsapp  || null }
  }

  // PAG — identificador editable sincronizado con Notion
  if (content.pag !== undefined)
    props.PAG = { rich_text: [{ text: { content: content.pag ?? '' } }] }

  return props
}

// ── Brand builder ─────────────────────────────────────────────────────────────

function buildBrandsFromNames(names) {
  const now = new Date().toISOString()
  return names.map((name, i) => {
    const cfg = BRAND_CONFIG[name]
    return {
      id:        buildBrandId(name),
      name,
      initials:  name.split(/[\s/]+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(),
      color:     cfg?.color    ?? AUTO_COLORS[i % AUTO_COLORS.length],
      industry:  cfg?.industry ?? 'General',
      country:   cfg?.country  ?? 'Perú',
      responsible: '',
      status:   'active',
      channels: cfg?.channels ?? ['instagram'],
      links:    {},
      createdAt: now,
      updatedAt: now,
    }
  })
}

// ── Helpers de URL ────────────────────────────────────────────────────────────

function toDriveDirectUrl(url) {
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
  if (fileMatch) return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`
  const openMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/)
  if (openMatch) return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`
  const docsMatch = url.match(/docs\.google\.com\/.*\/d\/([^/?]+)/)
  if (docsMatch) return `https://drive.google.com/uc?export=view&id=${docsMatch[1]}`
  return url
}

function getDateFilter() {
  const from = new Date()
  from.setMonth(from.getMonth() - 4)
  return from.toISOString().slice(0, 10)
}

// Campos que definitivamente existen en cualquier DB conectada al portal
const CORE_NOTION_KEYS = [
  'Tarea', 'Cliente', 'Red', 'Formato',
  'Publicación', 'Finalización', 'Hora',
  'Estado_CM', 'Publicado', 'Realizado', 'Prioridad',
  'Copy', 'CTA', 'Hashtags', 'Mensaje',
  'CANVA', 'Drive', 'Link', 'PAG',
  'Responsable', 'Responsable_Entrega',
]

// ── Firebase Functions ────────────────────────────────────────────────────────

const OPTS = { region: 'us-central1', timeoutSeconds: 60 }

const notionContent = onRequest(OPTS, async (req, res) => {
  if (!notionToken()) { res.status(500).json({ error: 'NOTION_TOKEN not set' }); return }

  // GET — leer contenidos y marcas
  if (req.method === 'GET') {
    try {
      const pages = []
      let cursor
      const fromDate = getDateFilter()
      do {
        const body = {
          page_size: 100,
          filter: {
            or: [
              { and: [{ property: 'Publicación', date: { on_or_after: fromDate } }, { property: 'Tarea', title: { is_not_empty: true } }] },
              { and: [{ property: 'Publicación', date: { is_empty: true } }, { property: 'Finalización', date: { is_empty: true } }, { property: 'Tarea', title: { is_not_empty: true } }] },
              { and: [{ property: 'Estado_CM', select: { is_not_empty: true } }, { property: 'Tarea', title: { is_not_empty: true } }] },
            ],
          },
          sorts: [{ property: 'Publicación', direction: 'descending' }],
        }
        if (cursor) body.start_cursor = cursor
        const r = await notionFetch(`/databases/${notionDbId()}/query`, 'POST', body)
        if (!r.ok) { res.status(r.status).json({ error: await r.json() }); return }
        const data = await r.json()
        pages.push(...data.results)
        cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
      } while (cursor)

      const uniqueClients = new Set()
      for (const page of pages) {
        const name = page.properties.Cliente?.select?.name
        if (name) uniqueClients.add(name)
      }
      const brands   = buildBrandsFromNames(Array.from(uniqueClients))
      const contents = pages.map(p => pageToContent(p)).filter(Boolean)
      res.set('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
      res.json({ contents, brands })
    } catch (err) { res.status(500).json({ error: String(err) }) }
    return
  }

  // POST — crear página en Notion
  if (req.method === 'POST') {
    try {
      const { brandName, ...content } = req.body
      const userMap = await getNotionUserMap()
      const allProps = contentToProperties({ ...content, brandName }, userMap)

      let r = await notionFetch('/pages', 'POST', {
        parent: { database_id: notionDbId() },
        properties: allProps,
      })

      // Si Notion rechaza con 400, algún campo no existe en esta DB → reintentamos con core
      if (r.status === 400) {
        const notionErr = await r.json()
        console.warn('[notionContent POST] 400 con todos los campos:', JSON.stringify(notionErr))
        const coreProps = Object.fromEntries(
          Object.entries(allProps).filter(([k]) => CORE_NOTION_KEYS.includes(k))
        )
        r = await notionFetch('/pages', 'POST', {
          parent: { database_id: notionDbId() },
          properties: coreProps,
        })
      }

      if (!r.ok) { res.status(r.status).json({ error: await r.json() }); return }
      const page = await r.json()
      res.json({ notionPageId: page.id })
    } catch (err) { res.status(500).json({ error: String(err) }) }
    return
  }

  // PATCH — actualizar página
  if (req.method === 'PATCH') {
    try {
      const { notionPageId, brandName, ...content } = req.body
      if (!notionPageId) { res.status(400).json({ error: 'notionPageId required' }); return }

      const userMap = await getNotionUserMap()
      const allProps = contentToProperties({ ...content, brandName }, userMap)
      let r = await notionFetch(`/pages/${notionPageId}`, 'PATCH', { properties: allProps })

      // Si Notion rechaza con 400, algún campo opcional no existe en esta DB
      // Reintentamos solo con los campos core garantizados
      if (r.status === 400) {
        const notionErr = await r.json()
        console.warn('[notionContent PATCH] 400 con todos los campos:', JSON.stringify(notionErr))
        const coreProps = Object.fromEntries(
          Object.entries(allProps).filter(([k]) => CORE_NOTION_KEYS.includes(k))
        )
        r = await notionFetch(`/pages/${notionPageId}`, 'PATCH', { properties: coreProps })
      }

      if (!r.ok) { res.status(r.status).json({ error: await r.json() }); return }
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: String(err) }) }
    return
  }

  // DELETE — archivar página
  if (req.method === 'DELETE') {
    try {
      const { notionPageId } = req.body
      if (!notionPageId) { res.status(400).json({ error: 'notionPageId required' }); return }
      const r = await notionFetch(`/pages/${notionPageId}`, 'PATCH', { archived: true })
      if (!r.ok) { res.status(r.status).json({ error: await r.json() }); return }
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: String(err) }) }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
})

const notionBlocks = onRequest({ ...OPTS, timeoutSeconds: 30 }, async (req, res) => {
  if (!notionToken()) { res.status(500).json({ error: 'NOTION_TOKEN not set' }); return }
  const pageId = req.query.pageId
  if (!pageId) { res.status(400).json({ error: 'pageId required' }); return }
  try {
    const r = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      headers: { Authorization: `Bearer ${notionToken()}`, 'Notion-Version': NOTION_VERSION },
    })
    if (!r.ok) { res.status(r.status).json({ error: await r.json() }); return }
    const data = await r.json()
    const lines = []
    for (const block of data.results) {
      const content = block[block.type]
      const text = (content?.rich_text ?? []).map(t => t.plain_text).join('')
      if (text.trim()) lines.push(text)
    }
    res.json({ text: lines.join('\n') })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

const notionPull = onRequest(OPTS, async (req, res) => {
  if (!notionToken()) { res.status(500).json({ error: 'NOTION_TOKEN not set' }); return }
  try {
    const results = []
    let cursor
    do {
      const body = { page_size: 100, filter: { property: 'PAG', rich_text: { is_not_empty: true } } }
      if (cursor) body.start_cursor = cursor
      const r = await notionFetch(`/databases/${notionDbId()}/query`, 'POST', body)
      if (!r.ok) { res.status(r.status).json({ error: await r.json() }); return }
      const data = await r.json()
      results.push(...data.results)
      cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
    } while (cursor)
    const entries = results.map(page => ({
      notionPageId: page.id,
      contentId:    txt(page.properties.PAG),
      publicado:    chk(page.properties.Publicado),
      realizado:    chk(page.properties.Realizado),
      link:         txt(page.properties.Link),
    }))
    res.json({ entries })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

const proxyImage = onRequest({ ...OPTS, timeoutSeconds: 30 }, async (req, res) => {
  const raw = req.query.url
  if (!raw) { res.status(400).json({ error: 'url required' }); return }
  let targetUrl
  try { targetUrl = toDriveDirectUrl(decodeURIComponent(raw)) }
  catch { res.status(400).json({ error: 'invalid url' }); return }
  try {
    const r = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
    if (!r.ok) { res.status(r.status).json({ error: `upstream ${r.status}` }); return }
    const contentType = r.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) { res.status(415).json({ error: 'not an image' }); return }
    const buffer = Buffer.from(await r.arrayBuffer())
    res.json({ data: `data:${contentType};base64,${buffer.toString('base64')}` })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

const driveFolder = onRequest({ ...OPTS, timeoutSeconds: 30 }, async (req, res) => {
  const API_KEY = process.env.GOOGLE_DRIVE_API_KEY
  const folderUrl = req.query.url
  if (!folderUrl) { res.status(400).json({ error: 'url required' }); return }
  const m = folderUrl.match(/folders\/([^/?&#]+)/)
  const folderId = m?.[1]
  if (!folderId) { res.status(400).json({ error: 'not a folder url' }); return }
  if (!API_KEY) { res.json({ noApiKey: true, images: [], videos: [], folders: [], total: 0 }); return }
  try {
    const q    = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const flds = encodeURIComponent('files(id,name,mimeType)')
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&key=${API_KEY}&fields=${flds}&orderBy=name&pageSize=50`)
    if (!r.ok) { const err = await r.json(); res.status(r.status).json({ error: err, images: [], videos: [], folders: [], total: 0 }); return }
    const data = await r.json()
    const files = data.files ?? []
    res.json({
      images:  files.filter(f => f.mimeType.startsWith('image/')),
      videos:  files.filter(f => f.mimeType.startsWith('video/')),
      folders: files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
      total:   files.length,
    })
  } catch (err) { res.status(500).json({ error: String(err), images: [], videos: [], folders: [], total: 0 }) }
})

// ── Migración completa Notion → Firebase (sin filtro de fecha) ────────────────

const notionMigrate = onRequest({ ...OPTS, timeoutSeconds: 300 }, async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (!notionToken()) { res.status(500).json({ error: 'NOTION_TOKEN not set' }); return }

  try {
    const pages = []
    let cursor
    do {
      const body = {
        page_size: 100,
        filter: { property: 'Tarea', title: { is_not_empty: true } },
        sorts: [{ property: 'Publicación', direction: 'descending' }],
      }
      if (cursor) body.start_cursor = cursor
      const r = await notionFetch(`/databases/${notionDbId()}/query`, 'POST', body)
      if (!r.ok) { res.status(r.status).json({ error: await r.json() }); return }
      const data = await r.json()
      pages.push(...data.results)
      cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
    } while (cursor)

    const uniqueClients = new Set()
    for (const page of pages) {
      const name = page.properties.Cliente?.select?.name
      if (name) uniqueClients.add(name)
    }
    const brands   = buildBrandsFromNames(Array.from(uniqueClients))
    const contents = pages.map(p => pageToContent(p)).filter(Boolean)
    res.set('Access-Control-Allow-Origin', '*')
    res.json({ contents, brands, total: pages.length })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

module.exports = { notionContent, notionBlocks, notionPull, proxyImage, driveFolder, notionMigrate }

