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
  const responsables = getNames(after.responsables, after.responsible)
  // Va al calendario interno (no a la página del cliente) — ahí también se ven los
  // comentarios. El query param contentId hace que abra la ficha automáticamente
  // (ver useEffect de deep-link en calendario/page.tsx).
  const link = `/admin/contenidos/calendario?contentId=${contentId}`

  // Cambio de fecha de publicación o de entrega: notifica sin importar si tambien cambió el estado.
  if (before) {
    const dateChanged = before.date !== after.date
    const dueDateChanged = before.dueDate !== after.dueDate
    if (dateChanged || dueDateChanged) {
      try {
        // Solo atribuir el cambio si updatedBy fue actualizado en ESTA escritura específica.
        // Si before.updatedBy === after.updatedBy, el campo es residual de una edición anterior
        // (ej. drag-and-drop en calendario no pasa updatedBy) y no refleja al autor real.
        const updatedByChangedNow = before.updatedBy !== after.updatedBy
        const who = (updatedByChangedNow && after.updatedBy) ? ` (cambio hecho por ${after.updatedBy})` : ''
        const label = dateChanged ? 'fecha de publicación' : 'fecha de entrega'
        const prevValue = dateChanged ? (before.date || 'sin fecha') : (before.dueDate || 'sin fecha')
        const nextValue = dateChanged ? (after.date || 'sin fecha') : (after.dueDate || 'sin fecha')
        const message = `"${after.title}" cambió su ${label}: ${prevValue} → ${nextValue}${who}.`
        const recipients = await getTeamMembersByName(responsables)
        const brandMember = await getBrandResponsibleMember(after.brandId)
        const seen = new Set()
        for (const m of [...recipients, ...(brandMember ? [brandMember] : [])]) {
          if (seen.has(m.uid)) continue
          seen.add(m.uid)
          await createNotification({
            userId: m.uid,
            type: 'content_date_changed',
            category: m.category || 'Actividad',
            title: 'Cambio de fecha',
            message,
            link,
            contentId,
            brandId: after.brandId,
          })
        }
      } catch (error) {
        logger.error('[notifications] date change notify error', { contentId, error: String(error) })
      }
    }
  }

  const prevStatus = before ? before.status : null
  const newStatus = after.status
  if (prevStatus === newStatus) return // a partir de aqui, solo transiciones de estado

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
        // El query param actividadId hace que la página de actividades abra automáticamente
        // su detalle (ver useEffect de deep-link en actividades/page.tsx).
        link: `/admin/contenidos/actividades?actividadId=${actividadId}`,
        actividadId,
      })
    }
  } catch (error) {
    logger.error('[notifications] onActividadWritten error', { actividadId, error: String(error) })
  }
})

// Congela el estado del contenido en "revision" cuando llega un comentario nuevo (cliente o
// equipo), guardando el estado previo para poder restaurarlo despues. Si ya estaba en
// "revision" (congelado o no) no se toca nada, para no perder el previousStatus original.
async function freezeStatusForComment(contentId) {
  const contentRef = db.collection('cmhub_contents').doc(contentId)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(contentRef)
    if (!snap.exists) return
    const content = snap.data()
    if (content.status === 'revision') return
    tx.update(contentRef, { previousStatus: content.status, status: 'revision' })
  })
}

// Cuando ya no queda ningun comentario sin resolver para el contenido, restaura el estado que
// tenia antes de congelarse. Se llama tanto al resolver como al eliminar un comentario.
async function maybeRestoreStatus(contentId) {
  const contentRef = db.collection('cmhub_contents').doc(contentId)
  const contentSnap = await contentRef.get()
  if (!contentSnap.exists) return
  const content = contentSnap.data()
  if (!content.previousStatus) return // no estaba congelado por comentarios

  const commentsSnap = await db.collection('cmhub_comments').where('contentId', '==', contentId).get()
  const stillPending = commentsSnap.docs.some((d) => d.data().resolved === false)
  if (stillPending) return

  await contentRef.update({
    status: content.previousStatus,
    previousStatus: admin.firestore.FieldValue.delete(),
  })
}

// Un comentario de cliente (feedback simple o "solicitar cambios") hoy es silencioso para el
// equipo a menos que alguien entre a revisar — esto avisa a los responsables del contenido.
// Solo dispara en creación (before no existe); ediciones/resoluciones no notifican de nuevo.
exports.onCommentWritten = onDocumentWritten('cmhub_comments/{commentId}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null
  const after = event.data.after.exists ? event.data.after.data() : null
  const commentId = event.params.commentId

  try {
    if (!before && after) {
      await freezeStatusForComment(after.contentId)
    } else if (before && after && before.resolved === false && after.resolved === true) {
      await maybeRestoreStatus(after.contentId)
    } else if (before && !after) {
      await maybeRestoreStatus(before.contentId)
    }
  } catch (error) {
    logger.error('[notifications] freeze/restore status error', { commentId, error: String(error) })
  }

  if (before || !after) return
  try {
    const contentSnap = await db.collection('cmhub_contents').doc(after.contentId).get()
    if (!contentSnap.exists) return
    const content = contentSnap.data()
    const responsables = getNames(content.responsables, content.responsible)
    const members = await getTeamMembersByName(responsables)
    // Va al calendario interno — ahí se ve el contenido y su hilo de comentarios.
    const link = `/admin/contenidos/calendario?contentId=${after.contentId}`
    const snippet = after.message.length > 120 ? `${after.message.slice(0, 120)}…` : after.message

    for (const m of members) {
      await createNotification({
        userId: m.uid,
        type: 'content_comment_new',
        category: m.category || 'Actividad',
        title: 'Nuevo comentario',
        message: `${after.author} comentó en "${content.title}": "${snippet}"`,
        link,
        contentId: after.contentId,
        brandId: after.brandId,
      })
    }
  } catch (error) {
    logger.error('[notifications] onCommentWritten error', { commentId, error: String(error) })
  }
})
