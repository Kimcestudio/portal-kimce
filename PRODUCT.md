# Product

## Register

brand

## Users

Clientes de la agencia KIMCE que reciben un link público (`/clientes/calendario/[id]`) para revisar el calendario de contenidos de su marca: ven piezas programadas, previsualizan diseños (incluyendo carruseles vía carpeta de Drive), y ahora pueden dejar comentarios (sobre el copy, sobre la fecha, feedback general) sin necesidad de login. Acceden casi siempre desde el celular o laptop personal, en una sesión corta y puntual — no es una herramienta que usen todos los días, así que la primera impresión y la claridad importan más que la densidad de funciones.

## Product Purpose

Esta vista es la cara visible de KIMCE frente al cliente final: reemplaza el viejo flujo de "te paso el link de Drive/Canva por WhatsApp" con un calendario compartido propio, con marca KIMCE. Éxito = el cliente entiende de un vistazo qué se publicará y cuándo, puede previsualizar el diseño sin friction, y deja feedback (comentario o cambio de fecha) sin tener que escribir un mensaje aparte.

## Brand Personality

Es la pieza que más debe transmitir la calidad de KIMCE como agencia — aquí el diseño SÍ es el producto, no solo lo sirve. Se pidió explícitamente tratamiento "Liquid Glass" (material de vidrio líquido, traslúcido, con profundidad y movimiento fluido) inspirado en el nuevo sistema visual de iOS, adaptado a web — moderno, premium, táctil, vivo. Tres palabras: **fluido, premium, nítido** (el vidrio nunca debe sacrificar la legibilidad de la tarea).

## Anti-references

- No clonar literalmente los colores de las referencias visuales entregadas (naranja cálido de un habit-tracker, lavanda genérico de un calendario, azul de aerolínea) — son referencias de **material y estructura** (vidrio, blur, profundidad, tarjetas, animación), no de paleta.
- No glassmorphism genérico/decorativo de 2023 (blur plano sin propósito, sin highlights ni profundidad real) — el listón es el Liquid Glass real de Apple (refracción, lensing, bordes con luz, morphing), no una imitación superficial.
- No perder la claridad de tarea por el efecto visual: sigue siendo una herramienta de aprobación de contenido, el vidrio debe enmarcar la información, no competir con ella.

## Design Principles

1. **El vidrio es el marco de la marca, la información va siempre legible** — los momentos de vidrio (header, hero, tarjetas flotantes) llevan el peso visual; el contenido de trabajo (copy, fechas, comentarios) mantiene alto contraste encima.
2. **Material antes que filtro** — el vidrio debe comportarse como vidrio real: refracta lo que tiene detrás, tiene un borde que capta luz, reacciona al puntero/scroll. Un `backdrop-filter: blur()` plano sin estos detalles no cuenta como Liquid Glass.
3. **Movimiento fluido, no decorativo** — transiciones tipo "líquido" (spring suave, sin rebote cartoonish), morphing entre estados en vez de cortes abruptos, siempre con alternativa para `prefers-reduced-motion`.
4. **Coherencia con la identidad ya existente** — el morado/índigo de KIMCE (`#7c3aed`, `#1f2245`, canvas `#f6f7fc`) es la base de color; el Liquid Glass se construye sobre esa paleta, no sobre una nueva.
5. **Cada pieza de Liquid Glass tiene un trabajo concreto** — no se aplica vidrio "porque se ve bien"; cada superficie de vidrio (header sticky, tarjeta de detalle, hilo de comentarios) existe para separar una capa de navegación/foco de la capa de contenido detrás.

## Accessibility & Inclusion

Contraste estándar (texto ≥4.5:1 sobre cualquier superficie de vidrio, verificado con el vidrio en su estado más claro/oscuro real, no solo en boceto). Soporte obligatorio de `prefers-reduced-motion` para todo morphing/parallax. Sesiones cortas y sin login — ningún flujo (previsualizar, comentar) puede depender de hover-only o de gestos que no funcionen en táctil.

## Extensión interna: Proyectos (Operate)

Alcance: el espacio interno de Proyectos de KIMCE Suite. Esta sección amplía el producto y conserva íntegra la guía anterior del calendario público.

La dirección visual aprobada es minimalista, inspirada en iPhone y liquid glass, con morado KIMCE y colores complementarios funcionales. Los controles y el inspector usan capas translúcidas; las tareas y fechas conservan lectura estable. La prioridad es reconocer proyecto, persona, estado y entrega con poco texto: fotos o iniciales identifican responsables, y acciones secundarias usan iconos con nombres accesibles. La acción principal conserva su etiqueta. Esta decisión reemplaza la dirección plana anterior solo en Proyectos.

El equipo usa Proyectos para decidir qué ejecutar, quién lo hace y cuándo debe entregarlo. La entrada principal es Trabajo, con Cronograma, Lista y Tablero sobre las mismas tareas; Resumen, Recursos y notas y Equipo aportan contexto. En móvil se abre Lista inicialmente (hasta 767px), con acciones de detalle visibles. El colaborador comienza con sus tareas filtradas.

La unidad canónica de trabajo es un documento de `hubActividades`, relacionado por `proyectoId`. Actividades y Proyectos comparten estado y avance; las fases derivan sus fechas y progreso de sus descendientes. El progreso del proyecto es el promedio de tareas no archivadas que no son fases. Los hitos participan como tareas. Las fechas se interpretan en Lima; la duración incluye inicio y fin, o cuenta los días laborables configurados.

La autorización se basa en UID: administrador o UID incluido en `ownerIds` planifica, asigna y administra el proyecto; un UID incluido en `assigneeIds` ejecuta su tarea actualizando estado, avance y bloqueo. Los nombres son etiquetas de presentación, no credenciales de permiso. La interfaz y las reglas de acceso deben mantener la misma distinción.

Archivar conserva historial y actividades; los responsables pueden restaurar proyectos y tareas. La planificación incluye fases, hitos, dependencias, estimaciones y reprogramación confirmada. La capacidad semanal es explícita por proyecto; cero significa sin capacidad definida, no una jornada asumida.

Compartir requiere activar un enlace revocable que entrega una proyección mínima del cronograma. No debe entregar el documento interno, notas, recursos, bloqueos ni contactos. El éxito operativo exige guardados confirmados, borradores conservados ante errores y conflictos visibles, además de coherencia entre vistas.

La migración del Gantt legado se realiza al guardar sin borrar el origen. Cuando la unión de IDs implicados supera 450 y hay legado por migrar, se bloquea de forma segura; requiere una migración por lotes antes de continuar. La publicación de esta extensión requiere desplegar Hosting, reglas y Functions conjuntamente.
