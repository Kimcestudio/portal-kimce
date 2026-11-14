// ── Hub Design Tokens ─────────────────────────────────────────────────────────
// Única fuente de verdad para colores, superficies y constantes visuales del
// hub. Componentes que usan style inline deben llamar hubT(isDark) en lugar de
// definir su propio objeto T local.
//
// NO contiene tokens del sistema público (tailwind.config.ts) ni del Liquid
// Glass del calendario compartido (globals.css / DESIGN.md).

// ── Acentos ───────────────────────────────────────────────────────────────────

/** Acento del hub (botones, toggles, estado activo). No es el azul de KIMCE. */
export const HUB_ACCENT   = '#7c3aed'

/** Azul corporativo KIMCE — logo, identidad de marca. Nunca reemplaza HUB_ACCENT. */
export const KIMCE_BRAND  = '#0844ef'

// ── Paleta semántica ──────────────────────────────────────────────────────────
// Solo valores de texto/icono. Para fondos de chips usar SEMANTIC_BG.

export const C = {
  accent:  '#7c3aed',
  success: '#16a34a',
  warning: '#d97706',
  error:   '#ef4444',
  info:    '#2563eb',
  teal:    '#0891b2',
} as const

export type SemanticColor = keyof typeof C

// ── Fondos semánticos (chips, badges) ─────────────────────────────────────────

export const SEMANTIC_BG = {
  accent:  { bg: '#ede9fe', bgDark: 'rgba(124,58,237,0.15)', text: '#7c3aed', textDark: '#c4b5fd' },
  success: { bg: '#dcfce7', bgDark: 'rgba(22,163,74,0.15)',  text: '#16a34a', textDark: '#86efac' },
  warning: { bg: '#fef3c7', bgDark: 'rgba(217,119,6,0.15)',  text: '#d97706', textDark: '#fcd34d' },
  error:   { bg: '#fee2e2', bgDark: 'rgba(239,68,68,0.15)',  text: '#ef4444', textDark: '#fca5a5' },
  info:    { bg: '#dbeafe', bgDark: 'rgba(37,99,235,0.15)',  text: '#2563eb', textDark: '#93c5fd' },
} as const

/** Devuelve bg y text del semantic badge para el tema activo. */
export function semanticBg(key: keyof typeof SEMANTIC_BG, isDark: boolean) {
  const t = SEMANTIC_BG[key]
  return { background: isDark ? t.bgDark : t.bg, color: isDark ? t.textDark : t.text }
}

// ── Superficies del hub ───────────────────────────────────────────────────────

export interface HubTokens {
  page:        string
  card:        string
  card2:       string
  border:      string
  text:        string
  sub:         string
  subtle:      string
  muted:       string
  hover:       string
  barBg:       string
  input:       string
  inputBorder: string
  divider:     string
}

const LIGHT: HubTokens = {
  page:        '#f8fafc',
  card:        '#ffffff',
  card2:       '#f9fafb',
  border:      '#e5e7eb',
  text:        '#111827',
  sub:         '#6b7280',
  subtle:      '#f9fafb',
  muted:       '#d1d5db',
  hover:       '#f5f6f8',
  barBg:       '#e9ecef',
  input:       '#ffffff',
  inputBorder: '#d1d5db',
  divider:     '#f3f4f6',
}

const DARK: HubTokens = {
  page:        '#0d0f12',
  card:        '#161820',
  card2:       '#1a1d27',
  border:      'rgba(255,255,255,0.07)',
  text:        '#f1f5f9',
  sub:         '#94a3b8',
  subtle:      'rgba(255,255,255,0.03)',
  muted:       'rgba(255,255,255,0.15)',
  hover:       'rgba(255,255,255,0.04)',
  barBg:       'rgba(255,255,255,0.08)',
  input:       '#1e2028',
  inputBorder: 'rgba(255,255,255,0.10)',
  divider:     'rgba(255,255,255,0.05)',
}

/**
 * Devuelve el mapa de tokens de superficie para el tema activo.
 * Reemplaza el patrón `const T = isDark ? { ... } : { ... }` local.
 */
export function hubT(isDark: boolean): HubTokens {
  return isDark ? DARK : LIGHT
}

// ── Avatares ──────────────────────────────────────────────────────────────────

export const AVATAR_PALETTE = [
  '#7c3aed', '#2563eb', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#9333ea',
] as const

/** Color de avatar determinista a partir del nombre. */
export function avatarAccent(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

/** Iniciales de un nombre (1 o 2 palabras → 2 letras). */
export function nameInitials(name: string): string {
  const w = name.trim().split(/\s+/)
  return w.length >= 2
    ? (w[0][0] + w[w.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}
