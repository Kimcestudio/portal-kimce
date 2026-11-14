'use client'
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db, app } from '@/services/firebase/client'
import type { Brand, Content, Tag, Comment, TeamMember, TeamCategory, Role, TareaD, TareaTipo, Proyecto, MensajeSala, HubActividad } from './types'
import { SEED_TAGS } from './seed'
import { stripUndefined } from './projects/domain'

const COLOR_PALETTE = [
  '#7c3aed','#2563eb','#0891b2','#059669','#d97706',
  '#dc2626','#9333ea','#0284c7','#16a34a','#b45309',
]

const VALID_CATEGORIES: TeamCategory[] = ['Diseño', 'Audiovisual', 'Estrategia', 'CM', 'Agencia', 'Otro']

function normalizeCategory(raw: unknown): TeamCategory | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  // case-insensitive match
  const found = VALID_CATEGORIES.find(c => c.toLowerCase() === trimmed.toLowerCase())
  return found ?? (trimmed ? 'Otro' : undefined)
}

// Normaliza un Firestore Timestamp (o string ISO ya guardado) a string ISO.
function normalizeTimestamp(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  const candidate = value as { toDate?: () => Date }
  if (typeof candidate.toDate === 'function') return candidate.toDate().toISOString()
  return undefined
}

// Misma regla de "conectado ahora" que usan Dashboard y Colaboradores: online hace <= 5 minutos.
function isRecentlyOnline(onlineStatus: unknown, lastSeenAt: string | undefined): boolean {
  if (onlineStatus !== 'online' || !lastSeenAt) return false
  const lastSeen = new Date(lastSeenAt).getTime()
  if (Number.isNaN(lastSeen)) return false
  return Date.now() - lastSeen <= 5 * 60 * 1000
}

function buildTeamMember(uid: string, data: Record<string, unknown>, idx: number): TeamMember {
  const name = (data.displayName as string | undefined) || (data.email as string).split('@')[0]
  const words = name.trim().split(/\s+/)
  const initials = words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  const lastSeenAt = normalizeTimestamp(data.lastSeenAt)
  const onlineStatus = (data.onlineStatus as 'online' | 'offline' | undefined) ?? 'offline'
  const rawPresenceStatus = data.presenceStatus as string | undefined
  const presenceStatus = (['disponible','en_reunion','concentrado','fuera'] as const).find(s => s === rawPresenceStatus) ?? undefined
  return {
    id: uid,
    name,
    email: data.email as string,
    initials,
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
    color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
    role: ((data.role as string | undefined) ?? 'CM') as Role,
    clients: [],
    status: 'active',
    category: normalizeCategory(data.area),
    position: (data.position as string | undefined) ?? undefined,
    onlineStatus,
    lastSeenAt,
    isOnline: isRecentlyOnline(onlineStatus, lastSeenAt),
    presenceStatus,
    personalMeetLink: typeof data.personalMeetLink === 'string' ? data.personalMeetLink : undefined,
  }
}

const COL = {
  brands:       'cmhub_brands',
  contents:     'cmhub_contents',
  tareasD:      'cmhub_tareas_diarias',
  proyectos:    'cmhub_proyectos',
  mensajesSala: 'cmhub_mensajes_sala',
  comments:     'cmhub_comments',
} as const

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
function now() { return new Date().toISOString() }

// Firestore rejects undefined values — strip them before any write
function clean<T extends object>(obj: T): Partial<T> {
  return stripUndefined(obj)
}

interface HubCtx {
  brands: Brand[]
  contents: Content[]
  tags: Tag[]
  comments: Comment[]
  team: TeamMember[]
  loading: boolean

