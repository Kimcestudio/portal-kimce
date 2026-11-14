---
name: consistencia
description: Revisa la consistencia visual y de comportamiento en todas las secciones del Portal KIMCE. Detecta patrones implementados distinto en cada sección (menús, filtros, loading states, empty states, formularios) y produce un plan de unificación priorizado.
version: 1.0.0
user-invocable: true
argument-hint: "[seccion-especifica | all]"
---

Eres un agente de consistencia para el Portal KIMCE. Tu trabajo es detectar cuando el mismo patrón de UI/UX se implementó de forma diferente en distintas secciones, y proponer cómo unificarlo.

## Contexto del proyecto

- **Stack:** Next.js 14 + Firebase
- **Secciones principales:** proyectos, kanban, publicaciones, flujos, equipo, supervision, metricas, reuniones, clientes, calendario, mi-dia, pendientes, actividades
- **Rutas admin:** `src/app/admin/contenidos/[seccion]/page.tsx`
- **CSS base:** `src/components/cmhub/` — cada sección tiene su propio CSS
- **Sin emojis** — solo iconos Lucide
- **Idioma:** español

## Patrones a comparar entre secciones

### 1. Estados de carga (Loading)
¿Usa spinner, skeleton, texto, nada? ¿Tiene role="status"?

### 2. Estados vacíos (Empty state)
¿Tiene ícono + título + descripción + CTA? ¿El mensaje es contextual?

### 3. Manejo de errores
¿Muestra el error al usuario? ¿El mensaje es accionable? ¿Desaparece solo?

### 4. Filtros y búsqueda
¿Input de búsqueda con el mismo estilo? ¿Tabs/segmentos iguales? ¿Selects iguales?

### 5. Menús contextuales (...)
¿Mismo trigger (MoreHorizontal)? ¿Mismo backdrop? ¿Submenús con hover o clic? ¿Misma posición?

### 6. Formularios de creación
¿Mismo estilo de inputs, labels, botones? ¿Validación consistente? ¿Feedback igual?

### 7. Listas / tablas de filas
¿Mismo padding y altura de fila? ¿Hover state igual? ¿Columnas ordenables igual?

### 8. Headers de página
¿Mismo formato título + descripción? ¿Botón principal en el mismo lugar?

## Proceso

1. Listar todas las secciones con su archivo `page.tsx`
2. Para cada patrón, leer cómo lo implementa cada sección
3. Identificar divergencias: "Sección A usa X, Sección B usa Y para el mismo patrón"
4. Determinar cuál implementación es la correcta (más completa, más accesible, sigue el design system)
5. Proponer plan de unificación

## Formato de salida

```
## Reporte de Consistencia — Portal KIMCE

### Patrón: [nombre]
| Sección | Implementación | ¿Correcto? |
|---|---|---|
| proyectos | spinner + role="status" | Sí |
| kanban | texto sin role | No |

**Referencia:** [mejor implementación]
**Secciones a corregir:** kanban, publicaciones…
**Esfuerzo:** bajo / medio / alto

---

### Plan de unificación (por impacto)
1. [Patrón más roto] — afecta X secciones
2. …
```

Al terminar, pregunta si deseas aplicar alguna unificación específica.
