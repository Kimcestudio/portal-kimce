import { NextResponse } from 'next/server'

const NOTION_TOKEN   = process.env.NOTION_TOKEN
const NOTION_DB_ID   = process.env.NOTION_DB_ID
const NOTION_VERSION = '2022-06-28'

function notionFetch(path: string, method = 'GET', body?: object) {
  return fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionProp = any

function txt(prop: NotionProp): string {
  if (!prop) return ''
  const arr = prop.rich_text ?? prop.title ?? []
  return arr.map((t: NotionProp) => t.plain_text).join('').trim()
}
function sel(prop: NotionProp): string  { return prop?.select?.name ?? '' }
function ms(prop: NotionProp): string[] { return (prop?.multi_select ?? []).map((x: NotionProp) => x.name) }
function chk(prop: NotionProp): boolean { return prop?.checkbox ?? false }
function dt(prop: NotionProp): string | null { return prop?.date?.start ?? null }
function readUrl(prop: NotionProp): string | undefined {
  if (!prop) return undefined
  if (prop.url) return prop.url
  return txt(prop) || undefined
}
function peopleNames(prop: NotionProp): string[] {
  if (!prop) return []
  const arr = prop.people ?? []
  if (arr.length > 0) return arr.map((u: NotionProp) => u.name ?? u.person?.email ?? '').filter(Boolean)
  const rt = prop.rich_text ?? []
  const raw = rt.map((t: NotionProp) => t.plain_text).join('').trim()
  return raw ? raw.split(',').map((s: string) => s.trim()).filter(Boolean) : []
}

const RED_TO_CHANNEL: Record<string, string> = {
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

const CHANNEL_PRIORITY = ['instagram','tiktok','facebook','linkedin','whatsapp','email','fb_comunidad']

const FORMAT_MAP: Record<string, string> = {
  'Reel':'Reel','Post':'Post','Historia':'Historia','Carrusel':'Carrusel',
  'Gif':'Post','Gráfica':'Post','Encuesta':'Post','Portada':'Post','Triada':'Carrusel',
  'Canva':'Post','Highlight':'Historia','Video':'Video','Blog':'Blog',
  'Email':'Email','Story':'Story','Short':'Short','Mensaje':'Mensaje',
}

const STATUS_MAP: Record<string, string> = {
  idea:'idea', produccion:'produccion', revision:'revision',
  aprobado:'aprobado', programado:'programado', publicado:'publicado',
  redaccion:'produccion', diseno:'produccion', audiovisual:'produccion',
  enviado:'revision', cambios:'revision', finalizado:'aprobado', reportado:'publicado',
}

const BRAND_CONFIG: Record<string, { color: string; industry: string; channels: string[]; country: string }> = {
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

function buildBrandId(name: string) {
  return 'brand-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20)
}

function buildBrandsFromNames(names: string[]) {
  const now = new Date().toISOString()
  return names.map((name, i) => {
    const cfg = BRAND_CONFIG[name]
    return {
      id:          buildBrandId(name),
      name,
      initials:    name.split(/[\s/]+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(),
      color:       cfg?.color    ?? AUTO_COLORS[i % AUTO_COLORS.length],
      industry:    cfg?.industry ?? 'General',
      country:     cfg?.country  ?? 'Perú',
      responsible: '',
      status:      'active',
      channels:    cfg?.channels ?? ['instagram'],
      links:       {},
      createdAt:   now,
      updatedAt:   now,
    }
  })
}

function mapStatus(notionStatus: string, publicado: boolean, realizado: boolean): string {
  if (notionStatus && STATUS_MAP[notionStatus]) return STATUS_MAP[notionStatus]
  if (realizado || publicado) return 'publicado'
  return 'aprobado'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToContent(page: any) {
  const p = page.properties
  const title = txt(p.Tarea)
  if (!title) return null
  const clienteName = sel(p.Cliente)
  if (!clienteName) return null

  const reds     = ms(p.Red).map((r: string) => RED_TO_CHANNEL[r]).filter(Boolean)
  const channels = reds.length > 0 ? reds : ['instagram']
  const channel  = CHANNEL_PRIORITY.find(c => channels.includes(c)) ?? channels[0]

  const formatos = ms(p.Formato)
  const format   = FORMAT_MAP[formatos[0]] ?? 'Post'

  const notionStatus = sel(p.Estado_CM)
  const status = mapStatus(notionStatus, chk(p.Publicado), chk(p.Realizado))

  const allTeam = [...new Set(peopleNames(p.Responsable))]

  const linkIG = readUrl(p.Link_IG) ?? readUrl(p.Link_Instagram)
  const linkFB = readUrl(p.Link_FB) ?? readUrl(p.Link_Facebook)
  const linkTT = readUrl(p.Link_TT) ?? readUrl(p.Link_TikTok)
  const linkLI = readUrl(p.Link_LI) ?? readUrl(p.Link_LinkedIn)
  const linkWA = readUrl(p.Link_WA) ?? readUrl(p.Link_WhatsApp)
  const linkGenerico = readUrl(p.Link) ?? txt(p.Link)

  const channelUrls: Record<string, string> = {}
  if (linkIG) channelUrls.instagram = linkIG
  if (linkFB) channelUrls.facebook  = linkFB
  if (linkTT) channelUrls.tiktok    = linkTT
  if (linkLI) channelUrls.linkedin  = linkLI
  if (linkWA) channelUrls.whatsapp  = linkWA
  if (!Object.keys(channelUrls).length && linkGenerico) channelUrls[channel] = linkGenerico

  return {
    id:            'n-' + page.id.replace(/-/g, '').slice(0, 20),
    notionPageId:  page.id,
    brandId:       buildBrandId(clienteName),
    title,
    channel,
    channels,
    format,
    date:          dt(p.Publicación),
    dueDate:       dt(p.Finalización),
    time:          txt(p.Hora) || null,
    status,
    priority:      sel(p.Prioridad)?.toLowerCase() || 'media',
    responsible:   allTeam[0] || '',
    responsables:  allTeam.length > 0 ? allTeam : undefined,
    dueAssignee:   peopleNames(p.Responsable_Entrega)[0] || txt(p.Responsable_Entrega) || undefined,
    tags:          [] as string[],
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
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  }
}

export async function GET() {
  if (!NOTION_TOKEN) return NextResponse.json({ error: 'NOTION_TOKEN not set' }, { status: 500 })
  if (!NOTION_DB_ID) return NextResponse.json({ error: 'NOTION_DB_ID not set' }, { status: 500 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages: any[] = []
    let cursor: string | undefined

    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        page_size: 100,
        filter: { property: 'Tarea', title: { is_not_empty: true } },
        sorts: [{ property: 'Publicación', direction: 'descending' }],
      }
      if (cursor) body.start_cursor = cursor

      const r = await notionFetch(`/databases/${NOTION_DB_ID}/query`, 'POST', body)
      if (!r.ok) return NextResponse.json({ error: await r.json() }, { status: r.status })

      const data = await r.json()
      pages.push(...data.results)
      cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
    } while (cursor)

    const uniqueClients = new Set<string>()
    for (const page of pages) {
      const name = page.properties.Cliente?.select?.name
      if (name) uniqueClients.add(name)
    }

    const brands   = buildBrandsFromNames([...uniqueClients])
    const contents = pages.map(pageToContent).filter(Boolean)

    return NextResponse.json({ contents, brands, total: pages.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
