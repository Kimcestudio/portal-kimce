import type { Content } from './types'

// Diseño/Audiovisual: lo que les importa es cuándo deben *entregar* la pieza.
// Estrategia (y el resto): lo que les importa es cuándo *se publica* —
// la entrega ya pasó por producción, lo relevante es la fecha en el calendario del cliente.
export function getContentRelevantDate(c: Pick<Content, 'date' | 'dueDate'>, isCreativo: boolean): string | null {
  return isCreativo ? c.dueDate ?? c.date ?? null : c.date ?? c.dueDate ?? null
}
