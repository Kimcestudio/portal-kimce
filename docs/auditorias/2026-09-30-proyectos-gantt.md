# Auditoría de KIMCE Suite: Proyectos y Gantt

Fecha: 30 de septiembre de 2026. Alcance principal: listado de proyectos, detalle, actividades vinculadas, cronograma interno y público, persistencia y reglas de acceso. Revisión secundaria: navegación de Suite, tokens visuales y configuración de publicación. No constituye una auditoría exhaustiva de todos los módulos del portal.

## Dictamen

La separación en Resumen, Actividades, Gantt, Equipo y Notas es una base útil. Sin embargo, el Gantt todavía no es fiable como herramienta central de planificación: hay un bloqueo de serialización al crear tareas raíz, inconsistencias entre modelos de trabajo y riesgos de pérdida de cambios concurrentes. La prioridad debe ser asegurar datos y flujos, después simplificar la interfaz.

**Antipatrones: requiere revisión.** En el código aparecen tarjetas dentro de tarjetas, cuatro contadores grandes antes del trabajo y texto diminuto repetido. Son estructuras que aumentan la carga visual. No se puede emitir un veredicto sobre el acabado visual real sin entrar en la sesión autenticada.

## Evidencia y límites

- `tsc --noEmit --incremental false`: completado sin errores. No prueba funcionamiento del cronograma.
- Reproducción local con helpers extraídos del componente y SDK Firebase instalado: una tarea raíz conserva `parentId: undefined` y el SDK rechaza el objeto con `invalid-argument` antes de transmitirlo. No se escribió información en producción.
- Helpers: `2026-02-31` es aceptado como fecha válida; una tarea con inicio y fin iguales exporta duración cero.
- Fecha: el 30 de septiembre a las 20:00 en Lima se convierte en `2026-10-01` con el cálculo actual de «hoy».
- Contrastes calculados: gris `#9ca3af` sobre blanco = 2.54:1; verde `#16a34a` sobre `#dcfce7` = 3.00:1; ámbar `#d97706` sobre `#fef3c7` = 2.86:1. Son insuficientes para el texto pequeño donde se utilizan.
- Navegador local: `/admin/contenidos/proyectos` redirige a login. No se realizaron pruebas autenticadas, mediciones de rendimiento, emulación móvil ni evaluación visual con datos reales.
- Reglas y rutas revisadas son las del workspace; no se comprobó qué versión está desplegada. `out` es un artefacto previo, no una compilación nueva.
- Había numerosos cambios anteriores sin commit. No se modificó el código de aplicación. Se actualizó impeccable a v4.3.1 por autorización del usuario.

## Evaluación técnica provisional

Puntuación por inspección del código, no certificación de accesibilidad ni benchmark.

| Dimensión | Puntuación /4 | Evidencia principal |
|---|---:|---|
| Accesibilidad | 1 | Barras solo con clic, acciones ocultas, nombres accesibles ausentes, bajo contraste |
| Rendimiento | 2 | Exportación diferida; escritura de todo el arreglo por movimiento del slider y filtros repetidos |
| Responsive | 1 | Columnas fijas, grillas sin variantes y poco espacio para la línea temporal |
| Temas | 2 | Tokens existentes, pero duplicados locales y estados con contraste insuficiente |
| Antipatrones | 2 | Tarjetas anidadas, métricas repetidas y jerarquía de acciones débil |
| **Total** | **8/20** | **Necesita mejoras importantes; resultado provisional** |

## Hallazgos priorizados

19 hallazgos: 2 P0, 12 P1, 5 P2. P0 = bloquea un flujo principal; P1 = riesgo importante de datos, acceso o uso; P2 = fricción con alternativa. Las capacidades propuestas después no se cuentan como defectos existentes.

