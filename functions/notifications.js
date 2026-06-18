const admin = require('firebase-admin')
const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const logger = require('firebase-functions/logger')

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()

const PRODUCTION_CATEGORIES = ['Diseño', 'Audiovisual']

function normName(s) {
  return (s || '').trim().toLowerCase()
}

function getNames(arr, single) {
  if (Array.isArray(arr) && arr.length) return arr.filter(Boolean)
  return single ? [single] : []
}

// userDirectory es chico (equipo interno) — un full scan + match insensible a
// mayúsculas es más confiable que un query `in` exacto, porque el resto de la
// app ya guarda nombres con casing inconsistente.
async function getTeamMembersByName(names) {
  const wanted = new Set(names.map(normName))
  if (wanted.size === 0) return []
  const snap = await db.collection('userDirectory').get()
  const result = []
  snap.forEach((doc) => {
    const data = doc.data()
    if (data.active === false || data.isActive === false) return
    const name = data.displayName
    if (name && wanted.has(normName(name))) {
      result.push({ uid: doc.id, name, category: data.area || null })
    }
  })
  return result
}

async function createNotification({ userId, type, category, title, message, link, contentId, brandId, actividadId }) {
  await db.collection('notifications').add({
    userId,
    type,
    category,
    title,
    message,
    link: link || null,
    contentId: contentId || null,
    brandId: brandId || null,
    actividadId: actividadId || null,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

async function getBrandResponsibleMember(brandId) {
  if (!brandId) return null
  const brandSnap = await db.collection('cmhub_brands').doc(brandId).get()
  if (!brandSnap.exists) return null
  const responsibleName = brandSnap.data().responsible
  if (!responsibleName) return null
  const [member] = await getTeamMembersByName([responsibleName])
  return member || null
}

exports.onContentWritten = onDocumentWritten('cmhub_contents/{contentId}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null
  const after = event.data.after.exists ? event.data.after.data() : null
  if (!after) return // documento eliminado, nada que notificar

  const contentId = event.params.contentId
  const prevStatus = before ? before.status : null
  const newStatus = after.status
  if (prevStatus === newStatus) return // solo transiciones de estado, nunca ediciones de campos

  const responsables = getNames(after.responsables, after.responsible)
  const link = after.brandId ? `/admin/contenidos/clientes/${after.brandId}` : '/admin/contenidos/calendario'

  try {
    // Diseño / Audiovisual: nuevo contenido para producción
    if (newStatus === 'produccion' && responsables.length) {
      const members = (await getTeamMembersByName(responsables)).filter((m) =>
        PRODUCTION_CATEGORIES.includes(m.category),
      )
      for (const m of members) {
        await createNotification({
          userId: m.uid,
          type: 'content_new_production',
          category: m.category,
          title: 'Nuevo contenido para producción',
          message: `"${after.title}" pasó a producción y está asignado a ti.`,
          link,
          contentId,
          brandId: after.brandId,
        })
      }
    }

    // Diseño / Audiovisual: se pidieron cambios (regresó de aprobado a revisión)
    if (newStatus === 'revision' && prevStatus === 'aprobado' && responsables.length) {
      const members = (await getTeamMembersByName(responsables)).filter((m) =>
        PRODUCTION_CATEGORIES.includes(m.category),
      )
      for (const m of members) {
        await createNotification({
          userId: m.uid,
          type: 'content_changes_requested',
          category: m.category,
          title: 'Se solicitaron cambios',
          message: `"${after.title}" necesita ajustes antes de aprobarse.`,
          link,
          contentId,
          brandId: after.brandId,
        })
      }
    }

    // Estrategia: contenido del cliente entra a revisión
    if (newStatus === 'revision') {
      const member = await getBrandResponsibleMember(after.brandId)
      if (member) {
        await createNotification({
          userId: member.uid,
          type: 'content_in_review',
          category: 'Estrategia',
          title: 'Contenido en revisión',
          message: `"${after.title}" está listo para tu revisión.`,
          link,
          contentId,
          brandId: after.brandId,
        })
      }
    }

    // Estrategia: contenido aprobado = listo para publicar
    if (newStatus === 'aprobado') {
      const member = await getBrandResponsibleMember(after.brandId)
      if (member) {
        await createNotification({
          userId: member.uid,
          type: 'content_ready_to_publish',
          category: 'Estrategia',
          title: 'Listo para publicar',
          message: `"${after.title}" fue aprobado y está listo para programarse.`,
          link,
          contentId,
          brandId: after.brandId,
        })
      }
    }
  } catch (error) {
    logger.error('[notifications] onContentWritten error', { contentId, error: String(error) })
  }
})

exports.onActividadWritten = onDocumentWritten('hubActividades/{actividadId}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null
  const after = event.data.after.exists ? event.data.after.data() : null
  if (!after) return

  const actividadId = event.params.actividadId
  const prevAssignees = new Set(getNames(before?.assignees, before?.assignee).map(normName))
  const newAssignees = getNames(after.assignees, after.assignee)
  const addedNames = newAssignees.filter((n) => !prevAssignees.has(normName(n)))
  if (addedNames.length === 0) return

  try {
    const members = await getTeamMembersByName(addedNames)
    for (const m of members) {
      await createNotification({
        userId: m.uid,
        type: 'activity_new',
        category: 'Actividad',
        title: 'Nueva actividad asignada',
        message: `"${after.title}" te fue asignada.`,
        link: '/admin/contenidos/actividades',
        actividadId,
      })
    }
  } catch (error) {
    logger.error('[notifications] onActividadWritten error', { actividadId, error: String(error) })
  }
})
