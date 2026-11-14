const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
// Explicit allowlist: internal notes, resources, IDs of users, estimates and blockers never leave this endpoint.
function publicTask(id, t, legacy = false) {
  return {
    id, nombre: String(legacy ? t.nombre || '' : t.title || ''),
    fechaInicio: String(legacy ? t.fechaInicio || '' : t.startDate || t.dueDate || ''),
    fechaFin: String(legacy ? t.fechaFin || '' : t.dueDate || ''),
    estado: ['pendiente', 'en_curso', 'completado'].includes(legacy ? t.estado : t.status) ? (legacy ? t.estado : t.status) : 'pendiente',
    avance: Math.max(0, Math.min(100, Number(legacy ? t.avance : t.progress) || 0)),
    parentId: t.parentId || '', isGroup: !!t.isGroup, milestone: !!t.milestone,
    dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
  };
}
exports.publicTask = publicTask;
exports.publicProjectGantt = onRequest({ region: 'us-central1', cors: false, maxInstances: 10 }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const token = req.query.token;
  if (typeof token !== 'string' || !/^[a-f0-9-]{36}$/i.test(token)) return res.status(404).json({ error: 'Enlace no disponible' });
  try {
    const db = admin.firestore();
    const share = await db.collection('projectShares').doc(token).get();
    if (!share.exists) return res.status(404).json({ error: 'Enlace no disponible o revocado' });
    const snap = await db.collection('cmhub_proyectos').doc(share.data().projectId).get();
    if (!snap.exists || snap.data().archived || snap.data().shareToken !== token) return res.status(404).json({ error: 'Enlace no disponible o revocado' });
    const p = snap.data();
    const activities = await db.collection('hubActividades').where('proyectoId', '==', snap.id).get();
    const tasks = activities.docs.filter(d => !d.data().archived).map(d => publicTask(d.id, d.data()));
    if (!p.tasksMigrated) {
      const ids = new Set(tasks.map(t => t.id));
      for (const t of p.ganttTareas || []) {
        const id = `legacy_${snap.id}_${t.id}`;
        if (!ids.has(id)) tasks.push({ ...publicTask(id, t, true), parentId: t.parentId ? `legacy_${snap.id}_${t.parentId}` : '' });
      }
    }
    const brand = p.brandId ? await db.collection('cmhub_brands').doc(p.brandId).get() : null;
    return res.json({ project: { id: 'public', nombre: p.nombre, estado: p.estado, fechaInicio: p.fechaInicio || '', fechaFin: p.fechaFin || '', workingDays: p.workingDays || [], ganttTareas: tasks }, brandName: brand?.data()?.name || '', updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('publicProjectGantt failed', err.code || 'unknown');
    return res.status(503).json({ error: 'No pudimos cargar el cronograma. Inténtalo de nuevo.' });
  }
});
