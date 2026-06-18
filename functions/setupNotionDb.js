/**
 * setupNotionDb.js
 * Agrega las propiedades faltantes a la base de datos de Notion.
 * Uso: NOTION_TOKEN=xxx NOTION_DB_ID=xxx node setupNotionDb.js
 */

'use strict'

const NOTION_TOKEN   = process.env.NOTION_TOKEN
const NOTION_DB_ID   = process.env.NOTION_DB_ID
const NOTION_VERSION = '2022-06-28'

if (!NOTION_TOKEN || !NOTION_DB_ID) {
  console.error('❌  Faltan variables: NOTION_TOKEN y NOTION_DB_ID son requeridas.')
  process.exit(1)
}

function notionFetch(path, method = 'GET', body) {
  return fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization:    `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type':   'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Propiedades nuevas a crear (si no existen ya)
const NEW_PROPS = {
  // Mensaje / copy alternativo
  Mensaje:              { rich_text: {} },

  // Responsable de entrega (quien hace el diseño/edición)
  Responsable_Entrega:  { rich_text: {} },

  // Equipo completo asignado al contenido
  Equipo:               { multi_select: { options: [] } },

  // Links de publicación por canal
  Link_IG:              { url: {} },
  Link_FB:              { url: {} },
  Link_TT:              { url: {} },
  Link_LI:              { url: {} },
  Link_WA:              { url: {} },
}

// Opciones que necesitan existir en multi_select "Red"
const RED_OPTIONS_NEEDED = [
  { name: 'IG',           color: 'pink'   },
  { name: 'FB',           color: 'blue'   },
  { name: 'FB Comunidad', color: 'purple' },
  { name: 'Tik Tok',      color: 'gray'   },
  { name: 'Linkedin',     color: 'blue'   },
  { name: 'Whatsapp',     color: 'green'  },
  { name: 'Correo',       color: 'orange' },
  { name: 'YouTube',      color: 'red'    },
  { name: 'Blog',         color: 'yellow' },
  { name: 'Web',          color: 'gray'   },
  { name: 'Stories',      color: 'purple' },
]

// Opciones para Estado_CM (simplificado)
const ESTADO_OPTIONS_NEEDED = [
  { name: 'idea',       color: 'gray'   },
  { name: 'produccion', color: 'blue'   },
  { name: 'revision',   color: 'yellow' },
  { name: 'aprobado',   color: 'green'  },
  { name: 'programado', color: 'purple' },
  { name: 'publicado',  color: 'orange' },
]

// Opciones para Formato
const FORMATO_OPTIONS_NEEDED = [
  { name: 'Reel',      color: 'pink'   },
  { name: 'Post',      color: 'blue'   },
  { name: 'Historia',  color: 'purple' },
  { name: 'Carrusel',  color: 'orange' },
  { name: 'Video',     color: 'red'    },
  { name: 'Email',     color: 'gray'   },
  { name: 'Story',     color: 'pink'   },
  { name: 'Short',     color: 'green'  },
  { name: 'Mensaje',   color: 'yellow' },
]

async function main() {
  console.log('🔍  Leyendo esquema actual de la base de datos…')
  const dbRes = await notionFetch(`/databases/${NOTION_DB_ID}`)
  if (!dbRes.ok) {
    const err = await dbRes.json()
    console.error('❌  Error leyendo DB:', JSON.stringify(err, null, 2))
    process.exit(1)
  }
  const db = await dbRes.json()
  const existingProps = db.properties ?? {}
  const existingNames = new Set(Object.keys(existingProps))

  console.log(`✅  Propiedades actuales (${existingNames.size}):`, [...existingNames].join(', '))

  // 1. Agregar propiedades nuevas que no existen
  const propsToCreate = {}
  for (const [name, definition] of Object.entries(NEW_PROPS)) {
    if (existingNames.has(name)) {
      console.log(`   ↳ "${name}" ya existe, se omite.`)
    } else {
      propsToCreate[name] = definition
      console.log(`   ➕ "${name}" será creada.`)
    }
  }

  // 2. Actualizar opciones de "Red" multi_select
  const redProp = existingProps.Red ?? existingProps.red
  const existingRedOptions = redProp?.multi_select?.options ?? []
  const existingRedNames   = new Set(existingRedOptions.map(o => o.name))
  const newRedOptions = RED_OPTIONS_NEEDED.filter(o => !existingRedNames.has(o.name))

  // 3. Actualizar opciones de "Estado_CM"
  const estadoProp = existingProps.Estado_CM
  const existingEstadoOptions = estadoProp?.select?.options ?? estadoProp?.multi_select?.options ?? []
  const existingEstadoNames   = new Set(existingEstadoOptions.map(o => o.name))
  const newEstadoOptions = ESTADO_OPTIONS_NEEDED.filter(o => !existingEstadoNames.has(o.name))

  // 4. Actualizar opciones de "Formato"
  const formatoProp = existingProps.Formato
  const existingFormatoOptions = formatoProp?.multi_select?.options ?? []
  const existingFormatoNames   = new Set(existingFormatoOptions.map(o => o.name))
  const newFormatoOptions = FORMATO_OPTIONS_NEEDED.filter(o => !existingFormatoNames.has(o.name))

  // Construir el patch
  const patchProps = { ...propsToCreate }

  if (newRedOptions.length > 0 && redProp) {
    console.log(`   ➕ "Red" — agregando opciones: ${newRedOptions.map(o => o.name).join(', ')}`)
    patchProps.Red = {
      multi_select: {
        options: [...existingRedOptions, ...newRedOptions],
      },
    }
  }

  if (newEstadoOptions.length > 0 && estadoProp) {
    const isSelect = estadoProp.type === 'select'
    console.log(`   ➕ "Estado_CM" — agregando opciones: ${newEstadoOptions.map(o => o.name).join(', ')}`)
    const merged = [...existingEstadoOptions, ...newEstadoOptions]
    patchProps.Estado_CM = isSelect
      ? { select: { options: merged } }
      : { multi_select: { options: merged } }
  }

  if (newFormatoOptions.length > 0 && formatoProp) {
    console.log(`   ➕ "Formato" — agregando opciones: ${newFormatoOptions.map(o => o.name).join(', ')}`)
    patchProps.Formato = {
      multi_select: {
        options: [...existingFormatoOptions, ...newFormatoOptions],
      },
    }
  }

  if (Object.keys(patchProps).length === 0) {
    console.log('\n🎉  Todo ya está configurado. No hay cambios necesarios.')
    return
  }

  console.log(`\n📝  Aplicando ${Object.keys(patchProps).length} cambio(s)…`)
  const patchRes = await notionFetch(`/databases/${NOTION_DB_ID}`, 'PATCH', {
    properties: patchProps,
  })

  if (!patchRes.ok) {
    const err = await patchRes.json()
    console.error('❌  Error actualizando DB:', JSON.stringify(err, null, 2))
    process.exit(1)
  }

  const updated = await patchRes.json()
  const updatedNames = Object.keys(updated.properties ?? {})
  console.log(`\n🎉  Base de datos actualizada con ${updatedNames.length} propiedades.`)
  console.log('\n📋  Propiedades creadas/actualizadas:')
  for (const name of Object.keys(patchProps)) {
    console.log(`   ✅  ${name}`)
  }
  console.log('\n✨  Listo. El portal y Notion están sincronizados.\n')
}

main().catch(err => {
  console.error('❌  Error inesperado:', err)
  process.exit(1)
})
