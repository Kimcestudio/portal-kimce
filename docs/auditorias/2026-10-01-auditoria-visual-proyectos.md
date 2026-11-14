# Auditoría visual de Proyectos y Gantt

Fecha: 2026-10-01. Solicitud: reducir información, sustituir nombres extensos por fotos/iniciales y acercar el módulo al lenguaje minimalista de iPhone con liquid glass de KIMCE. Auditoría sin cambios de interfaz.

## Dictamen

La implementación resulta operativa pero no cumple la dirección visual solicitada. La aprobación anterior cubría cuatro correcciones concretas, no la adecuación estética del conjunto. La nueva preferencia del usuario sustituye la decisión previa de superficies planas para Proyectos.

Evidencia: listado real y proyecto ESTRATEGIA COMUNIDAD MSL en localhost:3000, estado inicial filtrado y cronograma completo; capturas previas de demostración en escritorio, móvil, oscuro y editor; código de Proyectos, Gantt, contexto de equipo, estilos globales y Mi día. El detector estático devolvió `[]`: eso no valida estética, densidad ni adecuación al producto. No se midieron rendimiento, contraste compuesto sobre vidrio ni accesibilidad completa; no se asigna una certificación WCAG ni puntuación global artificial.

## Hallazgos priorizados

| Prioridad | Hallazgo y evidencia | Impacto | Cambio recomendado |
|---|---|---|---|
| P1 | Listado: responsables concatenados con nombres completos (`proyectos/page.tsx`, fila de proyecto). En la captura ocupan dos líneas. | El equipo compite con el título y la entrega. | AvatarGroup: foto real, iniciales si no hay foto, máximo 3 visibles y +N; identidad completa al enfocar/tocar. |
| P1 | `projects.css` define blanco sólido, bordes y radios propios; no usa las capas `.kimce-glass`, `.kimce-glass-strong`, `.kimce-liquid` de globals.css. | El módulo se percibe separado de la identidad del portal. | Canvas compartido y vidrio en cabecera, barra de herramientas y panel flotante; contenido de tareas legible sobre superficie estable. |
| P1 | Detalle acumula regreso, título, metadatos, región de estado vacía de 32px, aviso, tabs, selector de vista, filtros y leyenda antes del Gantt. | A la altura de ventana observada apenas se ven unas pocas tareas. | Cabecera compacta, estado vacío sin altura reservada, alerta condensada y una barra contextual de controles. |
| P1 | Tabla fija de 430px dentro de un contenido ya reducido por el sidebar; en móvil 240px. | Cronograma recibe poco espacio; fechas y barras quedan fuera del primer vistazo. | Panel ajustable; propuesta inicial 300–340px escritorio. Duración opcional, avatar junto al título, progreso compacto. En móvil Lista predeterminada y cronograma con panel plegable. |
| P1 | La vista real inicia con “Asignado a mí” sin coincidencias, aunque indica 2/4 tareas y 50%. | Parece vacío o inconsistente; el alcance del contador no se entiende. | Mostrar “0 asignadas a ti · Ver 4 del proyecto”; distinguir métricas globales de las filtradas y mantener contexto. |
| P2 | Nombre completo en tabla y responsable repetido dentro de barra; iniciales de barras calculadas desde nombres, distintas de `TeamMember.initials`. | Redundancia e identidad inconsistente. | Un componente Avatar común por UID. En barras cortas omitir avatar/texto y usar detalle accesible; nombre de tarea principal en tabla. |
| P2 | TeamMember y buildTeamMember no incluyen photoURL, aunque el perfil global sí la usa. | Añadir fotos solo en JSX no resolvería su disponibilidad. | Incorporar foto del directorio autorizado, fallback de error a iniciales y color estable por UID. No utilizar fotos genéricas de personas. |
| P2 | Controles secundarios visibles con peso similar: Fase, Hito, Excel, escalas, Hoy y Ajustar. | Aumenta esfuerzo para identificar la siguiente acción. | Una acción primaria “Nueva tarea”; menú de creación para fase/hito; exportación en más acciones. Iconos de filtro, ajuste y opciones con tooltip y nombre accesible. |
| P2 | Todas las pills de Lista usan morado, incluido completado; botones, progreso y selección también. | El color pierde función y los estados se distinguen leyendo. | Morado=selección/acción; azul=en curso; verde=completado; ámbar=atención; rojo=bloqueo/vencimiento. Siempre acompañar con texto o icono. |
| P2 | Avisos muestran “0 bloqueadas”, “tarea(s)” y fechas ISO; “Próxima entrega” puede ser una fecha vencida. | Texto innecesario y semántica poco natural. | Mostrar solo excepciones relevantes: “1 vencida”; separar vencida de próxima; fecha corta localizada, completa en detalle. |
| P2 | Editor presenta fechas, progreso, horas, fase, todas las dependencias, reprogramación, duplicación y archivo en un formulario largo. | El colaborador debe recorrer controles poco frecuentes. | Secciones: esencial (tarea, persona, fecha, estado), planificación desplegable y menú de acciones. Bloqueo cerca del estado. |
| P2 | Barras de 28px, controles de 36–40px y hitos de 20px. | Objetivos visuales pequeños para tacto; no implica por sí solo incumplimiento WCAG. | Área interactiva mínima objetivo 44px, conservando barras finas y separadas; edición alternativa desde fila. |
| P2 | Botones flotantes globales de IA/asignación se superponen al borde derecho del Gantt observado. | Compiten con el contenido y el desplazamiento. | Reservar área segura o integrar accesos en barra global; no tapar tareas ni controles temporales. |

