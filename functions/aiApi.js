'use strict'
const { onRequest } = require('firebase-functions/v2/https')

const OPTS = { region: 'us-central1', timeoutSeconds: 60 }
const MODEL = 'claude-haiku-4-5-20251001'

function anthropicKey() { return process.env.ANTHROPIC_API_KEY }

const QUICK_ADD_TOOL = {
  name: 'extract_content',
  description: 'Extrae los datos estructurados de una actividad o contenido a partir de una descripción en lenguaje natural escrita por un miembro del equipo de una agencia de marketing.',
  input_schema: {
    type: 'object',
    properties: {
      title:        { type: 'string', description: 'Título breve y claro de la actividad/contenido' },
      brandName:    { type: 'string', description: 'Nombre de la marca/cliente mencionado. Usa "" si no se menciona ninguna.' },
      channel:      { type: 'string', enum: ['instagram', 'facebook', 'fb_comunidad', 'tiktok', 'linkedin', 'youtube', 'whatsapp', 'blog', 'email', 'web', 'stories'] },
      format:       { type: 'string', enum: ['Reel', 'Post', 'Historia', 'Carrusel', 'Video', 'Email', 'Story', 'Short', 'Mensaje'] },
      date:         { type: 'string', description: 'Fecha de publicación en formato YYYY-MM-DD. Si se menciona un día relativo (ej. "viernes", "mañana") calcúlalo con la fecha de hoy proporcionada. "" si no se menciona.' },
      dueDate:      { type: 'string', description: 'Fecha límite de entrega en formato YYYY-MM-DD. "" si no se menciona.' },
      time:         { type: 'string', description: 'Hora en formato HH:MM 24h. "" si no se menciona.' },
      responsible:  { type: 'string', description: 'Nombre del responsable principal mencionado. "" si no se menciona.' },
      responsables: { type: 'array', items: { type: 'string' }, description: 'Todos los responsables mencionados (uno o varios)' },
      priority:     { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] },
      status:       { type: 'string', enum: ['idea', 'produccion', 'revision', 'aprobado', 'programado', 'publicado'] },
      copy:         { type: 'string', description: 'Texto/copy del contenido si se menciona. "" si no.' },
      hashtags:     { type: 'string', description: 'Hashtags si se mencionan. "" si no.' },
    },
    required: ['title', 'priority', 'status'],
  },
}

const aiQuickAdd = onRequest(OPTS, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST')
    res.set('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).send('')
    return
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (!anthropicKey()) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' }); return }

  const { text, brands, team } = req.body || {}
  if (!text || typeof text !== 'string') { res.status(400).json({ error: 'Falta "text"' }); return }

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const weekday = today.toLocaleDateString('es-PE', { weekday: 'long', timeZone: 'America/Lima' })

  const systemPrompt = [
    `Hoy es ${weekday}, ${todayStr} (zona horaria America/Lima).`,
    `Marcas/clientes existentes: ${Array.isArray(brands) && brands.length ? brands.join(', ') : '(ninguna registrada)'}`,
    `Miembros del equipo: ${Array.isArray(team) && team.length ? team.join(', ') : '(ninguno registrado)'}`,
    'Analiza el texto del usuario y extrae los datos usando la herramienta "extract_content". Usa "media" como prioridad y "idea" como estado si no se especifican explícita o implícitamente.',
  ].join('\n')

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
        tools: [QUICK_ADD_TOOL],
        tool_choice: { type: 'tool', name: 'extract_content' },
      }),
    })
    if (!r.ok) { res.status(r.status).json({ error: await r.text() }); return }
    const data = await r.json()
    const toolUse = (data.content || []).find(b => b.type === 'tool_use')
    if (!toolUse) { res.status(502).json({ error: 'La IA no devolvió datos estructurados' }); return }
    res.json({ draft: toolUse.input })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

module.exports = { aiQuickAdd }