| ID | Prioridad / categoría | Ubicación | Hallazgo, impacto y corrección recomendada |
|---|---|---|---|
| 01 | P0 · Persistencia | `src/components/cmhub/GanttChart.tsx:122`, `src/cmhub/context.tsx:84` | `EMPTY_FORM` incluye `parentId` undefined para raíces. `clean` solo limpia el primer nivel y Firebase rechaza los valores anidados. Omitir campos opcionales ausentes al construir tareas y validar/serializar el árbol antes de guardar. La edición también puede reintroducir opcionales undefined. |
| 02 | P0 · Publicación | `firebase.json:19`, `src/app/admin/contenidos/proyectos/[id]/page.tsx:1`, `src/app/clientes/gantt/[proyectoId]/page.tsx:1` | Se exporta únicamente el parámetro `_`, sin rewrites específicos para detalle de proyectos ni Gantt. El acceso directo/recarga con IDs reales no queda resuelto por esta configuración. Resolver rutas públicas, admin y colaborador y probarlas sobre Hosting. Verificar también que el cliente recupera el ID real y no el placeholder del HTML exportado; añadir un rewrite por sí solo no certifica ese flujo. |
| 03 | P1 · Acceso público | `firestore.rules:163`, `firestore.rules:220` | `allow get: if true` deja leer documentos completos de marcas y proyectos conociendo su ID. Ocultar notas en React no limita el contenido descargable. Crear una proyección pública mínima del cronograma con activación/revocación explícitas; mantener privados notas, enlaces y campos internos. No se comprobó exposición en el despliegue actual. |
| 04 | P1 · Jerarquía Gantt | `src/components/cmhub/GanttChart.tsx:170`, `:532` | El botón de subtarea aparece también en hijos, pero `displayList` solo recorre raíces e hijos inmediatos. Se pueden crear nietos que no aparecen; el alta rápida de ese nivel tampoco se representa. Restringir a dos niveles explícitos o implementar recorrido recursivo, validación de padres y ciclos. |
| 05 | P1 · Integridad concurrente | `src/components/cmhub/GanttChart.tsx:163`, `src/cmhub/context.tsx:428` | Cada edición reemplaza todo `ganttTareas` desde la copia local. Dos usuarios modificando tareas distintas pueden sobrescribirse. Usar documentos por tarea o transacciones con revisión/conflicto. El slider emite una escritura por cambio; mantener borrador y confirmar al terminar el gesto. |
| 06 | P1 · Feedback de guardado | `src/cmhub/context.tsx:428`, `src/components/cmhub/GanttChart.tsx:264` | `updateProyecto` devuelve void y captura rechazos solo en consola; el formulario se cierra sin esperar confirmación. Exponer Promise y estados «Guardando», «Guardado», «Sin conexión» y «No se pudo guardar / Reintentar». Conservar borrador. Un error de serialización síncrono tampoco queda cubierto por `.catch` del Promise. |
| 07 | P1 · Modelo de trabajo | `src/cmhub/types.ts:267`, `src/components/cmhub/ProyectoModal.tsx:131`, `src/app/clientes/gantt/[proyectoId]/_GanttPublico.tsx:104` | Actividades, tareas Gantt y avance manual son fuentes separadas. El listado calcula por actividades, el Gantt por tareas y la vista pública muestra `proyecto.avance`. Un proyecto puede presentar porcentajes incompatibles. Definir una fuente de trabajo y una fórmula común; si se conservan métricas diferentes, nombrarlas explícitamente. |
| 08 | P1 · Fechas | `src/components/cmhub/GanttChart.tsx:14`, `:264` | «Hoy» usa UTC, adelantando vencimientos en Lima desde las 19:00. `saveFullForm` solo valida nombre; `min` en el input no protege el guardado imperativo ni un cambio posterior del inicio. Validar fecha calendario real y fin ≥ inicio; definir días naturales inclusivos y zona horaria de negocio. |
| 09 | P1 · Resúmenes de grupos | `src/components/cmhub/GanttChart.tsx:57`, `:213`, `:224`, `:401`, `:580` | La barra del grupo deriva avance/fechas de hijos, mientras slider, estado, vencimiento y extensión modifican/evalúan valores propios. Puede verse 100% con estado pendiente o no cambiar la barra tras extenderla. Hacer grupos calculados y definir si desplazar un grupo mueve a todos sus hijos con vista previa. |
| 10 | P1 · Borrado | `src/components/cmhub/GanttChart.tsx:228`, `src/cmhub/context.tsx:431` | El Gantt elimina tarea y sus hijos inmediatos sin confirmación ni deshacer; nietos pueden quedar huérfanos. El proyecto se elimina sin resolver las actividades vinculadas. Definir archivado/restauración y tratamiento de relaciones; mostrar alcance antes de eliminar grupos. |
| 11 | P1 · Responsive | `src/components/cmhub/GanttChart.tsx:342`, `:525`, `src/app/admin/contenidos/proyectos/page.tsx:202`, `:416` | El Gantt reserva 208px para nombre y 80px para avance; en móvil casi no queda cronograma. La columna de avance aloja además cuatro botones. Grillas fijas de cuatro/dos columnas y formulario lateral de 320px agravan compresión. Usar scroll temporal explícito con nombre fijo y modo lista móvil; colapsar grillas y formulario por breakpoint. Validación visual pendiente. |
| 12 | P1 · Teclado y tacto | `src/components/cmhub/GanttChart.tsx:480`, `:530`, `:624`, `src/app/admin/contenidos/proyectos/page.tsx:266` | Barras div con onClick sin teclado; acciones opacity-0 dependientes de hover; controles de 16–20px; labels sin asociación. Usar botones y enlaces semánticos, foco visible, etiquetas y menú visible. Referencias: WCAG 2.1.1, 1.3.1, 4.1.2; objetivo de diseño táctil 44px. |
| 13 | P1 · Contraste | `src/app/admin/contenidos/proyectos/page.tsx:29`, `:66`, `src/cmhub/tokens.ts:33` | Texto pequeño gris/verde/ámbar falla 4.5:1 en combinaciones verificadas arriba. Ajustar tokens de texto por superficie y tema, reservando colores claros para fondos. WCAG 1.4.3. |
| 14 | P1 · Permisos de equipo | `firestore.rules:220`, `src/app/app/contenidos/proyectos/page.tsx:2` | Cualquier miembro del equipo puede escribir/borrar cualquier proyecto; el colaborador reutiliza la página administrativa con acciones completas. Definir matriz de permisos: lectura por pertenencia, ejecución de tareas asignadas y planificación/borrado por responsables. Si la colaboración abierta es deliberada, documentarla; hoy no existe distinción técnica. |
| 15 | P2 · Acción incorrecta | `src/components/cmhub/GanttChart.tsx:299` | «Nuevo grupo» abre `EMPTY_FORM` con `isGroup: false`; el usuario debe descubrir y marcar otra casilla. Inicializar el formulario como grupo desde esa acción. |
| 16 | P2 · Flujo de actividad | `src/app/admin/contenidos/proyectos/[id]/_ProyectoDetalle.tsx:68` | «Nueva actividad» solo navega a la página general, sin abrir formulario ni preseleccionar proyecto. Pasar contexto y abrir creación vinculada. Ya existe `openNewForProject` en Actividades: reutilizar el comportamiento. |
| 17 | P2 · Carga cognitiva | `src/app/admin/contenidos/proyectos/page.tsx:202`, `:230`, `src/components/cmhub/ProyectoModal.tsx:167` | Solo hay filtro de estado en listado; faltan búsqueda, «Mis proyectos» y señales claras de próxima acción. Muchas métricas se repiten. Sustituir tarjetas extensas por filas escaneables y filtros compactos; abrir el trabajo pendiente del colaborador primero. |
| 18 | P2 · Identidad y mantenibilidad | `src/components/cmhub/ProyectoModal.tsx:89`, `src/components/cmhub/GanttChart.tsx:663`, `src/cmhub/context.tsx:375` | Detalle de 1.394 líneas combina tabs, edición, notas, equipo y métricas. Responsables se guardan por nombre; el renombrado existente no cubre todos los arrays ni Gantt. Dividir por responsabilidad y usar IDs estables con nombres solo para presentación. |
| 19 | P2 · Estados vacíos/lectura | `src/app/admin/contenidos/proyectos/[id]/_ProyectoDetalle.tsx:41`, `src/components/cmhub/GanttChart.tsx:594` | Cero proyectos equivale a «Cargando» incluso después de cargar o fallar; vista pública muestra instrucciones de edición deshabilitada. Separar loading/error/notFound/empty y adaptar ayuda al permiso real. |

