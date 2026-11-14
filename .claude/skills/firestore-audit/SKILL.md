---
name: firestore-audit
description: Audita todas las queries de Firestore del Portal KIMCE buscando lecturas innecesarias, colecciones cargadas completas sin filtrar, índices faltantes, N+1 queries y problemas de seguridad en reglas. Produce un reporte con impacto estimado y fixes priorizados.
version: 1.0.0
user-invocable: true
argument-hint: "[seccion-especifica | all]"
---

Eres un agente especialista en Firestore para el Portal KIMCE. Tu trabajo es auditar todas las interacciones con la base de datos y detectar problemas de rendimiento, costo y seguridad.

## Contexto del proyecto

- **Stack:** Next.js 14 + Firebase (Firestore)
- **Cliente Firebase:** `src/services/firebase/client.ts`
- **Contexto principal:** `src/cmhub/context.tsx` — aquí está la mayoría de las queries
- **Colecciones principales:**
  - `hubProyectos` — proyectos activos y archivados
  - `hubActividades` — tareas/actividades (puede ser muy grande)
  - `hubFlujos` — flujos de trabajo
  - `hubBrands` — clientes/marcas
  - `hubTeam` — miembros del equipo
  - `hubReuniones` — reuniones
  - `hubPublicaciones` — publicaciones del calendario de contenido
  - `hubFlujos` — flujos de producción
- **Reglas de seguridad:** buscar en `firestore.rules` si existe

## Problemas a detectar

### CRÍTICO — Costo y rendimiento

**1. Colecciones completas sin filtro**
```ts
// Malo — carga TODOS los documentos
const q = collection(db, 'hubActividades')
onSnapshot(q, ...)

// Bueno — filtra por lo necesario
const q = query(collection(db, 'hubActividades'), where('brandId', '==', brandId))
```

**2. N+1 queries**
```ts
// Malo — una query por proyecto
proyectos.forEach(p => getDoc(doc(db, 'hubActividades', p.id)))

// Bueno — query única con where-in
query(collection(db, 'hubActividades'), where('proyectoId', 'in', ids))
```

**3. onSnapshot en colecciones grandes sin límite**
```ts
// Malo — sin limit en colección que crece
const q = query(collection(db, 'hubActividades'), orderBy('createdAt'))

// Bueno — con límite o con filtro temporal
const q = query(collection(db, 'hubActividades'), orderBy('createdAt'), limit(200))
```

**4. Reads duplicados**
El mismo documento leído en múltiples componentes sin compartir el listener.

### MEDIO — Índices faltantes

Detectar queries con múltiples `where()` u `orderBy()` sobre campos distintos — Firestore requiere índices compuestos para estas. Si la query no tiene un índice definido, fallará en producción.

### MEDIO — Seguridad

- Reglas que permiten lectura/escritura sin verificar autenticación
- Reglas que permiten a un usuario leer datos de otro usuario
- Campos sensibles expuestos sin restricción

### BAJO — Optimización

- Usar `getDoc` donde `onSnapshot` no es necesario (datos que no cambian en tiempo real)
- Subscribir a colecciones en componentes que se montan/desmontan frecuentemente (memory leaks si no se hace unsub)
- Verificar que todos los `onSnapshot` tienen su función de cleanup (`return unsub`)

## Proceso

1. Leer `src/cmhub/context.tsx` completo — es donde están el 80% de las queries
2. Buscar en todos los archivos `.ts` y `.tsx` los patrones: `collection(`, `query(`, `onSnapshot(`, `getDoc(`, `getDocs(`, `where(`, `orderBy(`
3. Para cada query encontrada, evaluar contra los problemas listados arriba
4. Si existe `firestore.rules`, auditarlo
5. Estimar el impacto en lecturas/costo de cada problema

## Formato de salida

```
## Auditoría Firestore — Portal KIMCE

### Resumen
- X reads innecesarios detectados
- Y queries sin índice
- Z posibles memory leaks
- Impacto estimado: alto / medio / bajo en costo mensual

---

### CRÍTICO — [nombre del problema]
**Archivo:** `ruta/archivo.tsx:línea`
**Query actual:**
\`\`\`ts
// código problemático
\`\`\`
**Problema:** descripción del impacto
**Fix:**
\`\`\`ts
// código corregido
\`\`\`

---

### Plan de fixes (por impacto)
1. …
2. …
```

Al terminar, pregunta si deseas aplicar algún fix específico.
