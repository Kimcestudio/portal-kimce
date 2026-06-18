import type { Brand, Content, Tag, TeamMember } from './types'

export const SEED_BRANDS: Brand[] = []

export const SEED_CONTENTS: Content[] = []

export const SEED_TAGS: Tag[] = [
  { id: 'tag-campana',       label: 'Campaña',         color: '#7c3aed', bg: '#ede9fe' },
  { id: 'tag-organico',      label: 'Orgánico',         color: '#16a34a', bg: '#dcfce7' },
  { id: 'tag-lanzamiento',   label: 'Lanzamiento',      color: '#dc2626', bg: '#fee2e2' },
  { id: 'tag-educativo',     label: 'Educativo',        color: '#0369a1', bg: '#e0f2fe' },
  { id: 'tag-testimonios',   label: 'Testimonios',      color: '#9333ea', bg: '#fae8ff' },
  { id: 'tag-comunidad',     label: 'Comunidad',        color: '#0f766e', bg: '#ccfbf1' },
  { id: 'tag-venta',         label: 'Venta',            color: '#c2410c', bg: '#ffedd5' },
  { id: 'tag-engagement',    label: 'Engagement',       color: '#be185d', bg: '#fce7f3' },
  { id: 'tag-tutorial',      label: 'Tutorial',         color: '#4338ca', bg: '#e0e7ff' },
  { id: 'tag-urgente',       label: 'Urgente',          color: '#b91c1c', bg: '#fee2e2' },
]

export const SEED_TEAM: TeamMember[] = [
  { id: 'mg', initials: 'MG', name: 'María García', email: 'maria@kimcestudio.com', role: 'Admin', color: '#0f172a', clients: ['Todos'], status: 'active' },
]