## Estructura de experiencia recomendada

Escenario: colaboradores en laptop durante su jornada necesitan identificar su siguiente entrega en segundos; coordinadores necesitan ajustar fechas y detectar sobrecarga. Mantener identidad violeta y temas existentes, con superficies tranquilas y color destinado a selección, estado y riesgo.

### Listado de proyectos

- Barra compacta: búsqueda, «Mis proyectos / Todos», cliente, estado y «Nuevo proyecto» según permiso.
- Filas: nombre y cliente; responsable; próxima entrega; progreso; riesgo; menú de acciones visible. Detalle al abrir el nombre mediante enlace.
- Priorizar proyectos activos con entregas vencidas/próximas. Completados bajo filtro, evitando ocupar la vista inicial.
- Sustituir cuatro tarjetas métricas por contadores integrados en filtros. Evitar repetir avance general y avance de actividades en la misma fila.

### Dentro de un proyecto

- Encabezado estable con nombre, cliente, responsable principal, fecha objetivo y estado de guardado.
- «Trabajo» como área operativa con selector Lista / Tablero / Cronograma; misma tarea, mismo estado y responsable en todas las vistas.
- «Resumen» para objetivo, hitos y decisiones; «Recursos» para enlaces y notas; «Equipo» para capacidad y carga. La ubicación final de Notas debe validarse con el equipo, preservando acceso directo si es de uso frecuente.
- Para colaboradores: filtro inicial «Asignado a mí», secciones «Vencido», «Hoy», «Próximo» y acciones explícitas «Iniciar», «Entregar», «Informar bloqueo». Permitir ver el contexto completo del proyecto sin duplicar tareas.
- Una tarea debe explicar resultado esperado, responsable, fecha, estado, archivos y criterio de finalización. Evitar que un icono circular cambie estado accidentalmente sin indicar cuál será el siguiente.

