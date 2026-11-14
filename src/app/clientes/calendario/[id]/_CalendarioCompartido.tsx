'use client'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'next/navigation'
import { addDoc, collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { ChevronLeft, ChevronRight, X, ExternalLink, Calendar, CalendarDays, ClipboardList, Loader2, FolderOpen, Palette, BarChart3, MessageSquare, MessageCircle, CheckCircle2, Sun, Moon, ArrowLeft, Mail, Phone } from 'lucide-react'
import { db } from '@/services/firebase/client'
import { HubThemeProvider, useHubMeta, useHubTheme } from '@/cmhub/theme'
import { ALL_STATUSES, NETWORK_META } from '@/cmhub/data'
import NetworkFilter from '@/components/cmhub/NetworkFilter'
import NetworkIcon from '@/components/cmhub/NetworkIcon'
import type { Brand, BrandContact, Content, Network } from '@/cmhub/types'
import SolicitudesSection from './_SolicitudesSection'

// ← actualizar con el número real de WhatsApp de KIMCE
const KIMCE_WHATSAPP = '51999999999'
const KIMCE_WA_MSG   = encodeURIComponent('Hola! Quiero comunicarme con el equipo KIMCE.')

const BRAND_LINK_ICONS: Partial<Record<string, typeof FolderOpen>> = {
  drive: FolderOpen,
  designs: Palette,
  reports: BarChart3,
}
const BRAND_LINK_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  web: 'Web',
  drive: 'Drive',
  designs: 'Diseños',
  reports: 'Reportes',
}
const BRAND_LINK_ORDER = ['instagram', 'facebook', 'tiktok', 'linkedin', 'web', 'drive', 'designs', 'reports'] as const

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function mondayOf(d: Date) {
  const off = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - off)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getContentNetworks(c: Content) {
  return c.channels?.length ? c.channels : [c.channel]
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// Mezcla un color hacia otro (0 = igual al original, 1 = igual al destino) — sirve para
// derivar tonos mas claros/oscuros del color de marca sin salir de su misma familia.
function mixColor(hex: string, target: string, amount: number) {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  const r = Math.round(a.r + (b.r - a.r) * amount)
  const g = Math.round(a.g + (b.g - a.g) * amount)
  const bl = Math.round(a.b + (b.b - a.b) * amount)
  return `rgb(${r}, ${g}, ${bl})`
}

// Azul real de KIMCE (extraido del logo oficial, no el morado/indigo que usa el portal como
// acento de UI) — es el color con el que la marca KIMCE se identifica a si misma.
const KIMCE_BLUE = '#0844ef'

// Fondo "mesh" tipo Liquid Glass: se adapta al color de cada marca (no a una paleta fija),
// para que el vidrio de header/drawer tenga algo con color real detras para refractar.
// Sin color de marca, cae al azul de KIMCE como base neutra.
function brandMeshBackground(color?: string, isDark?: boolean): CSSProperties {
  const base = color || KIMCE_BLUE
  if (isDark) {
    // Mismo mesh, pero mezclado hacia el negro del hub (#09090b) en vez de blanco —
    // para que el vidrio oscuro de header/drawer tenga algo coherente detras.
    const highlight = mixColor(base, '#000000', 0.55)
    const accentBlob = mixColor(base, KIMCE_BLUE, 0.45)
    const deep = mixColor(base, '#000000', 0.82)
    const baseDark = mixColor(base, '#000000', 0.9)
    return {
      backgroundImage: `
        radial-gradient(circle at 12% 8%, ${highlight} 0%, transparent 48%),
        radial-gradient(circle at 88% 15%, ${accentBlob} 0%, transparent 45%),
        radial-gradient(circle at 35% 100%, ${deep} 0%, transparent 58%),
        linear-gradient(160deg, ${baseDark} 0%, #09090b 100%)
      `,
    }
  }
  const highlight = mixColor(base, '#ffffff', 0.72)
  const accentBlob = mixColor(base, KIMCE_BLUE, 0.3)
  const deep = mixColor(base, '#1f2245', 0.45)
  const baseLight = mixColor(base, '#ffffff', 0.85)
  return {
    backgroundImage: `
      radial-gradient(circle at 12% 8%, ${highlight} 0%, transparent 48%),
      radial-gradient(circle at 88% 15%, ${accentBlob} 0%, transparent 45%),
      radial-gradient(circle at 35% 100%, ${deep} 0%, transparent 58%),
      linear-gradient(160deg, ${baseLight} 0%, ${deep} 100%)
    `,
  }
}

// "Lista para tu aprobacion": ya esta en revision o aprobado (visible) y el cliente aun no dijo nada.
function isPendingApproval(c: Content) {
  return (c.status === 'revision' || c.status === 'aprobado') && (c.approvalStatus ?? 'pending') === 'pending'
}

type DriveEmbed = { url: string; isFolder: boolean }

// Las piezas de un carrusel suelen compartirse como una carpeta de Drive con varias imagenes —
// Drive ya ofrece una vista de carpeta embebible en grilla, asi que no hace falta guardar cada
// pieza por separado: basta con reconocer el link de carpeta y usar ese embed (galeria).
function getDriveEmbed(url?: string | null): DriveEmbed | null {
  if (!url) return null
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) {
    return { url: `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`, isFolder: true }
  }
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  const openMatch = url.match(/\/open\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/)
  const ucMatch = url.match(/\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/)
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  const fileId = fileMatch?.[1] ?? openMatch?.[1] ?? ucMatch?.[1] ?? idMatch?.[1]
  return fileId ? { url: `https://drive.google.com/file/d/${fileId}/preview`, isFolder: false } : null
}

type PublicComment = { id: string; author: string; message: string; resolved: boolean; createdAt: string }

