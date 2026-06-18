'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Columns3, Calendar, CalendarDays, BarChart2,
  CheckSquare, Clock, FolderKanban,
  MessageSquare, Dice5, Shuffle, ShoppingBag,
  ChevronLeft, ChevronDown, Plus, Building2, Sun, Moon,
  Palette, Video, Target, UserCheck, Eye, X, Check, ShieldCheck, Download, Sparkles,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useOptionalAuth } from '@/components/auth/AuthProvider'
import { useHub } from '@/cmhub/context'
import { useHubBase } from '@/cmhub/useHubBase'
import { useHubTheme } from '@/cmhub/theme'
import BrandModal from '@/components/cmhub/BrandModal'
import NotionMigrateModal from '@/components/cmhub/NotionMigrateModal'
import AiQuickAddModal from '@/components/cmhub/AiQuickAddModal'
import NotificationBell from '@/components/cmhub/NotificationBell'

// ─── Estructura de navegación ────────────────────────────────────────────────
// 5 grupos semánticos para flujo de agencia SMMA:
//   GESTIÓN     → visión global + clientes
//   EQUIPO      → comunicación interna
//   RRSS        → pipeline editorial (crear → publicar → medir)
//   PRODUCCIÓN  → operaciones diarias del equipo
//   🎲 SALA     → gamificación y recompensas del equipo
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
  const { brands, syncing, renameTeamMember, team, viewAs, setViewAs } = useHub()

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
      label: 'GESTIÓN',
      items: [
        { href: BASE,                     label: 'Dashboard',   Icon: LayoutDashboard },
        { href: `${BASE}/clientes`,       label: 'Clientes',    Icon: Building2       },
        { href: miSemanaHref,             label: 'Mis pendientes', Icon: CalendarDays },
      ],
    },
    {
      label: 'EQUIPO',
      items: [
        { href: `${BASE}/supervision`,        label: 'Supervisión',  Icon: ShieldCheck   },
        { href: `${BASE}/sala`,               label: 'La Sala',      Icon: MessageSquare },
        { href: `${BASE}/equipo/diseno`,      label: 'Diseño',       Icon: Palette       },
        { href: `${BASE}/equipo/audiovisual`, label: 'Audiovisual',  Icon: Video         },
        { href: `${BASE}/equipo/estrategia`,  label: 'Estrategia',   Icon: Target        },
      ],
    },
    {
      label: 'RRSS',
      items: [
        { href: `${BASE}/calendario`,     label: 'Calendario',     Icon: Calendar     },
        { href: `${BASE}/semana`,         label: 'Semana',         Icon: CalendarDays },
        { href: `${BASE}/kanban`,         label: 'Kanban',         Icon: Columns3     },
        { href: `${BASE}/metricas`,       label: 'Analytics',      Icon: BarChart2    },
      ],
    },
    {
      label: 'PRODUCCIÓN',
      items: [
        { href: `${BASE}/tareas-diarias`, label: 'Tareas diarias', Icon: CheckSquare  },
        { href: `${BASE}/actividades`,    label: 'Actividades',    Icon: Clock        },
        { href: `${BASE}/proyectos`,      label: 'Proyectos',      Icon: FolderKanban },
      ],
    },
    {
      label: 'SALA',
      gam: true,
      items: [
        { href: `${BASE}/slot-machine`,   label: 'Slot Machine',   Icon: Dice5         },
        { href: `${BASE}/ruleta`,         label: 'Ruleta Semanal', Icon: Shuffle       },
        { href: `${BASE}/tienda`,         label: 'Tienda',         Icon: ShoppingBag   },
      ],
    },
  ]
  const [showBrandModal, setShowBrandModal]       = useState(false)
  const [showNotionMigrate, setShowNotionMigrate] = useState(false)
  const [showAiQuickAdd, setShowAiQuickAdd] = useState(false)
  const [renameResult, setRenameResult]           = useState<{ updated: number } | null>(null)
  const [showViewAs, setShowViewAs]               = useState(false)

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

  async function handleFixAnghelaMendoza() {
    const result = await renameTeamMember('Anghela Mendoza', 'Anghela Mendoza Villalobos')
    setRenameResult(result)
    setTimeout(() => setRenameResult(null), 6000)
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
    gamLabel:   '#818cf8',
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
    gamLabel:   '#7c3aed',
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
        className="hub-sidebar w-56 flex flex-col shrink-0 h-full rounded-[28px] shadow-sm overflow-hidden transition-colors duration-200"
        style={{
          background:  T.nav,
          borderRight: `1px solid ${T.navBorder}`,
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
          <div className="flex items-center gap-2">
            {/* Logo */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white text-[12px] font-bold">CM</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold leading-none" style={{ color: T.textHead }}>CM Hub</div>
              <div className="text-[10px] mt-0.5" style={{ color: T.textSub }}>Gestión de contenidos</div>
            </div>
            {/* Acciones */}
            <div className="flex items-center gap-0.5">
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
              {/* Importar desde Notion */}
              <button
                onClick={() => setShowNotionMigrate(true)}
                title="Importar contenidos desde Notion a Firebase"
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: T.text }}
              >
                <Download size={12} />
              </button>
              {/* Fix nombre Anghela Mendoza (una sola vez) */}
              <button
                onClick={handleFixAnghelaMendoza}
                disabled={syncing}
                title="Actualizar nombre: Anghela Mendoza → Anghela Mendoza Villalobos"
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                style={{ color: syncing ? '#f59e0b' : T.text }}
              >
                <UserCheck size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Navegación ─────────────────────────────────────────────────── */}
        {/* Toast resultado rename */}
        {renameResult && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-xl text-[11px] font-semibold"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
            <Check size={11} className="inline mr-1" />{renameResult.updated} docs actualizados (Anghela)
          </div>
        )}

        <div className="px-3 py-2 flex flex-col gap-1 shrink-0 overflow-y-auto"
          style={{ maxHeight: 'calc(100% - 240px)' }}>
          {NAV_GROUPS.map(({ label, items, ...rest }) => {
            const gam = (rest as { gam?: boolean }).gam
            const collapsible = label !== 'GESTIÓN'
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
                <span className="text-[9px] font-bold tracking-[0.1em] uppercase flex items-center gap-1"
                  style={{ color: gam ? T.gamLabel : T.groupLabel }}>
                  {gam && <Dice5 size={8} />}{label}
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
              {!isCollapsed && items.map(({ href, label: itemLabel, Icon }) => {
                const active = isActive(href)
                return (
                  <Link key={href} href={href}
                    className="flex items-center gap-2.5 px-3 py-[7px] rounded-xl text-[13px] font-medium transition-all"
                    style={{
                      background: active ? T.activeBase : 'transparent',
                      color:      active ? T.activeText : T.text,
                      fontWeight: active ? 600 : 500,
                    }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = T.hover; (e.currentTarget as HTMLElement).style.color = T.hoverText } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.text } }}
                  >
                    <Icon size={14} strokeWidth={active ? 2.5 : 1.8}
                      style={{ color: active ? (isDark ? '#818cf8' : '#7c3aed') : T.iconDef, flexShrink: 0 }} />
                    <span className="truncate">{itemLabel}</span>
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
      {showNotionMigrate && <NotionMigrateModal onClose={() => setShowNotionMigrate(false)} />}
      {showAiQuickAdd && <AiQuickAddModal onClose={() => setShowAiQuickAdd(false)} />}

      {/* ── Botón flotante: ingreso rápido con IA ───────────────────────── */}
      {!showAiQuickAdd && (
        <button
          onClick={() => setShowAiQuickAdd(true)}
          title="Ingreso rápido con IA"
          className="fixed bottom-6 right-6 z-[250] w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          <Sparkles size={20} className="text-white" />
        </button>
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
              {(['Estrategia', 'Diseño', 'Audiovisual', 'Otro'] as const).map(cat => {
                const members = team.filter(m => (m.category ?? 'Otro') === cat)
                if (!members.length) return null
                const catColors: Record<string, string> = { Diseño: '#ec4899', Audiovisual: '#f97316', Estrategia: '#6366f1', Otro: '#64748b' }
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
