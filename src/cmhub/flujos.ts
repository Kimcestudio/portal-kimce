import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase/client'
import type { HubFlujo, FlujoStep } from './types'

export const COL_FLUJOS = 'hubFlujos'
const COL_ACTS = 'hubActividades'

// ── Plantillas predefinidas ────────────────────────────────────────────────
export const FLUJO_PLANTILLAS: Array<{
  id: string
  nombre: string
  descripcion: string
  pasos: Omit<FlujoStep, 'dueDate'>[]
}> = [
  {
    id: 'contenido_completo',
    nombre: 'Flujo de Contenido',
    descripcion: 'Desde la idea hasta la publicación',
    pasos: [
      {
        titulo: 'Desarrollar contenido',
        assigneeNames: [],
        category: 'Estrategia',
        descripcion: 'Redactar copy, definir estructura y concepto del contenido.',
      },
      {
        titulo: 'Diseñar piezas',
        assigneeNames: [],
        category: 'Diseño',
        descripcion: 'Crear las piezas visuales en base al contenido desarrollado.',
      },
      {
        titulo: 'Revisar y publicar',
        assigneeNames: [],
        category: 'Revisión',
        descripcion: 'Revisión final y publicación en las plataformas correspondientes.',
      },
    ],
  },
  {
    id: 'revision_interna',
    nombre: 'Revisión Interna',
    descripcion: 'Preparación y revisión antes de enviar al cliente',
    pasos: [
      {
        titulo: 'Preparar entregable',
        assigneeNames: [],
        category: 'Entrega',
        descripcion: 'Consolidar el material listo para presentar.',
      },
      {
        titulo: 'Revisión interna',
        assigneeNames: [],
        category: 'Revisión',
        descripcion: 'Revisar el entregable antes de enviarlo al cliente.',
      },
    ],
  },
  {
    id: 'custom',
    nombre: 'Flujo personalizado',
    descripcion: 'Define los pasos a tu medida',
    pasos: [
      { titulo: 'Paso 1', assigneeNames: [], category: 'Otro', descripcion: '' },
      { titulo: 'Paso 2', assigneeNames: [], category: 'Otro', descripcion: '' },
    ],
  },
]

// ── Crear un flujo nuevo y su primera actividad ────────────────────────────
export async function createFlujo(
  nombre: string,
  descripcion: string,
  pasos: FlujoStep[],
  plantillaId?: string,
  capturaUrls?: string[],
): Promise<string> {
  const actividadIds: (string | null)[] = pasos.map(() => null)

  // Crear el documento de flujo
  const flujoRef = await addDoc(collection(db, COL_FLUJOS), {
    nombre,
    descripcion: descripcion || undefined,
    plantillaId: plantillaId ?? undefined,
    capturaUrls: capturaUrls?.length ? capturaUrls : undefined,
    pasos,
    actividadIds,
    pasoActual: 0,
    estado: 'activo' as const,
    createdAt: serverTimestamp(),
  })

  // Crear la primera actividad
  const primerPaso = pasos[0]
  const actRef = await addDoc(collection(db, COL_ACTS), {
    title: primerPaso.titulo,
    status: 'pendiente',
    description: [descripcion, primerPaso.descripcion].filter(Boolean).join('\n\n') || null,
    category: primerPaso.category ?? null,
    assignee: primerPaso.assigneeNames[0] ?? null,
    assignees: primerPaso.assigneeNames.length ? primerPaso.assigneeNames : null,
    dueDate: primerPaso.dueDate ?? null,
    flujoId: flujoRef.id,
    pasoIndex: 0,
    totalPasos: pasos.length,
    flujoNombre: nombre,
    proyectoId: null,
    createdAt: serverTimestamp(),
  })

  await updateDoc(flujoRef, { actividadIds: [actRef.id, ...actividadIds.slice(1)] })

  return flujoRef.id
}

// ── Avanzar al siguiente paso cuando uno se completa ──────────────────────
// Retorna { nextId, isLast } para que el llamador pueda mostrar feedback
export async function advanceFlujo(
  flujoId: string,
  completedPasoIndex: number,
): Promise<{ nextId: string | null; isLast: boolean; nextAssigneeNames?: string[] }> {
  const snap = await getDoc(doc(db, COL_FLUJOS, flujoId))
  if (!snap.exists()) return { nextId: null, isLast: true }
  const flujo = { id: snap.id, ...snap.data() } as HubFlujo

  const nextIndex = completedPasoIndex + 1

  if (nextIndex >= flujo.pasos.length) {
    await updateDoc(doc(db, COL_FLUJOS, flujoId), { estado: 'completado', pasoActual: nextIndex })
    return { nextId: null, isLast: true, nextAssigneeNames: [] }
  }

  // Evitar crear duplicados si el paso ya fue creado
  if (flujo.actividadIds[nextIndex]) {
    return { nextId: flujo.actividadIds[nextIndex], isLast: false, nextAssigneeNames: flujo.pasos[nextIndex].assigneeNames }
  }

  const nextPaso = flujo.pasos[nextIndex]
  const actRef = await addDoc(collection(db, COL_ACTS), {
    title: nextPaso.titulo,
    status: 'pendiente',
    description: [flujo.descripcion, nextPaso.descripcion].filter(Boolean).join('\n\n') || null,
    category: nextPaso.category ?? null,
    assignee: nextPaso.assigneeNames[0] ?? null,
    assignees: nextPaso.assigneeNames.length ? nextPaso.assigneeNames : null,
    dueDate: nextPaso.dueDate ?? null,
    flujoId,
    pasoIndex: nextIndex,
    totalPasos: flujo.pasos.length,
    flujoNombre: flujo.nombre,
    proyectoId: null,
    createdAt: serverTimestamp(),
  })

  const newIds = [...flujo.actividadIds]
  newIds[nextIndex] = actRef.id
  await updateDoc(doc(db, COL_FLUJOS, flujoId), {
    pasoActual: nextIndex,
    actividadIds: newIds,
  })

  return { nextId: actRef.id, isLast: false, nextAssigneeNames: nextPaso.assigneeNames }
}