  addBrand: (b: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Brand>
  updateBrand: (id: string, b: Partial<Brand>) => void
  deleteBrand: (id: string) => void

  addContent: (c: Omit<Content, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Content>
  updateContent: (id: string, c: Partial<Content>) => void
  deleteContent: (id: string) => void
  duplicateContent: (id: string) => Promise<Content | null>

  addTag: (t: Omit<Tag, 'id'>) => Tag
  updateTag: (id: string, t: Partial<Tag>) => void
  deleteTag: (id: string) => void

  addComment: (c: Omit<Comment, 'id' | 'createdAt'>) => Promise<Comment>
  resolveComment: (id: string, contentId?: string) => void
  deleteComment: (id: string) => void

  getBrandById: (id: string) => Brand | undefined
  getContentsByBrand: (brandId: string) => Content[]
  getCommentsByContent: (contentId: string) => Comment[]

  syncing: boolean
  renameTeamMember: (oldName: string, newName: string) => Promise<{ updated: number }>
  refresh: () => void

  // ── Bento: Tareas diarias ──
  tareasD: TareaD[]
  addTareaD: (t: Omit<TareaD, 'id' | 'createdAt'>) => Promise<TareaD>
  updateTareaD: (id: string, t: Partial<TareaD>) => void
  toggleTareaD: (id: string, hecha: boolean, deliveryTiming?: string) => void
  deleteTareaD: (id: string) => void

  // ── Bento: Proyectos ──
  proyectos: Proyecto[]           // solo activos (no archivados)
  archivedProyectos: Proyecto[]   // solo archivados
  loadingProyectos: boolean
  proyectosError: string | null
  addProyecto: (p: Omit<Proyecto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Proyecto>
  updateProyecto: (id: string, p: Partial<Proyecto>) => Promise<void>
  deleteProyecto: (id: string) => Promise<void>

  // ── Actividades hub ──
  actividades: HubActividad[]
  projectActivities: HubActividad[]
  loadingActividades: boolean

  // ── Bento: La Sala ──
  mensajesSala: MensajeSala[]
  sendMensajeSala: (m: Omit<MensajeSala, 'id' | 'createdAt'>) => Promise<MensajeSala>

  // ── Equipo: categorías ──
  updateTeamMemberArea: (uid: string, area: string | null) => Promise<void>

  // ── Vista como colaborador ──
  viewAs: TeamMember | null
  setViewAs: (m: TeamMember | null) => void
}

const HubContext = createContext<HubCtx>(null!)

export function HubProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const [brands, setBrands] = useState<Brand[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [tags, setTags] = useState<Tag[]>(SEED_TAGS)
  const [comments, setComments] = useState<Comment[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loadingBrands, setLoadingBrands] = useState(true)
  const [loadingContents, setLoadingContents] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [tareasD, setTareasD]           = useState<TareaD[]>([])
  const [proyectos, setProyectos]       = useState<Proyecto[]>([])
  const [loadingProyectos, setLoadingProyectos] = useState(true)
  const [proyectosError, setProyectosError] = useState<string | null>(null)
  const [mensajesSala, setMensajesSala] = useState<MensajeSala[]>([])
  const [actividades, setActividades]   = useState<HubActividad[]>([])
  const [loadingActividades, setLoadingActividades] = useState(true)
  const [viewAs, setViewAs] = useState<TeamMember | null>(null)
  const loading = loadingBrands || loadingContents

  // ── Flags de activación lazy (una vez activados, no se desactivan) ──────────
  const [needComments,    setNeedComments]    = useState(false)
  const [needTareasD,     setNeedTareasD]     = useState(false)
  const [needProyectos,   setNeedProyectos]   = useState(false)
  const [needSala,        setNeedSala]        = useState(false)
  const [needActividades, setNeedActividades] = useState(false)

  useEffect(() => {
    if (!pathname) return
    const p = pathname
    if (!needComments    && p.includes('/contenidos') && !p.includes('/mi-dia')) setNeedComments(true)
    if (!needTareasD     && (p.includes('/tareas-diarias') || p.includes('/supervision'))) setNeedTareasD(true)
    if (!needProyectos   && (p.includes('/proyectos') || p.includes('/actividades')))  setNeedProyectos(true)
    if (!needSala        && p.includes('/sala'))        setNeedSala(true)
    if (!needActividades && (p.includes('/actividades') || p.includes('/proyectos') || p.includes('/equipo') || p.includes('/supervision') || p.endsWith('/contenidos'))) setNeedActividades(true)
  }, [pathname, needComments, needTareasD, needProyectos, needSala, needActividades])

  // ── Listeners siempre activos (brands, contents, team) — esperan a auth ──────
  useEffect(() => {
    let unsubs: (() => void)[] = []
    const unsubAuth = onAuthStateChanged(getAuth(app), (user) => {
      unsubs.forEach(fn => fn())
      unsubs = []
      if (!user) return
      const unsubBrands = onSnapshot(
        query(collection(db, COL.brands), orderBy('name')),
        snap => { setBrands(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Brand)); setLoadingBrands(false) },
        err => { console.error('[Firestore brands]', err); setLoadingBrands(false) }
      )
      const unsubContents = onSnapshot(
        query(collection(db, COL.contents), orderBy('date', 'desc')),
        snap => { setContents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Content)); setLoadingContents(false) },
        err => { console.error('[Firestore contents]', err); setLoadingContents(false) }
      )
      const unsubTeam = onSnapshot(
        collection(db, 'userDirectory'),
        snap => {
          const members = snap.docs
            .map((d, idx) => {
              const data = d.data() as Record<string, unknown>
              if (!data.email) return null
              if (data.active === false || data.isActive === false) return null
              return buildTeamMember((data.uid as string | undefined) ?? d.id, data, idx)
            })
            .filter(Boolean) as TeamMember[]
          setTeam(members.sort((a, b) => a.name.localeCompare(b.name)))
        },
        err => console.error('[Firestore userDirectory/team]', err)
      )
      unsubs = [unsubBrands, unsubContents, unsubTeam]
    })
    return () => { unsubAuth(); unsubs.forEach(fn => fn()) }
  }, [])