// Hilo de comentarios estilo "Google Docs": cualquiera con el link puede comentar (sin login,
// solo nombre + mensaje) — sirve igual para feedback de copy que para pedir mover la fecha.
// "Marcar resuelto" no se expone aqui a propósito: esa accion queda solo para el equipo (ContentModal).
function CommentThread({
  contentId,
  brandId,
  name,
  onNameChange,
  placeholderOverride,
  highlighted,
  onSubmitted,
}: {
  contentId: string
  brandId: string
  name: string
  onNameChange: (v: string) => void
  placeholderOverride?: string
  highlighted?: boolean
  onSubmitted?: () => void | Promise<void>
}) {
  const [comments, setComments] = useState<PublicComment[]>([])
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const q = query(collection(db, 'cmhub_comments'), where('contentId', '==', contentId))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PublicComment))
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      setComments(list)
    })
    return () => unsub()
  }, [contentId])

  // Cuando el cliente hace clic en "Solicitar cambios", enfocamos el textarea directamente
  // en vez de abrir un formulario aparte — el hilo de comentarios ya existente es el canal.
  useEffect(() => {
    if (highlighted) textareaRef.current?.focus()
  }, [highlighted])

  async function submit() {
    if (!name.trim() || !message.trim()) return
    setPosting(true)
    try {
      await addDoc(collection(db, 'cmhub_comments'), {
        contentId,
        brandId,
        author: name.trim(),
        message: message.trim(),
        resolved: false,
        createdAt: new Date().toISOString(),
        _ts: serverTimestamp(),
      })
      setMessage('')
      await onSubmitted?.()
    } finally {
      setPosting(false)
    }
  }

  return (
    <div
      className={`kimce-glass kimce-fade-enter flex flex-col gap-2 rounded-2xl p-3 ${highlighted ? 'ring-1 ring-[#f59e0b]' : ''}`}
    >
      <div className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wide">Comentarios</div>
      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="rounded-xl border border-[#dde2e7] bg-white p-2.5 text-[12px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#111827]">{c.author}</span>
              <span className="text-[10px] text-[#9ca3af]">{new Date(c.createdAt).toLocaleString('es-PE')}</span>
            </div>
            <p className="mt-1 text-[#374151] whitespace-pre-wrap">{c.message}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-[11px] text-[#9ca3af] italic">
            Aún no hay comentarios.
          </p>
        )}
      </div>

      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Tu nombre"
        className="text-[12px] rounded-xl border border-[#dde2e7] bg-white px-3 py-2 outline-none focus:border-[#7c3aed]"
      />
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholderOverride ?? 'Escribe tu comentario…'}
          rows={2}
          className={`flex-1 text-[12px] rounded-xl border bg-white px-3 py-2 outline-none resize-none ${
            highlighted ? 'border-[#f59e0b] focus:border-[#f59e0b]' : 'border-[#dde2e7] focus:border-[#7c3aed]'
          }`}
        />
        <button
          disabled={!name.trim() || !message.trim() || posting}
          onClick={submit}
          className="self-end text-[12px] font-semibold text-white bg-[#7c3aed] px-3 py-2 rounded-xl hover:bg-[#6d28d9] hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all duration-150"
        >
          Enviar solicitud
        </button>
      </div>
    </div>
  )
}