Total: 5 P1, 8 P2. Sin P0 visual confirmado.

## Composición propuesta

Listado: título y búsqueda compacta; debajo filas con nombre de proyecto, cliente, grupo de avatares, fecha relevante, progreso y menú. Mostrar alertas únicamente cuando existan. No sustituir nombres de proyectos almacenados automáticamente: truncar visualmente y mantener título completo accesible.

Detalle: regreso discreto + nombre + avatares + compartir/opciones; navegación secundaria ligera; barra de trabajo con selector de vista, búsqueda/filtros y Nueva tarea. El cronograma debe ocupar la mayor parte del área útil. El resumen extenso queda en Resumen.

Fila de tarea: nombre como protagonista; avatar de 28–32px, indicador de estado y progreso compacto. Al pulsar se abre el detalle. Completar, comentar o más acciones deben respetar permisos; iconos visibles al enfocar y siempre accesibles en táctil, nunca únicamente por hover.

Gantt: cabecera temporal fija, fases diferenciadas por peso y fondo muy sutil, barras con radio suave y colores semánticos moderados, dependencias finas, indicador Hoy con etiqueta. Al seleccionar, resaltar fila y barra relacionadas. Nombres largos se consultan en detalle; no reducir tipografía para hacerlos caber.

## Liquid glass: aplicación concreta

Reutilizar la paleta morado/índigo del portal, con una base clara fría y variante oscura coherente. Aplicar translucidez, borde luminoso y sombra leve en navegación flotante y editor; conservar superficie estable bajo textos y cuadrícula. No aplicar blur a cada fila ni detrás de cada etiqueta: aumenta coste y debilita lectura. No prometer refracción nativa de iOS usando solo blur CSS.

Crear tokens compartidos para canvas, material, borde, texto, foco y estados; radios orientativos 18–24px en contenedores y cápsulas en acciones. Tipografía de interfaz existente, títulos de 22–24px y tareas de 13–14px; reducir información antes que tamaño de letra. Movimiento breve para selección/apertura, con alternativa de movimiento reducido y fallback opaco sin backdrop-filter.

## Componentes reutilizables sugeridos

- Avatar y AvatarGroup: UID, foto, iniciales, fallback, identidad completa accesible y +N.
- GlassToolbar: búsqueda, filtro activo, cambio de vista y acción primaria.
- IconAction: tooltip en hover/foco, aria-label, estado seleccionado y área táctil consistente.
- StatusIndicator: texto/icono/color semántico común entre Lista, Tablero y Gantt.
- ProjectRow y TaskRow: jerarquía consistente y comportamiento responsive propio.
- TaskInspector: detalle progresivo, acciones según permisos y guardado visible.

## Qué conservar

Modelo compartido entre vistas, jerarquías y dependencias, guardado con errores visibles, confirmación de reprogramación, archivo restaurable y Lista móvil inicial. El rediseño visual no debe alterar estas reglas.

## Orden de trabajo y aceptación

1. Simplificar contenido y jerarquía (distill/layout): nombres, repetición de progreso, alertas y controles.
2. Unificar identidad y materiales (colorize/adapt): avatares, tokens, vidrio y variantes responsive.
3. Afinar Gantt y editor (harden/polish): selección, acciones rápidas, hit targets, foco y recuperación.

Aceptar con proyecto real de nombres largos y demo con varias fases: desktop 1440px, portátil 1280px, móvil 390px, claro/oscuro, editor abierto y filtro vacío. Ninguna página debe desbordar horizontalmente salvo el propio timeline. El Gantt debe ganar área visible respecto de la captura actual; los avatares deben permitir identificar personas sin depender del color; no debe haber acciones flotantes tapando tareas. Probar contraste sobre el fondo compuesto, teclado y zoom 200% antes de aprobar.

La actualización de la documentación visual del sistema se realizará con el rediseño aprobado; esta auditoría no cambia la interfaz ni reescribe la guía existente.