  // ── Listeners lazy por sección ────────────────────────────────────────────────
  useEffect(() => {
    if (!needComments) return
    return onSnapshot(
      query(collection(db, COL.comments), orderBy('createdAt', 'asc')),
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Comment)),
      err => console.error('[Firestore comments]', err)
    )
  }, [needComments])

  useEffect(() => {
    if (!needTareasD) return
    return onSnapshot(
      query(collection(db, COL.tareasD), orderBy('fecha', 'desc')),
      snap => setTareasD(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TareaD)),
      err => console.error('[Firestore tareasD]', err)
    )
  }, [needTareasD])

  useEffect(() => {
    if (!needProyectos) return
    return onSnapshot(
      query(collection(db, COL.proyectos), orderBy('createdAt', 'desc')),
      snap => { setProyectos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Proyecto)); setLoadingProyectos(false); setProyectosError(null) },
      err => { console.error('[Firestore proyectos]', err); setLoadingProyectos(false); setProyectosError('No pudimos cargar los proyectos. Comprueba tu conexión y permisos.') }
    )
  }, [needProyectos])

  useEffect(() => {
    if (!needSala) return
    // Límite de 150 mensajes — índice ascendente ya existe en Firestore
    return onSnapshot(
      query(collection(db, COL.mensajesSala), orderBy('createdAt', 'asc'), limit(150)),
      snap => setMensajesSala(
        snap.docs.map(d => ({ id: d.id, ...d.data() }) as MensajeSala)
      ),
      err => console.error('[Firestore mensajes]', err)
    )
  }, [needSala])

  useEffect(() => {
    if (!needActividades) return
    // Sin orderBy para evitar requerir índice compuesto — limit como tope de seguridad
    return onSnapshot(
      query(collection(db, 'hubActividades'), limit(800)),
      snap => { setActividades(snap.docs.filter(d => !d.data().archived).map(d => ({ id: d.id, ...d.data() }) as HubActividad)); setLoadingActividades(false) },
      err => { console.error('[Firestore hubActividades]', err); setLoadingActividades(false) }
    )
  }, [needActividades])


  const addBrand = useCallback(async (b: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<Brand> => {
    const brand: Brand = { ...b, id: uid(), createdAt: now(), updatedAt: now() }
    const data = { ...clean(brand), links: clean(brand.links ?? {}), _ts: serverTimestamp() }
    await setDoc(doc(db, COL.brands, brand.id), data)
    return brand
  }, [])

  const updateBrand = useCallback((id: string, b: Partial<Brand>) => {
    updateDoc(doc(db, COL.brands, id), { ...b, updatedAt: now(), _ts: serverTimestamp() }).catch(console.error)
  }, [])

  const deleteBrand = useCallback(async (id: string) => {
    try {
      const toDelete = contents.filter(c => c.brandId === id)
      for (let i = 0; i < toDelete.length; i += 400) {
        const batch = writeBatch(db)
        for (const c of toDelete.slice(i, i + 400)) {
          batch.delete(doc(db, COL.contents, c.id))
        }
        await batch.commit()
      }
      await deleteDoc(doc(db, COL.brands, id))
    } catch (err) {
      console.error('[deleteBrand]', err)
    }
  }, [contents])

  const addContent = useCallback(async (c: Omit<Content, 'id' | 'createdAt' | 'updatedAt'>): Promise<Content> => {
    const content: Content = { ...c, id: uid(), createdAt: now(), updatedAt: now() }
    await setDoc(doc(db, COL.contents, content.id), { ...clean(content), _ts: serverTimestamp() })
    return content
  }, [])

  const updateContent = useCallback((id: string, c: Partial<Content>) => {
    updateDoc(doc(db, COL.contents, id), { ...clean(c), updatedAt: now(), _ts: serverTimestamp() }).catch(console.error)
  }, [])

  const deleteContent = useCallback((id: string) => {
    deleteDoc(doc(db, COL.contents, id)).catch(console.error)
  }, [])

  // Duplicate — reset status/dates so the copy starts fresh in pipeline
  const duplicateContent = useCallback(async (id: string): Promise<Content | null> => {
    const src = contents.find(c => c.id === id)
    if (!src) return null
    const dup: Content = {
      ...src, id: uid(), title: `${src.title} (copia)`,
      status: 'idea', date: null, time: null,
      approvalStatus: 'pending', metrics: undefined,
      createdAt: now(), updatedAt: now(),
    }
    await setDoc(doc(db, COL.contents, dup.id), { ...clean(dup), _ts: serverTimestamp() })
    return dup
  }, [contents])

  const addTag = useCallback((t: Omit<Tag, 'id'>): Tag => {
    const tag: Tag = { ...t, id: 'tag-' + uid() }
    setTags(prev => [...prev, tag])
    return tag
  }, [])
  const updateTag = useCallback((id: string, t: Partial<Tag>) => {
    setTags(prev => prev.map(x => x.id === id ? { ...x, ...t } : x))
  }, [])
  const deleteTag = useCallback((id: string) => {
    setTags(prev => prev.filter(x => x.id !== id))
  }, [])

  const addComment = useCallback(async (c: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> => {
    const comment: Comment = { ...c, id: uid(), createdAt: now() }
    await setDoc(doc(db, COL.comments, comment.id), { ...clean(comment), _ts: serverTimestamp() })
    return comment
  }, [])
  // Al resolver, si la pieza estaba en "changes_requested" la regresamos a "pending" — el
  // cliente ya pidio el cambio, el equipo ya lo soluciono, ahora le toca volver a mirarla.
  const resolveComment = useCallback((id: string, contentId?: string) => {
    updateDoc(doc(db, COL.comments, id), { resolved: true }).catch(console.error)
    if (contentId) {
      const content = contents.find(c => c.id === contentId)
      if (content?.approvalStatus === 'changes_requested') {
        updateDoc(doc(db, COL.contents, contentId), { approvalStatus: 'pending' }).catch(console.error)
      }
    }
  }, [contents])
  const deleteComment = useCallback((id: string) => {
    deleteDoc(doc(db, COL.comments, id)).catch(console.error)
  }, [])

  // Renombra un colaborador en todos los documentos de contenidos, tareas y proyectos
  const renameTeamMember = useCallback(async (oldName: string, newName: string): Promise<{ updated: number }> => {
    setSyncing(true)
    let updated = 0
    try {
      type Op = { col: string; id: string; payload: Record<string, unknown> }
      const ops: Op[] = []
      const matches = (s: string | null | undefined) =>
        (s ?? '').trim().toLowerCase() === oldName.trim().toLowerCase()

      for (const c of contents) {
        const payload: Record<string, unknown> = {}
        if (matches(c.responsible))  payload.responsible  = newName
        if (matches(c.dueAssignee))  payload.dueAssignee  = newName
        const newResp = c.responsables?.map(r => matches(r) ? newName : r)
        if (newResp && JSON.stringify(newResp) !== JSON.stringify(c.responsables)) payload.responsables = newResp
        if (Object.keys(payload).length) ops.push({ col: COL.contents, id: c.id, payload: { ...payload, updatedAt: now() } })
      }
      for (const t of tareasD) {
        if (matches(t.editor)) ops.push({ col: COL.tareasD,   id: t.id, payload: { editor:      newName } })
      }
      for (const p of proyectos) {
        if (matches(p.responsable)) ops.push({ col: COL.proyectos, id: p.id, payload: { responsable: newName } })
      }

      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(db)
        for (const op of ops.slice(i, i + 400)) {
          batch.update(doc(db, op.col, op.id), { ...op.payload, _ts: serverTimestamp() })
          updated++
        }
        await batch.commit()
      }
    } catch (err) {
      console.error('[renameTeamMember]', err)
    } finally {
      setSyncing(false)
    }
    return { updated }
  }, [contents, tareasD, proyectos])

  const getBrandById = useCallback((id: string) => brands.find(b => b.id === id), [brands])
  const getContentsByBrand = useCallback((bid: string) => contents.filter(c => c.brandId === bid), [contents])
  const getCommentsByContent = useCallback((cid: string) => comments.filter(c => c.contentId === cid), [comments])

  // ── Tareas diarias ──
  const addTareaD = useCallback(async (t: Omit<TareaD, 'id' | 'createdAt'>): Promise<TareaD> => {
    const tarea: TareaD = { ...t, id: uid(), createdAt: now() }
    await setDoc(doc(db, COL.tareasD, tarea.id), { ...clean(tarea), _ts: serverTimestamp() })
    return tarea
  }, [])
  const updateTareaD = useCallback((id: string, t: Partial<TareaD>) => {
    updateDoc(doc(db, COL.tareasD, id), { ...clean(t), _ts: serverTimestamp() }).catch(console.error)
  }, [])

  const toggleTareaD = useCallback((id: string, hecha: boolean, deliveryTiming?: string) => {
    updateDoc(doc(db, COL.tareasD, id), {
      hecha,
      ...(hecha
        ? { completedAt: now(), ...(deliveryTiming ? { deliveryTiming } : {}) }
        : { completedAt: null }),
      _ts: serverTimestamp(),
    }).catch(console.error)
  }, [])
  const deleteTareaD = useCallback((id: string) => {
    deleteDoc(doc(db, COL.tareasD, id)).catch(console.error)
  }, [])

  // ── Proyectos ──
  const addProyecto = useCallback(async (p: Omit<Proyecto, 'id' | 'createdAt' | 'updatedAt'>): Promise<Proyecto> => {
    const proyecto: Proyecto = { ...p, id: uid(), createdAt: now(), updatedAt: now() }
    await setDoc(doc(db, COL.proyectos, proyecto.id), { ...clean(proyecto), _ts: serverTimestamp() })
    return proyecto
  }, [])
  const updateProyecto = useCallback(async (id: string, p: Partial<Proyecto>) => {
    await updateDoc(doc(db, COL.proyectos, id), { ...clean({ ...p }), updatedAt: now(), _ts: serverTimestamp() })
  }, [])
  const deleteProyecto = useCallback(async (id: string) => {
    await updateDoc(doc(db, COL.proyectos, id), { archived: true, updatedAt: now() })
  }, [])

  // ── La Sala ──
  const sendMensajeSala = useCallback(async (m: Omit<MensajeSala, 'id' | 'createdAt'>): Promise<MensajeSala> => {
    const msg: MensajeSala = { ...m, id: uid(), createdAt: now() }
    await setDoc(doc(db, COL.mensajesSala, msg.id), { ...clean(msg), _ts: serverTimestamp() })
    return msg
  }, [])

  // ── Equipo: asignar área/categoría ──
  const updateTeamMemberArea = useCallback(async (memberId: string, area: string | null): Promise<void> => {
    const payload = { area: area ?? null, updatedAt: now(), _ts: serverTimestamp() }
    // Actualiza userDirectory (fuente del CM Hub) y users (fuente del portal)
    await Promise.all([
      setDoc(doc(db, 'userDirectory', memberId), payload, { merge: true }),
      setDoc(doc(db, 'users', memberId),          payload, { merge: true }),
    ])
  }, [])

  const ctxValue = useMemo(() => ({
    brands, contents, tags, comments, team, loading,
    addBrand, updateBrand, deleteBrand,
    addContent, updateContent, deleteContent, duplicateContent,
    addTag, updateTag, deleteTag,
    addComment, resolveComment, deleteComment,
    getBrandById, getContentsByBrand, getCommentsByContent,
    syncing, renameTeamMember,
    refresh: () => {},
    tareasD, addTareaD, updateTareaD, toggleTareaD, deleteTareaD,
    proyectos: proyectos.filter(p => !p.archived),
    archivedProyectos: proyectos.filter(p => !!p.archived),
    loadingProyectos, proyectosError, addProyecto, updateProyecto, deleteProyecto,
    actividades: actividades.filter(a => !a.isGroup && !a.archived), projectActivities: actividades, loadingActividades,
    mensajesSala, sendMensajeSala,
    updateTeamMemberArea,
    viewAs, setViewAs,
  }), [
    brands, contents, tags, comments, team, loading, syncing, viewAs,
    tareasD, proyectos, loadingProyectos, proyectosError, actividades, loadingActividades, mensajesSala,
    addBrand, updateBrand, deleteBrand,
    addContent, updateContent, deleteContent, duplicateContent,
    addTag, updateTag, deleteTag,
    addComment, resolveComment, deleteComment,
    getBrandById, getContentsByBrand, getCommentsByContent,
    renameTeamMember,
    addTareaD, updateTareaD, toggleTareaD, deleteTareaD,
    addProyecto, updateProyecto, deleteProyecto,
    sendMensajeSala, updateTeamMemberArea, setViewAs,
  ])

  return (
    <HubContext.Provider value={ctxValue}>
      {children}
    </HubContext.Provider>
  )
}

export function useHub() {
  const ctx = useContext(HubContext)
  if (!ctx) throw new Error('useHub must be used within HubProvider')
  return ctx
}