### Componentes que aportan valor

| Componente | Propósito |
|---|---|
| `ProjectList` + `ProjectFilters` | Buscar y comparar proyectos sin abrir cada tarjeta |
| `TaskInspector` lateral | Editar una tarea manteniendo el contexto de lista o cronograma |
| `SaveStatus` | Confirmar persistencia y recuperar fallos |
| `TaskActionMenu` | Acciones etiquetadas, accesibles con teclado y tacto |
| `ProjectRiskSummary` | Mostrar solo retrasos, bloqueos y decisiones que requieren acción |
| `TeamWorkload` | Detectar asignaciones excesivas; necesita esfuerzo/capacidad, no solo número de tareas |

No recomiendo añadir gráficos decorativos, más tarjetas de indicadores o animaciones de entrada a este flujo.

## Gantt objetivo

Primera entrega: creación y guardado fiables; jerarquía consistente; fechas validadas; grupos derivados; filtros por persona/estado; nombre, responsable y fechas legibles; zoom día/semana/mes; «Hoy» y «Ajustar proyecto»; scroll horizontal con primera columna fija; edición accesible; indicador de guardado y recuperación; exportación consistente con el orden y métricas visibles.

La exportación actual usa orden de almacenamiento, fechas abreviadas sin año y valores propios del grupo. Conviene exportar fechas completas tipadas, jerarquía visible, duración definida y agregados calculados. Manejar fallos de descarga y portapapeles con feedback.

Segunda entrega, después de estabilizar lo anterior: hitos, dependencias fin-inicio, bloqueos, días laborables configurables y carga por persona. Son capacidades nuevas, no funciones ya implementadas. El arrastre/redimensionado debe ofrecer previsualización, confirmación/undo y alternativa mediante formulario; no basta con hacer las barras arrastrables.

