'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Columns3, Calendar, CalendarDays, BarChart2,
  Clock, FolderKanban, ClipboardList,
  MessageSquare,
  ChevronLeft, ChevronDown, Plus, Building2, Sun, Moon,
  Eye, X, Check, ShieldCheck, Sparkles, Zap,
  BookOpen, ClipboardCheck, FileText, TrendingUp, Inbox, Users2,
  Video,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { useHubTheme } from '@/cmhub/theme'
import BrandModal from '@/components/cmhub/BrandModal'
import AiQuickAddModal from '@/components/cmhub/AiQuickAddModal'
import QuickAssignModal from '@/components/cmhub/QuickAssignModal'
import NotificationBell from '@/components/cmhub/NotificationBell'
import { useMyPresence } from '@/services/presence'

// ─── Estructura de navegación ────────────────────────────────────────────────
//   YO         → estado personal, foco del día y vista de semana
//   CLIENTES   → fichas de marca y pedidos de cliente
//   CONTENIDO  → pipeline editorial (crear → publicar → medir)
//   EQUIPO     → entregas y supervisión (admin-only: Supervisión + reportes)
//   TRABAJO    → proyectos, flujos, actividades, reuniones
//   SALA       → comunicación interna
// ─────────────────────────────────────────────────────────────────────────────
export default function HubSidebar() {
  const pathname = usePathname()
  const BASE     = useHubBase()
  const backHref = pathname.startsWith('/app/') ? '/app/dashboard' : '/admin'

  const { isDark, toggle: toggleTheme } = useHubTheme()
  const auth = useOptionalAuth()
  const profile  = auth?.profile ?? auth?.user
  const authUser = auth?.authUser ?? null
  const isAdmin  = (profile as { role?: string })?.role === 'admin' || pathname.startsWith('/admin')
  useMyPresence(authUser?.uid ?? null)
  const { brands, team, viewAs, setViewAs } = useHub()

  // href dinámico "Mi semana" → vista de equipo según el área del colaborador
  const myTeamMember = team.find(m =>
    (authUser?.uid  && m.id    === authUser.uid) ||
    (authUser?.email && m.email.toLowerCase() === authUser.email.toLowerCase())
  )
  const activeArea = viewAs?.category
    ?? myTeamMember?.category
    ?? (profile as { area?: string })?.area
  const miSemanaHref = activeArea === 'Diseño'      ? `${BASE}/equipo/diseno`
    : activeArea === 'Audiovisual' ? `${BASE}/equipo/audiovisual`
    : activeArea === 'Estrategia'  ? `${BASE}/equipo/estrategia`
    : `${BASE}/equipo/estrategia`

  const NAV_GROUPS = [
    {
      label: 'YO',
      items: [
        { href: BASE,             label: 'Dashboard',    Icon: LayoutDashboard },
        { href: `${BASE}/mi-dia`, label: 'Mi jornada',   Icon: ClipboardList   },
        { href: miSemanaHref,     label: 'Vista semanal', Icon: CalendarDays    },
      ],
    },
    {
      label: 'CLIENTES',
      items: [
        { href: `${BASE}/clientes`,             label: 'Clientes', Icon: Building2 },
        { href: `${BASE}/solicitudes-clientes`, label: 'Pedidos',  Icon: Inbox     },
      ],
    },
    {
      label: 'CONTENIDO',
      items: [
        { href: `${BASE}/calendario`, label: 'Publicaciones', Icon: Calendar  },
        { href: `${BASE}/metricas`,   label: 'Analytics',     Icon: BarChart2 },
        { href: `${BASE}/biblioteca`, label: 'Biblioteca',    Icon: BookOpen  },
      ],
    },
    {
      label: 'EQUIPO',
      items: [
        { href: `${BASE}/supervision/mis-entregas`,     label: 'Mis entregas',     Icon: ClipboardCheck          },
        ...(isAdmin ? [
          { href: `${BASE}/supervision`,                  label: 'Supervisión',      Icon: ShieldCheck             },
          { href: `${BASE}/supervision/reporte-entregas`, label: 'Reporte entregas', Icon: FileText,    sub: true  },
          { href: `${BASE}/supervision/reporte-mensual`,  label: 'Reporte mensual',  Icon: TrendingUp,  sub: true  },
        ] : []),
        { href: `${BASE}/equipo`, label: 'Equipo', Icon: Users2 },
      ],
    },
    {
      label: 'TRABAJO',
      items: [
        { href: `${BASE}/actividades`, label: 'Actividades', Icon: Clock        },
        { href: `${BASE}/proyectos`,   label: 'Proyectos',   Icon: FolderKanban },
        { href: `${BASE}/reuniones`,   label: 'Reuniones',   Icon: Video        },
      ],
    },
    {
      label: 'SALA',
      items: [
        { href: `${BASE}/sala`, label: 'La Sala', Icon: MessageSquare },
      ],
    },
  ]
  const [showBrandModal, setShowBrandModal]   = useState(false)
  const [showAiQuickAdd, setShowAiQuickAdd]   = useState(false)
  const [showQuickAssign, setShowQuickAssign]   = useState(false)
  const [showViewAs, setShowViewAs] = useState(false)

  const SIDEBAR_COLLAPSE_KEY = 'hub-sidebar-collapsed'
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [collapseLoaded, setCollapseLoaded]   = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY)
      if (saved) setCollapsedGroups(JSON.parse(saved))
    } catch {}
    setCollapseLoaded(true)
  }, [])

  function toggleGroupCollapsed(label: string) {
    setCollapsedGroups(prev => {
      const next = { ...prev, [label]: !prev[label] }
      try { window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // ── Tokens de color reactivos al tema ──────────────────────────────────
  const T = isDark ? {
    nav:        'rgba(255,255,255,0.02)',
    navBorder:  'rgba(255,255,255,0.07)',
    text:       '#94a3b8',
    textHead:   '#f1f5f9',
    textSub:    '#475569',
    labelColor: 'rgba(255,255,255,0.20)',
    activeBase: 'rgba(99,102,241,0.15)',
    activeText: '#818cf8',
    hover:      'rgba(255,255,255,0.05)',
    hoverText:  '#e2e8f0',
    iconDef:    '#4b5563',
    divider:    'rgba(255,255,255,0.07)',
    footerBdr:  'rgba(255,255,255,0.07)',
    groupLabel: isDark ? 'rgba(255,255,255,0.25)' : '#c9ced6',
  } : {
    nav:        '#ffffff',
    navBorder:  '#e5e7eb',
    text:       '#6b7280',
    textHead:   '#111827',
    textSub:    '#9ca3af',
    labelColor: '#c9ced6',
    activeBase: '#f5f3ff',
    activeText: '#6d28d9',
    hover:      '#f9fafb',
    hoverText:  '#111827',
    iconDef:    '#b0b7c3',
    divider:    '#f3f4f6',
    footerBdr:  '#f3f4f6',
    groupLabel: '#c9ced6',
  }

  const isActive = (href: string) => {
    if (href === BASE) return pathname === BASE
    return pathname.startsWith(href)
  }

  const activeBrandId = pathname.startsWith(`${BASE}/clientes/`)
    ? pathname.split('/').pop()
    : null

  return (
    <>
      <nav
        className="hub-sidebar w-56 flex flex-col shrink-0 h-full rounded-[28px] overflow-hidden transition-colors duration-200"
        style={{
          background: isDark
            ? 'linear-gradient(160deg, rgba(28,30,40,0.97) 0%, rgba(18,20,28,0.99) 100%)'
            : 'linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(248,249,252,0.97) 100%)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}`,
          boxShadow: isDark
            ? '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 8px 40px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1), 2px 0 20px rgba(0,0,0,0.03)',
        }}
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4 shrink-0" style={{ borderBottom: `1px solid ${T.divider}` }}>
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors mb-4"
            style={{ color: T.text }}
          >
            <ChevronLeft size={13} />
            Volver al portal
          </Link>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {/* Logo */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] flex items-center justify-center shadow-sm shrink-0">
                <span className="text-white text-[12px] font-bold">KS</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-none truncate" style={{ color: T.textHead }}>Kimce Suite</div>
                <div className="text-[10px] mt-0.5 truncate" style={{ color: T.textSub }}>Gestión de contenidos</div>
              </div>
            </div>
            {/* Acciones */}
            <div className="flex items-center gap-0.5 flex-wrap">
              {/* Notificaciones */}
              {authUser?.uid && <NotificationBell uid={authUser.uid} isDark={isDark} />}
              {/* Toggle tema */}
              <button
                onClick={toggleTheme}
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: T.text }}
              >
                {isDark
                  ? <Sun size={13} className="text-yellow-400" />
                  : <Moon size={13} />
                }
              </button>
              {/* Ver como colaborador — solo admin */}
              {isAdmin && (
                <button
                  onClick={() => setShowViewAs(true)}
                  title="Ver portal como colaborador"
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                  style={{ color: viewAs ? '#7c3aed' : T.text }}
                >
                  <Eye size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Navegación ─────────────────────────────────────────────────── */}

        <div className="px-3 py-2 flex flex-col gap-1 shrink-0 overflow-y-auto"
          style={{ maxHeight: 'calc(100% - 240px)' }}>
          {NAV_GROUPS.map(({ label, items }) => {
            const collapsible = label !== 'YO'
            const isCollapsed = collapsible && collapseLoaded && collapsedGroups[label]
            return (
            <div key={label} className="mb-1">
              <button
                type="button"
                onClick={() => collapsible && toggleGroupCollapsed(label)}
                disabled={!collapsible}
                className="w-full px-3 pt-2 pb-1 flex items-center justify-between gap-1 transition-colors"
                style={{ cursor: collapsible ? 'pointer' : 'default' }}
              >
                <span className="text-[9px] font-bold tracking-[0.1em] uppercase"
                  style={{ color: T.groupLabel }}>
                  {label}
                </span>
                {collapsible && (
                  <ChevronDown size={11}
                    style={{
                      color: T.groupLabel,
                      transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                )}
              </button>
              {!isCollapsed && items.map(({ href, label: itemLabel, Icon, ...itemRest }) => {
                const active = isActive(href)
                const isSub = (itemRest as { sub?: boolean }).sub
                return (
                  <Link key={href} href={href}
                    className="flex items-center gap-2.5 rounded-xl font-medium transition-all"
                    style={{
                      background: active ? T.activeBase : 'transparent',
                      color:      active ? T.activeText : T.text,
                      fontWeight: active ? 600 : 500,
                      padding:    isSub ? '5px 12px 5px 28px' : '7px 12px',
                    }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = T.hover; (e.currentTarget as HTMLElement).style.color = T.hoverText } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.text } }}
                  >
                    <Icon size={isSub ? 12 : 14} strokeWidth={active ? 2.5 : 1.8}
                      style={{ color: active ? (isDark ? '#818cf8' : '#7c3aed') : isSub ? T.textSub : T.iconDef, flexShrink: 0 }} />
                    <span className="truncate" style={{ fontSize: isSub ? '12px' : '13px' }}>{itemLabel}</span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: isDark ? '#818cf8' : '#7c3aed' }} />}
                  </Link>
                )
              })}
            </div>
          )
          })}
        </div>

        {/* ── Separador ──────────────────────────────────────────────────── */}
        <div className="mx-4 h-px shrink-0" style={{ background: T.divider }} />

        {/* ── Brand switcher ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-[9px] font-bold tracking-[0.1em] uppercase" style={{ color: T.groupLabel }}>
              Clientes activos
            </span>
            <button onClick={() => setShowBrandModal(true)} title="Nuevo cliente"
              className="w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: T.iconDef }}>
              <Plus size={11} />
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {brands.filter(b => b.status === 'active').map(brand => {
              const isActiveBrand = activeBrandId === brand.id
              return (
                <Link key={brand.id} href={`${BASE}/clientes/${brand.id}`} title={brand.name}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-[12px] transition-all"
                  style={{
                    background: isActiveBrand ? T.activeBase : 'transparent',
                    color:      isActiveBrand ? T.activeText : T.text,
                    fontWeight: isActiveBrand ? 600 : 400,
                  }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-extrabold text-white shrink-0 shadow-sm"
                    style={{ background: brand.color }}>
                    {brand.initials}
                  </div>
                  <span className="truncate flex-1">{brand.name}</span>
                </Link>
              )
            })}

            {brands.filter(b => b.status !== 'active').map(brand => (
              <Link key={brand.id} href={`${BASE}/clientes/${brand.id}`} title={`${brand.name} (pausado)`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-[12px] transition-all opacity-40"
                style={{ color: T.text }}>
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ background: brand.color }}>
                  {brand.initials}
                </div>
                <span className="truncate flex-1 line-through">{brand.name}</span>
              </Link>
            ))}

            {brands.length === 0 && (
              <div className="px-2 py-4 text-center text-[11px]" style={{ color: T.textSub }}>
                Cargando clientes…
              </div>
            )}
          </div>
        </div>

        {/* ── User footer ────────────────────────────────────────────────── */}
        <div className="px-4 py-3 shrink-0" style={{ borderTop: `1px solid ${T.footerBdr}` }}>
          <div className="flex items-center gap-2.5">
            <img
              src={profile?.photoURL ?? 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=60&q=80'}
              alt={profile?.displayName ?? authUser?.email ?? 'Usuario'}
              className="w-8 h-8 rounded-full object-cover shrink-0"
              style={{ border: `1px solid ${T.navBorder}` }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate" style={{ color: T.textHead }}>
                {profile?.displayName ?? authUser?.email ?? 'Usuario'}
              </div>
              <div className="text-[10px] truncate" style={{ color: T.textSub }}>
                {profile?.position ?? 'Admin'}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {showBrandModal && <BrandModal onClose={() => setShowBrandModal(false)} />}
      {showAiQuickAdd && <AiQuickAddModal onClose={() => setShowAiQuickAdd(false)} />}
      {showQuickAssign && <QuickAssignModal onClose={() => setShowQuickAssign(false)} />}

      {/* ── Botones flotantes ───────────────────────────────────────────── */}
      {!showAiQuickAdd && !showQuickAssign && (
        <div className="fixed bottom-6 right-6 z-[250] flex flex-col gap-2 items-end">
          <button
            onClick={() => setShowQuickAssign(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border shadow-md cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 text-[12px] font-semibold"
            style={{ background: '#ffffff', borderColor: '#e5e7eb', color: '#7c3aed' }}
          >
            <Zap size={14} style={{ color: '#7c3aed' }} />
            Asignar tarea
          </button>
          <button
            onClick={() => setShowAiQuickAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5 text-[12px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            <Sparkles size={15} className="text-white" />
            Agregar con IA
          </button>
        </div>
      )}

      {/* ── Modal selector "ver como" ────────────────────────────────────── */}
      {showViewAs && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowViewAs(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: isDark ? '#161820' : '#ffffff' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${T.divider}` }}>
              <div>
                <p className="text-[15px] font-bold" style={{ color: T.textHead }}>Ver portal como…</p>
                <p className="text-[12px] mt-0.5" style={{ color: T.textSub }}>Selecciona un colaborador para ver el hub desde su perspectiva</p>
              </div>
              <button onClick={() => setShowViewAs(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-black/10 transition-colors" style={{ color: T.text }}>
                <Plus size={14} className="rotate-45" />
              </button>
            </div>

            {/* Grid de colaboradores */}
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {viewAs && (
                <button
                  onClick={() => { setViewAs(null); setShowViewAs(false) }}
                  className="w-full flex items-center gap-3 mb-4 px-4 py-2.5 rounded-2xl text-[13px] font-semibold transition-colors"
                  style={{ background: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', color: '#ef4444' }}
                >
                  <X size={14} /> Salir de vista como "{viewAs.name}"
                </button>
              )}
              {(['Estrategia', 'CM', 'Diseño', 'Audiovisual', 'Agencia', 'Otro'] as const).map(cat => {
                const members = team.filter(m => (m.category ?? 'Otro') === cat)
                if (!members.length) return null
                const catColors: Record<string, string> = { Diseño: '#ec4899', Audiovisual: '#f97316', Estrategia: '#6366f1', CM: '#10b981', Agencia: '#0844ef', Otro: '#64748b' }
                return (
                  <div key={cat} className="mb-5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: catColors[cat] }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textSub }}>{cat}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {members.map(m => {
                        const isSelected = viewAs?.id === m.id
                        return (
                          <button
                            key={m.id}
                            onClick={() => { setViewAs(m); setShowViewAs(false) }}
                            className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all"
                            style={{
                              background: isSelected ? (isDark ? 'rgba(124,58,237,0.15)' : '#f5f3ff') : 'transparent',
                              borderColor: isSelected ? '#7c3aed' : (isDark ? 'rgba(255,255,255,0.07)' : '#e5e7eb'),
                            }}
                          >
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px]"
                              style={{ background: m.color || catColors[cat] }}>
                              {m.initials}
                            </div>
                            <div className="text-center">
                              <p className="text-[12px] font-semibold leading-tight" style={{ color: isSelected ? '#7c3aed' : T.textHead }}>{m.name}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: T.textSub }}>{m.position ?? m.category}</p>
                            </div>
                            {isSelected && <span className="text-[9px] font-bold text-[#7c3aed] bg-[#ede9fe] px-2 py-0.5 rounded-full">Activo</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {team.length === 0 && (
                <p className="text-center py-8 text-[13px]" style={{ color: T.textSub }}>Sin colaboradores registrados</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
