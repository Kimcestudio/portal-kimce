import type { TeamCategory } from '@/cmhub/types'

export interface Workflow {
  pendientesLabel: string
  revisionLabel:   string
  listosLabel:     string
  pendientes:      string[]
  enRevision:      string[]
  listos:          string[]
  active:          string[]
  isCreativo:      boolean
}

export function getWorkflow(category: TeamCategory | string | null | undefined): Workflow {
  const isCreativo = category === 'Diseño' || category === 'Audiovisual'
  if (isCreativo) {
    return {
      pendientesLabel: 'En Producción',
      revisionLabel:   'En Revisión',
      listosLabel:     'Aprobados',
      pendientes: ['produccion'],
      enRevision: ['revision'],
      listos:     ['aprobado', 'programado', 'publicado', 'finalizado'],
      active:     ['produccion', 'revision'],
      isCreativo: true,
    }
  }
  return {
    pendientesLabel: 'Pendientes',
    revisionLabel:   'En Revisión',
    listosLabel:     'Publicados',
    pendientes: ['idea', 'produccion'],
    enRevision: ['revision', 'cambios'],
    listos:     ['publicado', 'finalizado'],
    active:     ['idea', 'produccion', 'revision', 'cambios', 'aprobado', 'programado'],
    isCreativo: false,
  }
}