// Botones de aprobacion del cliente: solo se muestran cuando la pieza ya esta lista para
// mostrarse (revision/aprobado). "Solicitar cambios" no escribe nada por si solo — enfoca el
// hilo de comentarios y deja que ese envio (con comentario obligatorio) dispare el cambio de estado.
function ApprovalActions({
  content,
  clientName,
  onNameChange,
  onRequestChanges,
}: {
  content: Content
  clientName: string
  onNameChange: (v: string) => void
  onRequestChanges: () => void
}) {
  const [working, setWorking] = useState(false)
  const approvalStatus = content.approvalStatus ?? 'pending'

  async function approve() {
    if (!clientName.trim()) return
    setWorking(true)
    try {
      await updateDoc(doc(db, 'cmhub_contents', content.id), {
        approvalStatus: 'approved',
        approvedBy: clientName.trim(),
        approvedAt: new Date().toISOString(),
        ...(content.status === 'revision' ? { status: 'aprobado' } : {}),
      })
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <span className="text-[11px] font-semibold">
        {approvalStatus === 'approved' && (
          <span className="text-[#16a34a]">
            ✓ Aprobado por {content.approvedBy}{content.approvedAt ? ` · ${new Date(content.approvedAt).toLocaleDateString('es-PE')}` : ''}
          </span>
        )}
        {approvalStatus === 'changes_requested' && <span className="text-[#d97706]">Cambios solicitados — el equipo ya lo sabe</span>}
        {approvalStatus === 'pending' && <span className="text-[#9ca3af] font-normal">Aún no respondiste sobre esta pieza</span>}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={clientName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Tu nombre"
          className="text-[12px] rounded-xl border border-[#dde2e7] bg-white px-3 py-1.5 outline-none focus:border-[#7c3aed] w-28 shrink-0"
        />
        <button
          onClick={onRequestChanges}
          className="text-[12px] font-semibold text-[#d97706] border border-[#fde68a] bg-[#fffbeb] px-3 py-1.5 rounded-xl hover:bg-[#fef3c7] hover:scale-105 active:scale-95 transition-all duration-150 shrink-0"
        >
          Solicitar cambios
        </button>
        <button
          disabled={working || !clientName.trim()}
          onClick={approve}
          title={!clientName.trim() ? 'Escribe tu nombre para habilitar esto' : undefined}
          className="text-[12px] font-semibold text-white bg-[#16a34a] px-3 py-1.5 rounded-xl hover:bg-[#15803d] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-150 shrink-0"
        >
          Aprobar
        </button>
      </div>
    </div>
  )
}

// ── Colores por área ──────────────────────────────────────────────────────────
const CATEGORY_COLOR: Record<string, string> = {
  Diseño:      '#ec4899',
  Audiovisual: '#f97316',
  Estrategia:  '#6366f1',
  CM:          '#10b981',
  Agencia:     '#0844ef',
  Otro:        '#64748b',
}

const CATEGORY_ORDER = ['Agencia', 'Diseño', 'CM', 'Audiovisual', 'Estrategia', 'Otro']

const CATEGORY_DESC: Record<string, string> = {
  Agencia:     'Para temas urgentes, consultas generales o si necesitas hablar directamente con alguien del equipo KIMCE.',
  Estrategia:  'Para alinear ideas, ajustar el enfoque de tu contenido o revisar el plan editorial de tu marca.',
  Diseño:      'Para solicitar cambios en piezas gráficas, revisar diseños o pedir ajustes visuales.',
  CM:          'Para todo sobre publicaciones, gestión de tus redes sociales o métricas de comunidad.',
  Audiovisual: 'Para producción de videos, reels o cualquier contenido audiovisual de tu marca.',
  Otro:        'Contacto general del equipo.',
}

// ── Hub / Linktree ────────────────────────────────────────────────────────────
function HubView({
  brand,
  isDark,
  logoFailed,
  onLogoError,
  onNavigate,
}: {
  brand: Brand
  isDark: boolean
  logoFailed: boolean
  onLogoError: () => void
  onNavigate: (view: 'calendario' | 'solicitudes') => void
}) {
  const [contactModal, setContactModal] = useState(false)
  const accent = brand.color || '#0844ef'
  const contacts: BrandContact[] = brand.contacts ?? []

  const cardBase: React.CSSProperties = {
    background:     isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(12px)',
    borderColor:    isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
  }
  const headColor = isDark ? '#f1f5f9' : '#111827'
  const subColor  = isDark ? '#94a3b8'  : '#6b7280'

  const waMsg = encodeURIComponent(`Hola! Soy cliente de ${brand.name} y quiero comunicarme con el equipo KIMCE.`)

  function mailtoLink(contact: BrandContact) {
    const subject = encodeURIComponent(`Consulta - ${brand.name}`)
    const body    = encodeURIComponent(`Hola ${contact.name},\n\n`)
    return `mailto:${contact.email}?cc=kimcestudio@gmail.com&subject=${subject}&body=${body}`
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-start pt-16 pb-12 px-5"
      style={brandMeshBackground(accent, isDark)}
    >
      {/* Brand header */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg overflow-hidden"
          style={{ background: accent }}
        >
          {brand.logo && !logoFailed ? (
            <img src={brand.logo} alt={brand.name} className="w-full h-full object-contain p-2" onError={onLogoError} />
          ) : (
            <span className="text-white text-2xl font-black select-none">{brand.initials}</span>
          )}
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: headColor }}>{brand.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: subColor }}>Portal de cliente · KIMCE</p>
        </div>
      </div>

      {/* Cards */}
      <div className="w-full max-w-sm flex flex-col gap-3">

        {/* Centro de solicitudes */}
        <button
          onClick={() => onNavigate('solicitudes')}
          className="group flex items-center gap-4 p-4 rounded-2xl shadow-sm border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer text-left"
          style={cardBase}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110" style={{ background: `${accent}18` }}>
            <ClipboardList size={22} style={{ color: accent }} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold leading-tight" style={{ color: headColor }}>Centro de solicitudes</p>
            <p className="text-[12px] mt-0.5 leading-snug" style={{ color: subColor }}>Envía nuevas solicitudes o revisa las que están en proceso</p>
          </div>
          <ExternalLink size={14} className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: isDark ? '#94a3b8' : '#374151' }} />
        </button>

        {/* Calendario editorial */}
        <button
          onClick={() => onNavigate('calendario')}
          className="group flex items-center gap-4 p-4 rounded-2xl shadow-sm border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer text-left"
          style={cardBase}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110" style={{ background: `${accent}18` }}>
            <CalendarDays size={22} style={{ color: accent }} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold leading-tight" style={{ color: headColor }}>Calendario editorial</p>
            <p className="text-[12px] mt-0.5 leading-snug" style={{ color: subColor }}>Revisa y aprueba las publicaciones programadas para tus redes</p>
          </div>
          <ExternalLink size={14} className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: isDark ? '#94a3b8' : '#374151' }} />
        </button>

        {/* Hablar con el equipo — abre modal */}
        <button
          onClick={() => setContactModal(true)}
          className="group flex items-center gap-4 p-4 rounded-2xl shadow-sm border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer text-left"
          style={cardBase}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110" style={{ background: `${accent}18` }}>
            <MessageCircle size={22} style={{ color: accent }} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold leading-tight" style={{ color: headColor }}>Hablar con el equipo</p>
            <p className="text-[12px] mt-0.5 leading-snug" style={{ color: subColor }}>Comunícate con el equipo KIMCE por WhatsApp o correo</p>
          </div>
          <ExternalLink size={14} className="shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: isDark ? '#94a3b8' : '#374151' }} />
        </button>

      </div>

      {/* Footer KIMCE */}
      <div className="mt-12 flex items-center gap-2">
        <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[#0844ef]">
          <span className="text-white text-[8px] font-black">K</span>
        </div>
        <p className="text-[11px] font-medium" style={{ color: isDark ? '#64748b' : '#9ca3af' }}>Gestionado por KIMCE Studio</p>
      </div>

      {/* Modal — Hablar con el equipo */}
      {contactModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setContactModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl overflow-hidden flex flex-col"
            style={{
              background:    isDark ? '#0f172a' : '#ffffff',
              maxHeight:     '85dvh',
              boxShadow:     '0 -8px 40px rgba(0,0,0,0.25)',
              animation:     'slideUp 0.25s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle + header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
                  <MessageCircle size={18} style={{ color: accent }} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[15px] font-bold leading-none" style={{ color: headColor }}>Hablar con el equipo</p>
                  <p className="text-[11px] mt-0.5" style={{ color: subColor }}>KIMCE Studio</p>
                </div>
              </div>
              <button
                onClick={() => setContactModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-70 active:scale-95"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
              >
                <X size={15} style={{ color: isDark ? '#94a3b8' : '#6b7280' }} />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {contacts.length === 0 ? (
                <a
                  href={`https://wa.me/${KIMCE_WHATSAPP}?text=${waMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all hover:opacity-80 active:scale-[0.98]"
                  style={{ background: '#25D366', color: '#ffffff' }}
                >
                  <MessageCircle size={18} strokeWidth={2} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold leading-none">KIMCE Studio</p>
                    <p className="text-[11px] mt-0.5 opacity-80">Equipo general · WhatsApp</p>
                  </div>
                  <ExternalLink size={13} className="opacity-70" />
                </a>
              ) : (
                CATEGORY_ORDER.map(cat => {
                  const members = contacts.filter(c => c.category === cat)
                  if (!members.length) return null
                  const catColor = CATEGORY_COLOR[cat] ?? '#64748b'
                  const desc     = CATEGORY_DESC[cat] ?? ''
                  return (
                    <div key={cat} className="flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <div className="w-1 rounded-full shrink-0 mt-0.5" style={{ background: catColor, height: '34px' }} />
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: catColor }}>{cat}</p>
                          <p className="text-[11px] leading-snug mt-0.5" style={{ color: subColor }}>{desc}</p>
                        </div>
                      </div>
                      {members.map((c, i) => {
                        const waMemberMsg = encodeURIComponent(`Hola ${c.name}! Soy cliente de ${brand.name} y quiero consultarte algo.`)
                        return (
                          <div key={i} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${catColor}22` }}>
                            <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: `${catColor}0d` }}>
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-black shrink-0" style={{ background: catColor }}>
                                {c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                              </div>
                              <p className="text-[14px] font-bold leading-none flex-1 truncate" style={{ color: headColor }}>{c.name}</p>
                            </div>
                            <div className="flex gap-2 px-3 py-2.5">
                              <a
                                href={`https://wa.me/${c.phone || KIMCE_WHATSAPP}?text=${waMemberMsg}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all hover:opacity-80"
                                style={{ background: '#25D36618', color: '#16a34a' }}
                              >
                                <Phone size={12} />WhatsApp
                              </a>
                              {c.email && (
                                <a
                                  href={mailtoLink(c)}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all hover:opacity-80"
                                  style={{ background: `${catColor}15`, color: catColor }}
                                >
                                  <Mail size={12} />Correo
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
              <div className="h-4" />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}

function CalendarioCompartidoInner() {
  const params = useParams<{ id: string }>()
  const { NETWORK_META, STATUS_META } = useHubMeta()
  const { isDark, toggle: toggleTheme } = useHubTheme()

  // Con output:export + Firebase Hosting rewrite, useParams puede quedarse con '_'
  // (el shell pre-renderizado). Leemos el segmento real de window.location en el cliente.
  // El segmento puede ser un slug público (ej: "belcorp") o un ID interno legacy.
  const [brandId, setBrandId] = useState<string>(params?.id ?? '_')
  const [urlSegment, setUrlSegment] = useState<string>('_')

  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean)
    const segment = segments[segments.length - 1]
    if (segment && segment !== '_') setUrlSegment(segment)
  }, [])

  const [brand, setBrand] = useState<Brand | null | undefined>(undefined)
  const [logoFailed, setLogoFailed] = useState(false)
  const [contents, setContents] = useState<Content[]>([])
  const [loadingContents, setLoadingContents] = useState(true)
  const [view, setView] = useState<'mes' | 'semana'>('mes')
  const [filterNetwork, setFilterNetwork] = useState('all')
  const [pendingOnlyFilter, setPendingOnlyFilter] = useState(false)
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null)

  // Un solo "¿cómo te llamas?" por sesión de cliente — se reusa para comentar, aprobar y
  // solicitar cambios, en vez de pedirlo de nuevo en cada acción.
  const [clientName, setClientName] = useState('')
  const [changeIntent, setChangeIntent] = useState(false)
  const [mainView, setMainView] = useState<'hub' | 'calendario' | 'solicitudes'>('hub')

  // Leer ?tab del URL para deep-linking desde el hub
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'solicitudes') setMainView('solicitudes')
    else if (tab === 'calendario') setMainView('calendario')
    // sin ?tab → muestra el hub (default)
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem('kimce_client_name')
    if (saved) setClientName(saved)
  }, [])

  useEffect(() => {
    if (clientName.trim()) window.localStorage.setItem('kimce_client_name', clientName.trim())
  }, [clientName])

  // Resuelve el segmento del URL → ID real de Firestore.
  // Filtramos calendarShareEnabled==true para que la query pase las reglas de Firestore
  // sin necesidad de autenticación. Si falla (o no hay slug), usamos el segmento como ID legacy.
  useEffect(() => {
    if (!urlSegment || urlSegment === '_') return
    void getDocs(
      query(
        collection(db, 'cmhub_brands'),
        where('slug', '==', urlSegment),
        where('calendarShareEnabled', '==', true),
        limit(1),
      )
    ).then(snap => {
      if (!snap.empty) {
        setBrandId(snap.docs[0].id)
      } else {
        // fallback: el segmento es un ID interno legacy
        setBrandId(urlSegment)
      }
    }).catch(() => {
      // Si la query falla (permisos u otro error), usamos el segmento como ID directo
      setBrandId(urlSegment)
    })
  }, [urlSegment])

  useEffect(() => {
    if (!brandId || brandId === '_') return
    const unsub = onSnapshot(
      doc(db, 'cmhub_brands', brandId),
      (snap) => setBrand(snap.exists() ? ({ id: snap.id, ...snap.data() } as Brand) : null),
      () => setBrand(null),
    )
    return () => unsub()
  }, [brandId])

  useEffect(() => {
    if (!brandId || brandId === '_' || !brand?.calendarShareEnabled) {
      setLoadingContents(false)
      return
    }
    const q = query(collection(db, 'cmhub_contents'), where('brandId', '==', brandId))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setContents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Content)))
        setLoadingContents(false)
      },
      () => setLoadingContents(false),
    )
    return () => unsub()
  }, [brandId, brand?.calendarShareEnabled])

  // Conteo de comentarios por pieza (total y sin resolver), para mostrar un icono y un color
  // distinto en el calendario — un solo listener por marca en vez de uno por contenido (que
  // solo existia mientras el drawer estaba abierto).
  type CommentMeta = { total: number; unresolved: number }
  const [commentMeta, setCommentMeta] = useState<Map<string, CommentMeta>>(new Map())

  useEffect(() => {
    if (!brandId || brandId === '_' || !brand?.calendarShareEnabled) return
    const q = query(collection(db, 'cmhub_comments'), where('brandId', '==', brandId))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const meta = new Map<string, CommentMeta>()
        snap.docs.forEach((d) => {
          const data = d.data()
          const contentId = data.contentId as string | undefined
          if (!contentId) return
          const entry = meta.get(contentId) ?? { total: 0, unresolved: 0 }
          entry.total += 1
          if (!data.resolved) entry.unresolved += 1
          meta.set(contentId, entry)
        })
        setCommentMeta(meta)
      },
      () => setCommentMeta(new Map()),
    )
    return () => unsub()
  }, [brandId, brand?.calendarShareEnabled])

  function allCommentsResolved(contentId: string) {
    const meta = commentMeta.get(contentId)
    return !!meta && meta.total > 0 && meta.unresolved === 0
  }

  const todayISO = toISO(new Date())

  const monthDays = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const start = mondayOf(first)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return { date: d, dateISO: toISO(d), thisMonth: d.getMonth() === anchor.getMonth() }
    })
  }, [anchor])

  const weekDays = useMemo(() => {
    const start = mondayOf(anchor)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return { date: d, dateISO: toISO(d), thisMonth: true }
    })
  }, [anchor])

  const visibleDays = view === 'mes' ? monthDays : weekDays

  const filteredContents = useMemo(() => {
    return contents.filter((c) => {
      if (pendingOnlyFilter && !isPendingApproval(c)) return false
      if (filterNetwork === 'all') return true
      const nets = c.channels?.length ? c.channels : [c.channel]
      return nets.includes(filterNetwork as never)
    })
  }, [contents, filterNetwork, pendingOnlyFilter])

  // El KPI "Por aprobar" es clicable: salta al mes de la primera pieza pendiente, la abre
  // directo en el panel de detalle, y deja el calendario filtrado a solo esas piezas (por si
  // hay mas de una) hasta que el cliente lo quite.
  function goToFirstPendingApproval() {
    const pending = contents
      .filter((c) => isPendingApproval(c) && !!c.date)
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
    if (pending.length === 0) return
    const first = pending[0]
    setPendingOnlyFilter(true)
    setView('mes')
    setAnchor(mondayOf(new Date(`${first.date}T00:00:00`)))
    setSelectedDay(first.date!)
    setSelectedContentId(first.id)
    setChangeIntent(false)
  }

  const contentsByDay = useMemo(() => {
    const map = new Map<string, Content[]>()
    filteredContents.forEach((c) => {
      if (!c.date) return
      const list = map.get(c.date) ?? []
      list.push(c)
      map.set(c.date, list)
    })
    return map
  }, [filteredContents])

  const kpis = useMemo(() => {
    const monthKey = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`
    const thisMonth = contents.filter((c) => c.date?.startsWith(monthKey))
    const published = thisMonth.filter((c) => c.status === 'publicado').length
    const pendingApproval = contents.filter(isPendingApproval).length
    return { piecesThisMonth: thisMonth.length, published, pendingApproval }
  }, [contents, anchor])

  const periodLabel = useMemo(() => {
    if (view === 'mes') return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`
    const start = weekDays[0]?.date
    const end = weekDays[6]?.date
    if (!start || !end) return ''
    return `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`
  }, [view, anchor, weekDays])

  function shift(dir: 1 | -1) {
    setAnchor((d) => {
      const nd = new Date(d)
      if (view === 'mes') nd.setMonth(d.getMonth() + dir)
      else nd.setDate(d.getDate() + dir * 7)
      return nd
    })
  }

  function goToday() {
    setAnchor(mondayOf(new Date()))
  }

  function openDay(dateISO: string) {
    setSelectedDay(dateISO)
    setSelectedContentId(null)
    setChangeIntent(false)
  }

  // Clic directo sobre una tarjeta: abre el detalle de esa pieza puntual, sin pasar por el
  // resumen del dia (aunque haya mas piezas ese mismo dia).
  function openContent(dateISO: string, contentId: string) {
    setSelectedDay(dateISO)
    setSelectedContentId(contentId)
    setChangeIntent(false)
  }

  function closePanel() {
    setSelectedDay(null)
    setSelectedContentId(null)
    setChangeIntent(false)
  }

  if (brandId === '_' || brand === undefined || (brand?.calendarShareEnabled && loadingContents && mainView !== 'hub')) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={brandMeshBackground(brand?.color, isDark)}>
        <Loader2 size={24} className="animate-spin text-white drop-shadow" />
      </div>
    )
  }

  if (!brand || !brand.calendarShareEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={brandMeshBackground(brand?.color, isDark)}>
        <div className="kimce-glass-strong rounded-2xl p-8 max-w-md text-center">
          <div className="text-[16px] font-bold text-[#111827] mb-2">Calendario no disponible</div>
          <div className="text-[13px] text-[#6b7280]">
            Este enlace no existe o el calendario fue desactivado por el administrador.
          </div>
        </div>
      </div>
    )
  }

  if (mainView === 'hub') {
    return (
      <HubView
        brand={brand}
        isDark={isDark}
        logoFailed={logoFailed}
        onLogoError={() => setLogoFailed(true)}
        onNavigate={(view) => { setMainView(view); closePanel() }}
      />
    )
  }

  const selectedContents = selectedDay ? contentsByDay.get(selectedDay) ?? [] : []
  const activeContent = selectedContentId
    ? selectedContents.find((c) => c.id === selectedContentId) ?? null
    : selectedContents.length === 1
      ? selectedContents[0]
      : null
  const showSummaryList = selectedContents.length > 1 && !activeContent

  // Si la pieza ya tiene historial (comentarios previos o cambios ya solicitados), la columna
  // de comentarios se abre directo al verla — "Solicitar cambios" solo hace falta para iniciar
  // una solicitud nueva, no para revisar lo que ya se conversó.
  const hasCommentHistory = activeContent
    ? (commentMeta.get(activeContent.id)?.total ?? 0) > 0 || activeContent.approvalStatus === 'changes_requested'
    : false
  const showCommentsColumn = changeIntent || hasCommentHistory

  return (
    <div className="min-h-screen flex flex-col" style={brandMeshBackground(brand.color, isDark)}>
      <div className="kimce-glass-strong sticky top-0 z-30 border-b border-white/50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {brand.logo && !logoFailed ? (
            <img
              src={brand.logo}
              alt={brand.name}
              onError={() => setLogoFailed(true)}
              className="w-11 h-11 rounded-2xl object-cover shadow-md shrink-0 bg-white border border-white/60"
            />
          ) : (
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[14px] font-extrabold text-white shadow-md shrink-0" style={{ background: brand.color }}>
              {brand.initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-bold text-[#111827] truncate">{brand.name}</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMainView('hub')}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#9ca3af] hover:text-[#374151] transition-all duration-150"
              >
                <ArrowLeft size={10} />
                Portal
              </button>
              <span className="text-[#e5e7eb] text-[11px]">·</span>
              <button
                onClick={() => setMainView('calendario')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-150 ${mainView === 'calendario' ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-[#9ca3af] hover:text-[#374151]'}`}
              >
                <Calendar size={11} />
                Calendario
              </button>
              <button
                onClick={() => { setMainView('solicitudes'); closePanel() }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-150 ${mainView === 'solicitudes' ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-[#9ca3af] hover:text-[#374151]'}`}
              >
                <ClipboardList size={11} />
                Solicitudes
              </button>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <div className="text-center leading-tight">
              <div className="text-[15px] font-bold text-[#111827]">{kpis.piecesThisMonth}</div>
              <div className="text-[9px] font-medium text-[#9ca3af] uppercase tracking-wide whitespace-nowrap">Piezas</div>
            </div>
            <div className="w-px h-7 bg-[#e5e7eb]" />
            <div className="text-center leading-tight">
              <div className="text-[15px] font-bold text-[#111827]">{kpis.published}</div>
              <div className="text-[9px] font-medium text-[#9ca3af] uppercase tracking-wide whitespace-nowrap">Publicadas</div>
            </div>
            <div className="w-px h-7 bg-[#e5e7eb]" />
            <button
              onClick={goToFirstPendingApproval}
              disabled={kpis.pendingApproval === 0}
              title={kpis.pendingApproval > 0 ? 'Ir a la primera pieza pendiente de tu aprobación' : undefined}
              className="text-center leading-tight hover:scale-105 active:scale-95 transition-transform duration-150 disabled:hover:scale-100 disabled:cursor-default"
            >
              <div className="text-[15px] font-bold text-[#7c3aed]">{kpis.pendingApproval}</div>
              <div className="text-[9px] font-semibold text-[#7c3aed] uppercase tracking-wide whitespace-nowrap">Cambios solicitados</div>
            </button>
          </div>

          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#f0fdf4] text-[#16a34a] shrink-0">
            En vivo
          </span>

          <button
            onClick={toggleTheme}
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#111827] hover:scale-110 active:scale-95 transition-all duration-150 shrink-0"
          >
            {isDark ? <Sun size={14} className="text-yellow-400" /> : <Moon size={14} />}
          </button>
        </div>
        {brand.links && Object.values(brand.links).some(Boolean) && (
          <div className="max-w-5xl mx-auto mt-3 flex flex-wrap gap-1.5">
            {BRAND_LINK_ORDER.map((key) => {
              const url = brand.links?.[key]
              if (!url) return null
              const meta = NETWORK_META[key]
              const Icon = BRAND_LINK_ICONS[key]
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150 hover:opacity-80 hover:scale-105 active:scale-95"
                  style={meta ? { background: meta.bg, color: meta.text } : { background: '#f3f4f6', color: '#374151' }}
                >
                  {meta ? <NetworkIcon network={key as Network} size={11} /> : Icon ? <Icon size={11} /> : null}
                  {BRAND_LINK_LABELS[key]}
                </a>
              )
            })}
          </div>
        )}
      </div>

      {mainView === 'solicitudes' && (
        <div className="max-w-5xl mx-auto px-6 py-5 flex-1 w-full">
          <SolicitudesSection brandId={brandId} brandName={brand.name} />
        </div>
      )}

      {mainView === 'calendario' && (
      <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col gap-4 flex-1 w-full">
        <div className="kimce-glass rounded-2xl px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => shift(-1)} className="w-8 h-8 rounded-xl bg-white border border-[#e5e7eb] flex items-center justify-center text-[#6b7280] hover:bg-[#f3f4f6] hover:scale-110 active:scale-95 transition-all duration-150">
                <ChevronLeft size={15} />
              </button>
              <button onClick={goToday} className="text-[12px] font-semibold text-[#6b7280] hover:text-[#111827] hover:scale-105 active:scale-95 transition-all duration-150 px-2">
                Hoy
              </button>
              <button onClick={() => shift(1)} className="w-8 h-8 rounded-xl bg-white border border-[#e5e7eb] flex items-center justify-center text-[#6b7280] hover:bg-[#f3f4f6] hover:scale-110 active:scale-95 transition-all duration-150">
                <ChevronRight size={15} />
              </button>
              <span className="text-[14px] font-bold text-[#111827] ml-1 capitalize">{periodLabel}</span>
            </div>

            <div className="flex bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shrink-0">
              <button
                onClick={() => setView('mes')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${view === 'mes' ? 'bg-[#7c3aed] text-white font-semibold' : 'text-[#6b7280] hover:bg-[#f9fafb] hover:scale-105 active:scale-95'}`}
              >
                <Calendar size={12} /> Mes
              </button>
              <button
                onClick={() => setView('semana')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${view === 'semana' ? 'bg-[#7c3aed] text-white font-semibold' : 'text-[#6b7280] hover:bg-[#f9fafb] hover:scale-105 active:scale-95'}`}
              >
                <CalendarDays size={12} /> Semana
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <NetworkFilter contents={contents} value={filterNetwork} onChange={setFilterNetwork} />
            {pendingOnlyFilter && (
              <button
                onClick={() => setPendingOnlyFilter(false)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7c3aed] bg-[#f5f3ff] border border-[#ddd6fe] px-2.5 py-1 rounded-full hover:bg-[#ede9fe] hover:scale-105 active:scale-95 transition-all duration-150 shrink-0"
              >
                Solo pendientes de aprobación
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="kimce-glass rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#f3f4f6]">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-[11px] font-bold uppercase tracking-wide text-[#9ca3af] text-center py-2.5">
                {d}
              </div>
            ))}
          </div>
          <div className={`grid grid-cols-7 ${view === 'mes' ? '' : 'min-h-[420px]'}`}>
            {visibleDays.map((cell) => {
              const dayContents = contentsByDay.get(cell.dateISO) ?? []
              const isToday = cell.dateISO === todayISO
              const visible = view === 'mes' ? dayContents.slice(0, 3) : dayContents
              const extra = view === 'mes' ? dayContents.length - visible.length : 0
              const isClickable = view === 'semana' || dayContents.length > 0
              return (
                <div
                  key={cell.dateISO}
                  onClick={() => isClickable && openDay(cell.dateISO)}
                  className={`relative border-b border-r border-[#f3f4f6] p-2 text-left flex flex-col gap-1 transition-all duration-150 ${
                    cell.thisMonth ? 'bg-white' : 'bg-[#fafafa]'
                  } ${
                    isClickable
                      ? 'hover:bg-[#f9fafb] hover:shadow-md hover:-translate-y-0.5 hover:z-10 cursor-pointer'
                      : 'cursor-default'
                  } ${view === 'mes' ? 'min-h-[92px]' : 'min-h-[420px] align-top'}`}
                >
                  <span
                    className={`text-[12px] font-semibold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday ? 'bg-[#7c3aed] text-white' : cell.thisMonth ? 'text-[#374151]' : 'text-[#d1d5db]'
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  <div className="flex flex-col gap-1">
                    {visible.map((c) => {
                      const statusMeta = STATUS_META[c.status]
                      const isHighlighted = c.status === 'programado' || c.status === 'publicado'
                      const meta = commentMeta.get(c.id)
                      const resolved = allCommentsResolved(c.id)

                      if (view === 'semana') {
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openContent(cell.dateISO, c.id) }}
                            className={`flex flex-col gap-1 px-2 py-1.5 rounded-lg text-[11px] border text-left hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-150 ${
                              resolved ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#e2e8f0] bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="flex items-center gap-1 shrink-0">
                                {getContentNetworks(c).map((net) => (
                                  <span key={net} className="w-3.5 h-3.5 flex items-center justify-center" style={{ color: NETWORK_META[net]?.dot ?? '#6b7280' }}>
                                    <NetworkIcon network={net} size={11} />
                                  </span>
                                ))}
                                {c.approvalStatus === 'changes_requested' && (
                                  <span className="text-[#d97706]" title="Solicitaste cambios — esperando al equipo">
                                    <MessageSquare size={11} />
                                  </span>
                                )}
                                {(meta?.total ?? 0) > 0 && (
                                  resolved ? (
                                    <span className="flex items-center gap-0.5 text-[#16a34a]" title="Comentarios resueltos">
                                      <CheckCircle2 size={11} />
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-[#6b7280]" title={`${meta?.total} comentario(s)`}>
                                      <MessageCircle size={11} />
                                      <span className="text-[9px] font-semibold">{meta?.total}</span>
                                    </span>
                                  )
                                )}
                              </span>
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                style={{ background: statusMeta?.bg ?? '#f3f4f6', color: statusMeta?.text ?? '#475569' }}
                              >
                                {statusMeta?.label ?? c.status}
                              </span>
                            </div>
                            <span className="font-semibold text-[#1f2937] leading-snug line-clamp-2">{c.title || c.format}</span>
                            {c.time && <span className="text-[10px] text-[#9ca3af]">{c.time}</span>}
                          </button>
                        )
                      }

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openContent(cell.dateISO, c.id) }}
                          className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-[10px] font-semibold truncate text-left w-full hover:scale-105 hover:shadow-sm transition-all duration-150 ${
                            isHighlighted
                              ? ''
                              : resolved
                                ? 'border border-[#bbf7d0] bg-[#dcfce7] text-[#166534]'
                                : 'border border-[#e2e8f0] bg-[#eef1f4] text-[#475569]'
                          }`}
                          style={isHighlighted ? { background: statusMeta?.bg ?? '#f3f4f6', color: statusMeta?.text ?? '#374151' } : undefined}
                        >
                          {!isHighlighted && (
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: resolved ? '#16a34a' : statusMeta?.dot ?? '#9ca3af' }} />
                          )}
                          <span
                            className="shrink-0 flex items-center gap-0.5"
                            style={{ color: isHighlighted ? statusMeta?.dot ?? '#6b7280' : '#6b7280' }}
                          >
                            {getContentNetworks(c).map((net) => (
                              <span key={net} className="w-3 h-3 flex items-center justify-center">
                                <NetworkIcon network={net} size={9} />
                              </span>
                            ))}
                          </span>
                          <span className="truncate flex-1">{c.title || c.format}</span>
                          {(meta?.total ?? 0) > 0 && (
                            resolved ? (
                              <span className="shrink-0 text-[#16a34a]" title="Comentarios resueltos">
                                <CheckCircle2 size={10} />
                              </span>
                            ) : (
                              <span className="shrink-0 text-[#6b7280]" title={`${meta?.total} comentario(s)`}>
                                <MessageCircle size={10} />
                              </span>
                            )
                          )}
                          {c.approvalStatus === 'changes_requested' && (
                            <span className="shrink-0 text-[#d97706]" title="Solicitaste cambios — esperando al equipo">
                              <MessageSquare size={10} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {extra > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openDay(cell.dateISO) }}
                        className="text-[10px] font-semibold text-[#9ca3af] px-1.5 text-left hover:text-[#6b7280] transition-colors"
                      >
                        +{extra} más
                      </button>
                    )}
                    {view === 'semana' && dayContents.length === 0 && (
                      <span className="text-[10px] text-[#cbd5e1] px-1.5">Sin contenido</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="kimce-glass rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-3 text-[11px] text-[#6b7280]">
          <span className="font-semibold text-[#9ca3af] uppercase tracking-wide text-[10px]">Estado:</span>
          {ALL_STATUSES.map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_META[status]?.dot }} />
              {STATUS_META[status]?.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[#d97706]">
            <MessageSquare size={11} />
            Solicitaste cambios
          </span>
          <span className="flex items-center gap-1.5 text-[#6b7280]">
            <MessageCircle size={11} />
            Tiene comentarios
          </span>
          <span className="flex items-center gap-1.5 text-[#16a34a]">
            <CheckCircle2 size={11} />
            Comentarios resueltos
          </span>
        </div>
      </div>
      )}

      <footer className="mt-auto py-5 flex items-center justify-center">
        <a
          href="https://kimcestudio.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 hover:opacity-80 hover:scale-105 active:scale-95 transition-all duration-150"
        >
          <img src="/brand/logo-horizontal-azul.png" alt="KimceStudio" className="h-3.5 w-auto" />
        </a>
      </footer>

      {mainView === 'calendario' && selectedDay && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#1f2245]/25 kimce-fade-enter" onClick={closePanel}>
          <div
            className={`kimce-glass kimce-drawer-enter rounded-l-3xl w-full h-full overflow-y-auto shadow-2xl flex flex-col ${
              !activeContent ? 'max-w-md' : showCommentsColumn ? 'max-w-3xl' : 'max-w-md'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/50 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {activeContent && selectedContents.length > 1 && (
                  <button
                    onClick={() => { setSelectedContentId(null); setChangeIntent(false) }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#111827] hover:scale-110 active:scale-95 transition-all duration-150 shrink-0"
                  >
                    <ChevronLeft size={15} />
                  </button>
                )}
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-[#111827] capitalize truncate">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className="text-[11px] text-[#9ca3af]">
                    {selectedContents.length} publicación{selectedContents.length === 1 ? '' : 'es'}
                  </div>
                </div>
              </div>
              <button onClick={closePanel} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#111827] hover:scale-110 active:scale-95 transition-all duration-150 shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              {selectedContents.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-12 text-[#9ca3af]">
                  <Calendar size={28} className="mb-2 text-[#cbd5e1]" />
                  <div className="text-[13px] font-semibold text-[#6b7280]">Sin contenido programado</div>
                  <div className="text-[11px] mt-1">Aún no hay publicaciones cargadas para este día.</div>
                </div>
              )}

              {showSummaryList &&
                selectedContents.map((c) => {
                  const statusMeta = STATUS_META[c.status]
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedContentId(c.id); setChangeIntent(false) }}
                      className="flex items-center gap-3 rounded-2xl border border-[#dde2e7] bg-[#eef1f4] p-3 text-left transition-all duration-150 hover:bg-[#e7ebee] hover:shadow-md hover:-translate-y-0.5"
                    >
                      <span className="flex items-center gap-1 shrink-0">
                        {getContentNetworks(c).map((net) => {
                          const meta = NETWORK_META[net]
                          return (
                            <span
                              key={net}
                              className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ background: meta?.bg ?? '#e2e8f0', color: meta?.dot ?? '#64748b' }}
                            >
                              <NetworkIcon network={net} size={12} />
                            </span>
                          )
                        })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#111827] truncate">{c.title || c.format}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
                          {c.time && <span>{c.time}</span>}
                          <span
                            className="font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: statusMeta?.bg ?? '#e2e8f0', color: statusMeta?.text ?? '#64748b' }}
                          >
                            {statusMeta?.label ?? c.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}

              {activeContent && (
              <div className={`grid grid-cols-1 gap-4 items-start ${showCommentsColumn ? 'lg:grid-cols-[1.3fr_1fr]' : ''}`}>
              {(() => {
                const c = activeContent
                const statusMeta = STATUS_META[c.status]
                const designLink = c.driveUrl || c.designUrl || null
                const embed = getDriveEmbed(c.driveUrl) ?? getDriveEmbed(c.designUrl)
                return (
                  <div className="rounded-2xl border border-[#dde2e7] bg-[#eef1f4] p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getContentNetworks(c).map((net) => {
                          const meta = NETWORK_META[net]
                          return (
                            <span key={net} className="flex items-center gap-1">
                              <span
                                className="w-6 h-6 rounded-lg flex items-center justify-center"
                                style={{ background: meta?.bg ?? '#e2e8f0', color: meta?.dot ?? '#64748b' }}
                              >
                                <NetworkIcon network={net} size={12} />
                              </span>
                              <span className="text-[12px] font-semibold text-[#374151]">{meta?.label ?? net}</span>
                            </span>
                          )
                        })}
                        <span className="text-[11px] text-[#64748b]">· {c.format}</span>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: statusMeta?.bg ?? '#e2e8f0', color: statusMeta?.text ?? '#64748b' }}
                      >
                        {statusMeta?.label ?? c.status}
                      </span>
                    </div>

                    <div className="text-[14px] font-bold text-[#111827]">{c.title}</div>

                    <div className="text-[11px] text-[#64748b]">
                      Fecha: {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {c.time && ` · Hora: ${c.time}`}
                    </div>

                    <div
                      className={`text-[13px] whitespace-pre-wrap rounded-xl p-3 bg-white max-h-32 overflow-y-auto ${
                        c.copy ? 'text-[#374151]' : 'text-[#9ca3af] italic'
                      }`}
                    >
                      {c.copy || 'Sin copy redactado.'}
                    </div>

                    {embed ? (
                      <div className="flex flex-col gap-2">
                        <div className="rounded-xl border border-[#dde2e7] overflow-hidden bg-white">
                          <iframe
                            src={embed.url}
                            className={`w-full ${embed.isFolder ? 'h-80' : 'h-64'}`}
                            allow="autoplay"
                            title={`Diseño – ${c.title}`}
                          />
                        </div>
                        <a
                          href={designLink ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#7c3aed] hover:underline"
                        >
                          <ExternalLink size={12} /> Abrir en Drive
                        </a>
                      </div>
                    ) : designLink ? (
                      <a
                        href={designLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#7c3aed] border border-[#dde2e7] rounded-xl px-3 py-2 bg-white hover:bg-[#f5f3ff] transition-colors"
                      >
                        <ExternalLink size={13} /> No se pudo cargar la previsualización. Abrir archivo
                      </a>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#9ca3af] border border-dashed border-[#dde2e7] rounded-xl px-3 py-2 bg-white">
                        Sin diseño cargado
                      </div>
                    )}

                    {(c.status === 'revision' || c.status === 'aprobado') && (
                      <ApprovalActions
                        content={c}
                        clientName={clientName}
                        onNameChange={setClientName}
                        onRequestChanges={() => setChangeIntent(true)}
                      />
                    )}
                  </div>
                )
              })()}
              {showCommentsColumn && (
              <CommentThread
                contentId={activeContent.id}
                brandId={activeContent.brandId}
                name={clientName}
                onNameChange={setClientName}
                highlighted={changeIntent}
                placeholderOverride="¿Qué necesitas que ajustemos?"
                onSubmitted={async () => {
                  await updateDoc(doc(db, 'cmhub_contents', activeContent.id), {
                    approvalStatus: 'changes_requested',
                    ...(activeContent.status === 'aprobado' ? { status: 'revision' } : {}),
                  })
                  setChangeIntent(false)
                }}
              />
              )}
              </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CalendarioCompartidoPage() {
  return (
    <HubThemeProvider>
      <CalendarioCompartidoInner />
    </HubThemeProvider>
  )
}
