export type Network =
  | 'instagram' | 'facebook' | 'fb_comunidad' | 'tiktok' | 'linkedin'
  | 'youtube' | 'whatsapp' | 'blog' | 'email' | 'web' | 'stories'

export type Format =
  | 'Reel' | 'Post' | 'Historia' | 'Carrusel' | 'Video'
  | 'Email' | 'Story' | 'Short' | 'Mensaje'
  | 'Blog' // legacy

export type ContentStatus =
  | 'idea' | 'produccion' | 'revision' | 'aprobado' | 'programado' | 'publicado'
  // legacy values kept for backward compat with existing Firestore data
  | 'redaccion' | 'diseno' | 'audiovisual' | 'enviado' | 'cambios' | 'finalizado' | 'reportado'

export type Status = 'idea' | 'proceso' | 'aprobado' | 'publicado'

export type Priority = 'baja' | 'media' | 'alta' | 'urgente'

export type Role = 'Admin' | 'CM' | 'Cliente'

export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested'

export interface Brand {
  id: string
  name: string
  initials: string
  logo?: string
  color: string
  industry: string
  country: string
  responsible: string
  status: 'active' | 'paused' | 'closed'
  channels: Network[]
  observations?: string
  calendarShareEnabled?: boolean
  links: {
    instagram?: string
    facebook?: string
    tiktok?: string
    linkedin?: string
    web?: string
    drive?: string
    designs?: string
    reports?: string
  }
  createdAt: string
  updatedAt: string
}

export interface ContentMetrics {
  reach?: number
  impressions?: number
  interactions?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  clicks?: number
  views?: number
  engagementRate?: number
  performanceNotes?: string
}

export interface Content {
  id: string
  brandId: string
  title: string
  campaign?: string
  channel: Network      // primary (first selected)
  channels?: Network[]  // all selected networks
  format: Format
  date: string | null
  dueDate: string | null
  time: string | null
  status: ContentStatus
  priority: Priority
  responsible: string
  tags: string[]

  copy: string
  altCaption?: string
  visualDescription?: string
  cta?: string
  hashtags?: string
  postUrl?: string
  channelUrls?: Partial<Record<Network, string>>
  designUrl?: string
  driveUrl?: string
  message?: string
  dueAssignee?: string
  responsables?: string[]
  internalNotes?: string

  approvalStatus: ApprovalStatus
  clientComments?: string
  internalComments?: string
  approvedAt?: string
  approvedBy?: string

  metrics?: ContentMetrics

  pag?: string
  mood?: 'Marca' | 'Colaborativo'

  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  label: string
  color: string
  bg: string
}

export interface Comment {
  id: string
  contentId: string
  author: string
  message: string
  resolved: boolean
  createdAt: string
}

export type TeamCategory = 'Diseño' | 'Audiovisual' | 'Estrategia' | 'Otro'

export interface TeamMember {
  id: string
  initials: string
  name: string
  email: string
  role: Role
  color: string
  clients: string[]
  status: 'active' | 'invited'
  category?: TeamCategory
  position?: string
}

// Legacy interfaces kept for backward compat
export interface Client {
  id: string
  initials: string
  name: string
  industry: string
  color: string
  networks: Network[]
  postsThisMonth: number
  pending: number
  engagement: number
  status: 'active' | 'paused'
  team: string[]
}

export interface Post {
  id: string
  clientId: string
  clientName: string
  clientColor: string
  network: Network
  format: Format
  caption: string
  status: Status
  scheduledAt: string | null
  responsible: { initials: string; color: string; name: string }
  day?: number
}

// ── Bento extensions ──────────────────────────────────────────────────────────

export type TareaTipo = 'produccion' | 'cliente' | 'interno'

export interface TareaD {
  id: string
  texto: string
  hecha: boolean
  editor: string
  prioridad: 'alta' | 'media' | 'baja'
  fecha: string           // fecha asignada YYYY-MM-DD
  fechaLimite?: string    // fecha límite real
  tipo: TareaTipo         // contexto de la tarea
  contentId?: string      // link a contenido
  brandId?: string        // link a marca/cliente
  observaciones?: string  // nota rápida inline
  createdAt: string
}

export interface ProyectoObjetivo {
  texto: string
  done: boolean
}

export interface Proyecto {
  id: string
  nombre: string
  brandId: string
  estado: 'activo' | 'pausado' | 'completado'
  avance: number      // 0-100
  descripcion?: string
  fechaInicio: string
  fechaFin?: string
  responsable: string
  objetivoGeneral?: string
  objetivos?: ProyectoObjetivo[]
  createdAt: string
  updatedAt: string
}

export interface HubActividad {
  id: string
  title: string
  status: 'pendiente' | 'en_curso' | 'completado'
  proyectoId?: string | null
  assignee?: string
  assignees?: string[]
  category?: string
  dueDate?: string
  description?: string
  linkEntrega?: string
  createdAt?: unknown
}

export type NotificationType =
  | 'content_new_production'
  | 'content_changes_requested'
  | 'content_in_review'
  | 'content_ready_to_publish'
  | 'activity_new'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  category: string
  title: string
  message: string
  link?: string | null
  contentId?: string | null
  brandId?: string | null
  actividadId?: string | null
  read: boolean
  createdAt: unknown
}

export interface MensajeSala {
  id: string
  autor: string
  autorInitials: string
  autorColor: string
  texto: string
  tipo: 'mensaje' | 'anuncio'
  createdAt: string
}
