export const NETWORK_META: Record<string, { label: string; emoji: string; bg: string; text: string; dot: string }> = {
  instagram:    { label: 'Instagram',    emoji: '📷', bg: '#fce7f3', text: '#be185d', dot: '#e1306c' },
  tiktok:       { label: 'TikTok',       emoji: '♪',  bg: '#f3f4f6', text: '#111827', dot: '#010101' },
  facebook:     { label: 'Facebook',     emoji: 'f',  bg: '#dbeafe', text: '#1e40af', dot: '#1877f2' },
  fb_comunidad: { label: 'FB Comunidad', emoji: '👥', bg: '#e0f0ff', text: '#1a56db', dot: '#1877f2' },
  linkedin:     { label: 'LinkedIn',     emoji: 'in', bg: '#dbeafe', text: '#0a66c2', dot: '#0a66c2' },
  youtube:      { label: 'YouTube',      emoji: '▶',  bg: '#fee2e2', text: '#b91c1c', dot: '#ff0000' },
  whatsapp:     { label: 'WhatsApp',     emoji: '💬', bg: '#dcfce7', text: '#166534', dot: '#25d366' },
  blog:         { label: 'Blog',         emoji: '📝', bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  email:        { label: 'Email',        emoji: '✉',  bg: '#ede9fe', text: '#5b21b6', dot: '#7c3aed' },
  web:          { label: 'Web',          emoji: '🌐', bg: '#f3f4f6', text: '#374151', dot: '#6b7280' },
  stories:      { label: 'Stories',      emoji: '⭕', bg: '#fae8ff', text: '#7e22ce', dot: '#a855f7' },
}

// Dark mode: fondo oscuro del color + texto versión clara
export const NETWORK_META_DARK: Record<string, { label: string; emoji: string; bg: string; text: string; dot: string }> = {
  instagram:    { label: 'Instagram',    emoji: '📷', bg: 'rgba(225,48,108,0.18)',  text: '#f9a8d4', dot: '#e1306c' },
  tiktok:       { label: 'TikTok',       emoji: '♪',  bg: 'rgba(255,255,255,0.10)', text: '#f1f5f9', dot: '#ffffff' },
  facebook:     { label: 'Facebook',     emoji: 'f',  bg: 'rgba(24,119,242,0.18)',  text: '#93c5fd', dot: '#1877f2' },
  fb_comunidad: { label: 'FB Comunidad', emoji: '👥', bg: 'rgba(24,119,242,0.18)',  text: '#93c5fd', dot: '#1877f2' },
  linkedin:     { label: 'LinkedIn',     emoji: 'in', bg: 'rgba(10,102,194,0.18)',  text: '#93c5fd', dot: '#0a66c2' },
  youtube:      { label: 'YouTube',      emoji: '▶',  bg: 'rgba(255,0,0,0.18)',     text: '#fca5a5', dot: '#ff0000' },
  whatsapp:     { label: 'WhatsApp',     emoji: '💬', bg: 'rgba(37,211,102,0.18)',  text: '#86efac', dot: '#25d366' },
  blog:         { label: 'Blog',         emoji: '📝', bg: 'rgba(245,158,11,0.18)',  text: '#fcd34d', dot: '#f59e0b' },
  email:        { label: 'Email',        emoji: '✉',  bg: 'rgba(124,58,237,0.18)',  text: '#c4b5fd', dot: '#7c3aed' },
  web:          { label: 'Web',          emoji: '🌐', bg: 'rgba(107,114,128,0.15)', text: '#d1d5db', dot: '#6b7280' },
  stories:      { label: 'Stories',      emoji: '⭕', bg: 'rgba(168,85,247,0.18)',  text: '#d8b4fe', dot: '#a855f7' },
}

export const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  idea:        { label: 'Idea',          bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  produccion:  { label: 'En producción', bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
  revision:    { label: 'En revisión',   bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  aprobado:    { label: 'Aprobado',      bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  programado:  { label: 'Programado',    bg: '#f0fdf4', text: '#14532d', dot: '#16a34a' },
  publicado:   { label: 'Publicado',     bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  // legacy
  redaccion:   { label: 'En producción', bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
  diseno:      { label: 'En producción', bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
  audiovisual: { label: 'En producción', bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
  enviado:     { label: 'En revisión',   bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  cambios:     { label: 'En revisión',   bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  finalizado:  { label: 'Aprobado',      bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  reportado:   { label: 'Publicado',     bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  proceso:     { label: 'En producción', bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
}

// Dark mode: fondo oscuro del color + texto versión clara
export const STATUS_META_DARK: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  idea:        { label: 'Idea',          bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1', dot: '#94a3b8' },
  produccion:  { label: 'En producción', bg: 'rgba(59,130,246,0.18)',  text: '#93c5fd', dot: '#3b82f6' },
  revision:    { label: 'En revisión',   bg: 'rgba(245,158,11,0.18)',  text: '#fcd34d', dot: '#f59e0b' },
  aprobado:    { label: 'Aprobado',      bg: 'rgba(16,185,129,0.18)',  text: '#6ee7b7', dot: '#10b981' },
  programado:  { label: 'Programado',    bg: 'rgba(34,197,94,0.18)',   text: '#86efac', dot: '#22c55e' },
  publicado:   { label: 'Publicado',     bg: 'rgba(139,92,246,0.18)',  text: '#c4b5fd', dot: '#8b5cf6' },
  // legacy
  redaccion:   { label: 'En producción', bg: 'rgba(59,130,246,0.18)',  text: '#93c5fd', dot: '#3b82f6' },
  diseno:      { label: 'En producción', bg: 'rgba(59,130,246,0.18)',  text: '#93c5fd', dot: '#3b82f6' },
  audiovisual: { label: 'En producción', bg: 'rgba(59,130,246,0.18)',  text: '#93c5fd', dot: '#3b82f6' },
  enviado:     { label: 'En revisión',   bg: 'rgba(245,158,11,0.18)',  text: '#fcd34d', dot: '#f59e0b' },
  cambios:     { label: 'En revisión',   bg: 'rgba(245,158,11,0.18)',  text: '#fcd34d', dot: '#f59e0b' },
  finalizado:  { label: 'Aprobado',      bg: 'rgba(16,185,129,0.18)',  text: '#6ee7b7', dot: '#10b981' },
  reportado:   { label: 'Publicado',     bg: 'rgba(139,92,246,0.18)',  text: '#c4b5fd', dot: '#8b5cf6' },
  proceso:     { label: 'En producción', bg: 'rgba(59,130,246,0.18)',  text: '#93c5fd', dot: '#3b82f6' },
}

export const PRIORITY_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  baja:    { label: 'Baja',    bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  media:   { label: 'Media',   bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  alta:    { label: 'Alta',    bg: '#ffedd5', text: '#c2410c', dot: '#f97316' },
  urgente: { label: 'Urgente', bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
}

// Dark mode: fondo oscuro del color + texto versión clara
export const PRIORITY_META_DARK: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  baja:    { label: 'Baja',    bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1', dot: '#94a3b8' },
  media:   { label: 'Media',   bg: 'rgba(245,158,11,0.18)',  text: '#fcd34d', dot: '#f59e0b' },
  alta:    { label: 'Alta',    bg: 'rgba(249,115,22,0.18)',  text: '#fdba74', dot: '#f97316' },
  urgente: { label: 'Urgente', bg: 'rgba(239,68,68,0.18)',   text: '#fca5a5', dot: '#ef4444' },
}

export const PROYECTO_ESTADO_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  activo:     { label: 'Activo',     bg: '#dcfce7', text: '#16a34a', dot: '#22c55e' },
  pausado:    { label: 'Pausado',    bg: '#fef3c7', text: '#d97706', dot: '#f59e0b' },
  completado: { label: 'Completado', bg: '#ede9fe', text: '#6d28d9', dot: '#7c3aed' },
}

export const PROYECTO_ESTADO_META_DARK: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  activo:     { label: 'Activo',     bg: 'rgba(34,197,94,0.18)',  text: '#86efac', dot: '#22c55e' },
  pausado:    { label: 'Pausado',    bg: 'rgba(245,158,11,0.18)', text: '#fcd34d', dot: '#f59e0b' },
  completado: { label: 'Completado', bg: 'rgba(124,58,237,0.18)', text: '#c4b5fd', dot: '#7c3aed' },
}

export const ALL_NETWORKS = [
  'instagram', 'facebook', 'fb_comunidad', 'tiktok', 'linkedin',
  'youtube', 'whatsapp', 'blog', 'email', 'web', 'stories',
] as const

export const ALL_FORMATS = [
  'Reel', 'Post', 'Historia', 'Carrusel', 'Video', 'Email', 'Story', 'Short',
] as const

export const ALL_STATUSES = [
  'idea', 'produccion', 'revision', 'aprobado', 'programado', 'publicado',
] as const

export const PRODUCTION_STATUSES     = ['idea', 'produccion', 'revision'] as const
export const READY_TO_PUBLISH_STATUSES = ['aprobado', 'programado'] as const
export const PUBLISHED_STATUSES       = ['publicado'] as const

export const TEAM_LIST = [
  { id: 'mg', initials: 'MG', name: 'María García', color: '#0f172a' },
  { id: 'cl', initials: 'CL', name: 'Carlos López', color: '#3b82f6' },
  { id: 'at', initials: 'AT', name: 'Ana Torres',   color: '#8b5cf6' },
  { id: 'pr', initials: 'PR', name: 'Pedro Ruiz',   color: '#64748b' },
  { id: 'lm', initials: 'LM', name: 'Laura Méndez', color: '#f59e0b' },
]
