// ── WorkLog — registro de actividad diaria del colaborador ────────────────
export type WorkLogTipo =
  | 'redaccion' | 'diseno' | 'video' | 'llamada' | 'reunion'
  | 'estrategia' | 'administrativo' | 'investigacion' | 'otro'

export interface WorkLog {
  id: string
  userId: string
  userDisplayName: string
  date: string             // YYYY-MM-DD
  tipo: WorkLogTipo
  titulo: string
  descripcion?: string
  brandId?: string
  minutosEstimados?: number
  minutosReales?: number
  completado: boolean
  completadoAt?: string | null
  startedAt?: string | null  // timestamp ISO para timer en vivo
  recurrencia?: 'diaria' | 'semanal' | null
  diaSemana?: number         // 0=dom … 6=sab, para recurrencia semanal
  orden?: number
  overdueFrom?: string       // fecha original YYYY-MM-DD si fue movida desde un día pasado
  createdAt: unknown
}

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

export interface BrandContact {
  name: string
  category: TeamCategory
  email?: string
  /** Formato internacional sin espacios ni guiones, ej: "51987654321" */
  phone?: string
}

export interface Brand {
  id: string
  name: string
  initials: string
  logo?: string
  color: string
  industry: string
  country: string
  responsible: string
  /** UID en userDirectory del responsable interno — más fiable que buscar por nombre */
  responsibleId?: string
  status: 'active' | 'paused' | 'closed'
  channels: Network[]
  observations?: string
  calendarShareEnabled?: boolean
  /** Slug público del link del cliente (ej: "belcorp"). Separado del ID interno. */
  slug?: string
  /** ID del Google Sheet vinculado a esta marca para sincronización bidireccional */
  sheetId?: string
  /** Contactos del equipo KIMCE asignados a esta marca, visibles en el portal del cliente */
  contacts?: BrandContact[]
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
  /** Estado guardado al congelar en "revision" por un comentario nuevo — se restaura cuando ya no quedan comentarios sin resolver. */
  previousStatus?: ContentStatus | null

  metrics?: ContentMetrics

  pag?: string
  mood?: 'Marca' | 'Colaborativo'

  createdAt: string
  updatedAt: string
  /** Nombre/correo de quien hizo el ultimo guardado — usado para notificaciones (ej. cambio de fecha). */
  updatedBy?: string | null
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
  /** Denormalizado desde el contenido — permite validar acceso publico (calendarShareEnabled) sin un segundo lookup. */
  brandId: string
  author: string
  message: string
  resolved: boolean
  createdAt: string
}

export type TeamCategory = 'Diseño' | 'Audiovisual' | 'Estrategia' | 'CM' | 'Agencia' | 'Otro'

export interface TeamMember {
  photoURL?: string
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
  /** Número de WhatsApp en formato internacional sin espacios (ej: "51987654321") */
  phone?: string
  /** Presencia real (no confundir con `status`, que es el estado de la membresía). */
  onlineStatus?: 'online' | 'offline'
  lastSeenAt?: string
  isOnline?: boolean
  presenceStatus?: 'disponible' | 'en_reunion' | 'concentrado' | 'fuera'
  personalMeetLink?: string
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
  source?: 'admin' | 'equipo' | 'quick'
  completedAt?: string | null
  deliveryTiming?: 'early' | 'on_time' | 'late'
  createdAt: string
}

export interface ProyectoObjetivo {
  texto: string
  done: boolean
}

export interface ProyectoLink {
  label: string
  url: string
}

export type ProyectoNotaTipo = 'idea' | 'anotacion' | 'resumen' | 'otro'

export interface ProyectaNota {
  id: string
  texto: string
  autor: string
  tipo: ProyectoNotaTipo
  createdAt: string
  updatedAt?: string
  pinned?: boolean
}

export interface GanttTarea {
  id: string
  nombre: string
  fechaInicio: string
  fechaFin: string
  avance: number
  responsable?: string
  estado: 'pendiente' | 'en_curso' | 'completado'
  color?: string
  parentId?: string   // convierte esta tarea en subtarea del grupo referenciado
  isGroup?: boolean   // grupo explícito (incluso sin hijos aún)
}

export interface Proyecto {
  id: string
  nombre: string
  brandId: string
  estado: 'prospecto' | 'activo' | 'pausado' | 'completado'
  avance: number      // 0-100
  descripcion?: string
  fechaInicio: string
  fechaFin?: string
  responsable: string
  responsables?: string[]
  objetivoGeneral?: string
  objetivos?: ProyectoObjetivo[]
  links?: ProyectoLink[]
  notas?: ProyectaNota[]
  ganttTareas?: GanttTarea[]
  tasksMigrated?: boolean
  archived?: boolean
  ownerIds?: string[]
  workingDays?: number[]
  shareToken?: string
  weeklyCapacityHours?: number
  tipo?: 'campaña' | 'lanzamiento' | 'estrategia' | 'web' | 'contenido_especial' | 'interno' | 'propuesta'
  criterioExito?: string
  brief?: string
  briefUpdatedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ActividadAdjunto {
  url: string
  nombre: string
  tipo: 'imagen' | 'archivo'
  storagePath: string
}

export interface HubActividad {
  startDate?: string
  progress?: number
  assigneeIds?: string[]
  parentId?: string
  sortOrder?: number
  isGroup?: boolean
  milestone?: boolean
  dependencies?: string[]
  blockedReason?: string
  effortHours?: number
  archived?: boolean
  priority?: 'urgente' | 'alta' | 'normal'
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
  adjuntos?: ActividadAdjunto[]
  completedAt?: string | null
  deliveryTiming?: 'early' | 'on_time' | 'late'
  createdAt?: unknown
  // Flujo de pasos
  flujoId?: string
  pasoIndex?: number
  totalPasos?: number
  flujoNombre?: string
}

export interface FlujoStep {
  titulo: string
  assigneeNames: string[]
  category?: string
  descripcion?: string
  dueDate?: string
}

export interface HubFlujo {
  id: string
  nombre: string
  descripcion?: string
  plantillaId?: string
  capturaUrls?: string[]
  pasos: FlujoStep[]
  actividadIds: (string | null)[]
  pasoActual: number
  estado: 'activo' | 'completado'
  createdAt: unknown
}

export type NotificationType =
  | 'content_new_production'
  | 'content_changes_requested'
  | 'content_in_review'
  | 'content_ready_to_publish'
  | 'content_date_changed'
  | 'content_comment_new'
  | 'activity_new'
  | 'task_overdue'
  | 'activity_overdue'
  | 'content_request_new'
  | 'call_incoming'

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
  tipo: 'mensaje' | 'anuncio' | 'bot'
  createdAt: string
}

// ── Puntos ────────────────────────────────────────────────────────────────────

export interface UserPoints {
  userId: string
  puntos: number
  fichas: number
  updatedAt: string
}

export type PuntosRefType = 'tarea' | 'actividad' | 'contenido' | 'tienda' | 'admin'

export interface PuntosLog {
  id: string
  userId: string
  amount: number
  reason: string
  refType: PuntosRefType
  refId: string
  createdAt: unknown
}
