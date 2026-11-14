const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
// Gantt transitions share the same completion effects as the activity editor.
// A durable ledger makes retries harmless. Legacy imports never trigger this handler.
exports.onProjectTaskCompleted = onDocumentUpdated('hubActividades/{taskId}', async event => {
  const before = event.data.before.data(), after = event.data.after.data();
  if (!after.proyectoId || after.completionSource !== 'project-workspace' || after.isGroup || after.archived || after.status !== 'completado' || before.status === 'completado') return;
  const db = admin.firestore(), taskId = event.params.taskId;
  const ledger = db.collection('projectCompletionEvents').doc(taskId);
  const directory = await db.collection('userDirectory').get();
  const members = directory.docs.map(d => ({ id: d.id, ...d.data() }));
  const names = after.assignees || (after.assignee ? [after.assignee] : []);
  const assigneeIds = after.assigneeIds?.length ? after.assigneeIds : members.filter(m => names.includes(m.displayName)).map(m => m.id);
  const completed = event.time || new Date().toISOString();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Lima', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(completed));
  const timing = after.dueDate && day < after.dueDate ? 'early' : day === after.dueDate ? 'on_time' : 'late';
  const amount = timing === 'early' ? 35 : timing === 'on_time' ? 30 : 25;
  await db.runTransaction(async tx => {
    const [done, live] = await Promise.all([tx.get(ledger), tx.get(event.data.after.ref)]);
    if (done.exists || live.data()?.status !== 'completado') return;
    const flowRef = after.flujoId ? db.collection('hubFlujos').doc(after.flujoId) : null;
    const flowSnap = flowRef ? await tx.get(flowRef) : null;
    const pointRefs = [...new Set(assigneeIds)].map(id => db.collection('cmhub_puntos').doc(id));
    const points = await Promise.all(pointRefs.map(ref => tx.get(ref)));
    tx.set(ledger, { taskId, eventId: event.id, completedAt: completed });
    tx.update(event.data.after.ref, { completedAt: completed, deliveryTiming: timing });
    for (let i=0;i<pointRefs.length;i++) {
      const id=pointRefs[i].id;
      tx.set(pointRefs[i], { userId:id, puntos:(points[i].data()?.puntos||0)+amount, updatedAt:completed }, { merge:true });
      tx.set(db.collection('cmhub_puntos_log').doc(`project_${taskId}_${id}`), { userId:id, amount, reason:'Actividad completada', refType:'actividad', refId:taskId, createdAt:admin.firestore.FieldValue.serverTimestamp() });
    }
    if (!flowSnap?.exists) return;
    const flow=flowSnap.data(), nextIndex=Number(after.pasoIndex)+1;
    if (!Number.isInteger(nextIndex)) return;
    if (nextIndex>=flow.pasos.length) { tx.update(flowRef, {estado:'completado',pasoActual:nextIndex}); return; }
    if (flow.actividadIds?.[nextIndex]) return;
    const step=flow.pasos[nextIndex], id=`flow_${flowRef.id}_${nextIndex}`, ids=[...(flow.actividadIds||[])];
    ids[nextIndex]=id;
    tx.set(db.collection('hubActividades').doc(id), { title:step.titulo, status:'pendiente', progress:0, description:step.descripcion||'', assignees:step.assigneeNames||[], assignee:step.assigneeNames?.[0]||'', assigneeIds:members.filter(m=>(step.assigneeNames||[]).includes(m.displayName)).map(m=>m.id), dueDate:step.dueDate||'', proyectoId:after.proyectoId, flujoId:flowRef.id, pasoIndex:nextIndex, totalPasos:flow.pasos.length, flujoNombre:flow.nombre, createdAt:admin.firestore.FieldValue.serverTimestamp() });
    tx.update(flowRef,{pasoActual:nextIndex,actividadIds:ids});
  });
});
