'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import type { Brand, Content, Tag, Comment, TeamMember, TeamCategory, Role, TareaD, TareaTipo, Proyecto, MensajeSala, HubActividad } from './types'
import { SEED_TAGS } from './seed'

const COLOR_PALETTE = [
  '#7c3aed','#2563eb','#0891b2','#059669','#d97706',
  '#dc2626','#9333ea','#0284c7','#16a34a','#b45309',
]

const VALID_CATEGORIES: TeamCategory[] = ['Diseño', 'Audiovisual', 'Estrategia', 'Otro']

function normalizeCategory(raw: unknown): TeamCategory | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  // case-insensitive match
  const found = VALID_CATEGORIES.find(c => c.toLowerCase() === trimmed.toLowerCase())
  return found ?? (trimmed ? 'Otro' : undefined)
}

function buildTeamMember(uid: string, data: Record<string, unknown>, idx: number): TeamMember {
  const name = (data.displayName as string | undefined) || (data.email as string).split('@')[0]
  const words = name.trim().split(/\s+/)
  const initials = words.length >= 2
    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return {
    id: uid,
    name,
    email: data.email as string,
    initials,
    color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
    role: ((data.role as string | undefined) ?? 'CM') as Role,
    clients: [],
    status: 'active',
    category: normalizeCategory(data.area),
    position: (data.position as string | undefined) ?? undefined,
  }
}

const COL = {
  brands:       'cmhub_brands',
  contents:     'cmhub_contents',
  tareasD:      'cmhub_tareas_diarias',
  proyectos:    'cmhub_proyectos',
  mensajesSala: 'cmhub_mensajes_sala',
} as const

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
function now() { return new Date().toISOString() }

// Firestore rejects undefined values — strip them before any write
function clean<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>
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

  addComment: (c: Omit<Comment, 'id' | 'createdAt'>) => Comment
  resolveComment: (id: string) => void
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
  toggleTareaD: (id: string, hecha: boolean) => void
  deleteTareaD: (id: string) => void

  // ── Bento: Proyectos ──
  proyectos: Proyecto[]
  addProyecto: (p: Omit<Proyecto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Proyecto>
  updateProyecto: (id: string, p: Partial<Proyecto>) => void
  deleteProyecto: (id: string) => void

  // ── Actividades hub ──
  actividades: HubActividad[]

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
  const [mensajesSala, setMensajesSala] = useState<MensajeSala[]>([])
  const [actividades, setActividades]   = useState<HubActividad[]>([])
  const [viewAs, setViewAs] = useState<TeamMember | null>(null)
  const loading = loadingBrands || loadingContents

  useEffect(() => {
    const unsubBrands = onSnapshot(
      query(collection(db, COL.brands), orderBy('name')),
      snap => {
        setBrands(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Brand))
        setLoadingBrands(false)
      },
      err => { console.error('[Firestore brands]', err); setLoadingBrands(false) }
    )
    const unsubContents = onSnapshot(
      query(collection(db, COL.contents), orderBy('date', 'desc')),
      snap => {
        setContents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Content))
        setLoadingContents(false)
      },
      err => { console.error('[Firestore contents]', err); setLoadingContents(false) }
    )
    // Load team from userDirectory — readable by ALL signed-in users (unlike 'users' collection)
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
    const unsubTareasD = onSnapshot(
      query(collection(db, COL.tareasD), orderBy('fecha', 'desc')),
      snap => setTareasD(snap.docs.map(d => ({ id: d.id, ...d.data() }) as TareaD)),
      err => console.error('[Firestore tareasD]', err)
    )
    const unsubProyectos = onSnapshot(
      query(collection(db, COL.proyectos), orderBy('createdAt', 'desc')),
      snap => setProyectos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Proyecto)),
      err => console.error('[Firestore proyectos]', err)
    )
    const unsubMensajes = onSnapshot(
      query(collection(db, COL.mensajesSala), orderBy('createdAt', 'asc')),
      snap => setMensajesSala(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MensajeSala)),
      err => console.error('[Firestore mensajes]', err)
    )
    const unsubActividades = onSnapshot(
      collection(db, 'hubActividades'),
      snap => setActividades(snap.docs.map(d => ({ id: d.id, ...d.data() }) as HubActividad)),
      err => console.error('[Firestore hubActividades]', err)
    )
    return () => { unsubBrands(); unsubContents(); unsubTeam(); unsubTareasD(); unsubProyectos(); unsubMensajes(); unsubActividades() }
  }, [])


  const addBrand = useCallback(async (b: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<Brand> => {
    const brand: Brand = { ...b, id: uid(), createdAt: now(), updatedAt: now() }
    await setDoc(doc(db, COL.brands, brand.id), { ...brand, _ts: serverTimestamp() })
    return brand
  }, [])

  const updateBrand = useCallback((id: string, b: Partial<Brand>) => {
    updateDoc(doc(db, COL.brands, id), { ...b, updatedAt: now(), _ts: serverTimestamp() }).catch(console.error)
  }, [])

  const deleteBrand = useCallback((id: string) => {
    deleteDoc(doc(db, COL.brands, id)).catch(console.error)
  }, [])

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

  const addComment = useCallback((c: Omit<Comment, 'id' | 'createdAt'>): Comment => {
    const comment: Comment = { ...c, id: uid(), createdAt: now() }
    setComments(prev => [...prev, comment])
    return comment
  }, [])
  const resolveComment = useCallback((id: string) => {
    setComments(prev => prev.map(x => x.id === id ? { ...x, resolved: true } : x))
  }, [])
  const deleteComment = useCallback((id: string) => {
    setComments(prev => prev.filter(x => x.id !== id))
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

  const toggleTareaD = useCallback((id: string, hecha: boolean) => {
    updateDoc(doc(db, COL.tareasD, id), { hecha, _ts: serverTimestamp() }).catch(console.error)
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
  const updateProyecto = useCallback((id: string, p: Partial<Proyecto>) => {
    updateDoc(doc(db, COL.proyectos, id), { ...clean({ ...p }), updatedAt: now(), _ts: serverTimestamp() }).catch(console.error)
  }, [])
  const deleteProyecto = useCallback((id: string) => {
    deleteDoc(doc(db, COL.proyectos, id)).catch(console.error)
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

  return (
    <HubContext.Provider value={{
      brands, contents, tags, comments, team, loading,
      addBrand, updateBrand, deleteBrand,
      addContent, updateContent, deleteContent, duplicateContent,
      addTag, updateTag, deleteTag,
      addComment, resolveComment, deleteComment,
      getBrandById, getContentsByBrand, getCommentsByContent,
      syncing, renameTeamMember,
      refresh: () => {},
      tareasD, addTareaD, updateTareaD, toggleTareaD, deleteTareaD,
      proyectos, addProyecto, updateProyecto, deleteProyecto,
      actividades,
      mensajesSala, sendMensajeSala,
      updateTeamMemberArea,
      viewAs, setViewAs,
    }}>
      {children}
    </HubContext.Provider>
  )
}

export function useHub() {
  const ctx = useContext(HubContext)
  if (!ctx) throw new Error('useHub must be used within HubProvider')
  return ctx
}