Si se añaden dependencias, prevenir ciclos y explicar el efecto de reprogramar una tarea antes de propagar fechas. El calendario laborable debe ser explícito; no asumir que todos trabajan de lunes a viernes.

## Arquitectura propuesta

1. Definir entidad canónica `ProjectTask`: `id`, `projectId`, `parentId`, título, descripción, IDs de responsables, inicio, vencimiento, estado, avance, tipo tarea/grupo/hito y metadatos de modificación. Evitar migrar a ciegas: actividades y Gantt pueden contener trabajo diferente; conciliarlos con respaldo y trazabilidad.
2. Separar reglas de negocio puras: validación de fechas, recorrido de jerarquía, cálculo de progreso/riesgo y política de permisos. Reutilizarlas en lista, Gantt, exportación y proyección pública.
3. Repositorio con operaciones por tarea, confirmación asíncrona, control de concurrencia y estados de error. Definir una estrategia de actualizaciones optimistas con rollback.
4. Capa UI por vista y editor compartido. Cargar detalle/tareas por proyecto; indexar relaciones y evitar filtros completos repetidos por cada fila. Medir antes de introducir virtualización.
5. Publicación como proyección independiente y mínima: activar, copiar enlace y revocar. Nunca resolver privacidad ocultando campos en el componente público.
6. Documentar contexto específico del producto interno: PRODUCT.md y DESIGN.md actuales describen principalmente el calendario público, no la operación de Proyectos.

## Pruebas de aceptación antes de darlo por resuelto

| Área | Caso y resultado esperado |
|---|---|
| Persistencia | Crear raíz, grupo e hijo; recargar y recuperar exactamente los datos |
| Fechas | Rechazar fin anterior al inicio, vacíos no permitidos y fechas inexistentes; conservar «hoy» en Lima a las 20:00 |
| Jerarquía | Impedir niveles no soportados o mostrarlos completos; no generar huérfanos al mover/eliminar |
| Progreso | Misma tarea consistente en todas las vistas; grupo 100% cuando sus hijos terminan; fórmula documentada |
| Concurrencia | Dos personas editan tareas diferentes sin perder cambios; conflicto sobre la misma tarea visible |
| Fallos | Simular permiso denegado, red caída y reconexión; conservar borrador y mostrar estado real |
| Rutas | Abrir enlaces reales y recargar en export/Hosting para admin, colaborador y cliente |
| Privacidad | Visitante sin acceso a documento interno; enlace revocado deja de entregar datos públicos |
| Permisos | Colaborador no puede ejecutar acciones administrativas mediante UI ni escritura directa |
| Accesibilidad | Crear, editar, cambiar estado y ajustar avance con teclado; foco visible y controles etiquetados |
| Responsive | Revisar 360, 390, 768 y 1440px y zoom 200%; nombres/acciones accesibles y scroll temporal controlado |
| Escala | Medir 20, 100 y 500 tareas; establecer presupuesto de interacción y escrituras antes de aprobar rendimiento |
| Exportación | Fechas con año, duraciones coherentes, grupos derivados y orden jerárquico |

## Secuencia recomendada

1. **P0/P1 — `$impeccable harden`**: serialización, rutas, fechas, persistencia, permisos y publicación mínima.
2. **P1/P2 — `$impeccable shape`**: definir tarea única, permisos y navegación operativa; planificar migración sin duplicados.
3. **P1 — `$impeccable adapt`**: cronograma/lista móvil, teclado, foco y acciones visibles.
4. **P1/P2 — `$impeccable clarify` y `$impeccable distill`**: acciones explícitas, reducción de métricas y filtros personales.
5. **P2 — `$impeccable optimize`**: escrituras por gesto, renderizado y carga por proyecto, con mediciones.
6. **Cierre — `$impeccable polish`**: contraste, espaciado, estados y verificación visual autenticada; repetir la auditoría después.

Estas etapas pueden ejecutarse individualmente o en conjunto. Esta entrega documenta la auditoría y la propuesta; todavía no implementa las correcciones.
