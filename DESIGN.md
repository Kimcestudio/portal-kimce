# Design

Ver `PRODUCT.md` para contexto de producto/usuarios. Este documento define los tokens concretos del sistema "Liquid Glass" aplicado a `/clientes/calendario/[id]` (la vista pública compartida con clientes).

## Paleta

- Acento de UI del portal (botones, toggles, estado activo): `#7c3aed` — decisión de producto ya existente, no es "el color de KIMCE", es el acento propio de esta herramienta.
- **Azul de KIMCE** (`#0844ef`, extraído del logo oficial `logo-horizontal-azul.png`): es el color con el que la marca KIMCE/KimceStudio se identifica a sí misma. Se usa en el blend del fondo "mesh" (`brandMeshBackground`) y en cualquier elemento que represente a KIMCE como empresa — nunca el morado.
- Ink (texto fuerte / fondos oscuros puntuales): `#1f2245`
- Canvas: `#f8fafc` / `#f6f7fc`
- El vidrio se construye sobre esta base. Las referencias visuales originales (naranja, lavanda, azul aerolínea) se usaron solo para estudiar material y estructura — sus colores nunca se copiaron.

## Fondo "mesh" por marca (`brandMeshBackground`)

Cada cliente tiene su propio fondo degradado, derivado de `brand.color` (no de una paleta fija): se mezcla el color de la marca con blanco (highlight), con el azul de KIMCE (acento, *no* morado) y con el ink (profundidad). Sin color de marca, cae al azul de KIMCE como base neutra. Esto es lo que le da al vidrio algo con color real detrás para refractar — un fondo plano gris no produce el efecto.

Toda superficie que necesite texto fijo (toolbar de navegación, leyenda de estados, header) vive sobre `kimce-glass`/blanco sólido, nunca directamente sobre el mesh — el color de cada marca varía demasiado (puede ser muy oscuro o muy claro) para garantizar contraste de texto sin una superficie propia debajo.

## Las 3 superficies de vidrio (y solo esas)

El vidrio es chrome de navegación/foco, nunca el contenido de trabajo (copy, fechas, comentarios individuales). Implementado en `src/app/globals.css` como utilidades `kimce-glass` / `kimce-glass-strong`, usadas en `_CalendarioCompartido.tsx`:

1. **Header sticky** (`kimce-glass-strong`) — la marca y navegación de marca (logo, links rápidos) flotan sobre el contenido al hacer scroll.
2. **Drawer de detalle** (`kimce-glass`) — el panel que se abre al elegir un día. El contenido de la pieza (copy, preview de Drive) sigue en tarjetas blancas sólidas encima del vidrio.
3. **Contenedor del hilo de comentarios** (`kimce-glass`) — encierra la conversación; los inputs y burbujas de comentario individuales son blancos sólidos para máximo contraste al escribir/leer.

Todo lo demás (grilla del calendario, tarjetas de día, chips de KPI, chips de links de marca, footer de atribución) es sólido — son la capa de información, no de chrome.

## Anatomía del vidrio

```css
.kimce-glass-strong {
  background: rgba(255,255,255,0.78);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.95),  /* rim-light superior */
    0 1px 0 rgba(124,58,237,0.06),          /* línea de acento, casi imperceptible */
    0 8px 24px rgba(31,34,69,0.06);         /* profundidad */
}
.kimce-glass {
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(16px) saturate(160%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.85),
    inset 0 0 0 1px rgba(255,255,255,0.4),  /* borde de vidrio completo, no plano */
    0 10px 36px rgba(31,34,69,0.10);
}
```

- `saturate()` junto al `blur()` es lo que separa esto de glassmorphism genérico de 2023: el fondo desenfocado se ve "vivo" (colores realzados), no gris plano.
- El rim-light (`inset 0 1px 0` blanco) simula el borde que capta luz en vidrio real — nunca un `border` sólido de un color plano.
- Radios concéntricos: el drawer usa `rounded-l-3xl`; las tarjetas internas (`rounded-2xl`) y sus elementos (`rounded-xl` en iframes/botones) comparten el mismo centro de esquina, solo reduciendo el radio hacia adentro.

## Movimiento

- `kimce-drawer-enter` (slide + fade, `cubic-bezier(0.16, 1, 0.3, 1)` — salida exponencial, sin rebote) al abrir el panel de detalle.
- `kimce-fade-enter` para el overlay de fondo.
- `prefers-reduced-motion: reduce` desactiva ambas animaciones (definido en el mismo `globals.css`).
- Transiciones de color/opacidad puntuales (hover en chips, botones) usan `transition-colors`/`transition-opacity` estándar de Tailwind — no necesitan curva líquida, son micro-interacciones, no morphing de layout.

## Accesibilidad

- Contraste verificado con el vidrio en su estado real (no boceto): texto sobre `kimce-glass`/`kimce-glass-strong` usa los mismos tonos `#111827`/`#374151`/`#6b7280` ya probados sobre blanco — el `rgba(255,255,255,0.7-0.78)` + blur mantiene el fondo efectivo cerca de blanco puro detrás del texto.
- Ningún flujo (previsualizar diseño, comentar, aprobar) depende de hover-only; todos los triggers son `onClick` táctiles.

## Extensión interna: Proyectos (Operate)

Esta extensión corresponde exclusivamente a `.project-work` y sus componentes en Proyectos. Conserva el sistema anterior del calendario público. La dirección aprobada combina minimalismo de iPhone, vidrio translúcido y color funcional KIMCE: trabajo visible antes que metadatos, responsables compactos y calendario amplio. La tipografía se hereda del portal.

### Colors

Tokens efectivos extraídos de `src/components/cmhub/projects/projects.css`:

| Token | Claro | Oscuro |
|---|---|---|
| `--pw-bg` | `#fcfcff` | `#191d2b` |
| `--pw-soft` | `#f0f0fa` | `#252b40` |
| `--pw-ink` | `#172033` | `#f1f5f9` |
| `--pw-muted` | `#566079` | `#bbc5dd` |
| `--pw-line` | `#dedfeb` | `#3a435b` |
| `--pw-accent` | `#6d28d9` | `#c4b5fd` |
| `--pw-glass` | `rgba(255,255,255,.82)` | `rgba(30,35,53,.88)` |

El morado concentra la acción primaria y la vista seleccionada. Turquesa, azul, ámbar y rosa distinguen estados, acciones y personas. Barras: pendiente `#eee3ff` / `#562288`, en curso `#c8eafa` / `#13486c`, completado `#bcecdf` / `#125946`, bloqueo `#ffd3db` / `#8b1d36` (fondo / texto); fase `#8b77bb`, hito ámbar `#d97706` y línea de hoy `#dc2626`. Los estados conservan etiquetas o contexto accesible además del color.

### Typography and Layout

Base 14px; título 24px/700 (21px en móvil), secciones 17px/600 e inspector 20px/700. Botones y tareas 13px, auxiliares 12px, escala temporal y barras 11px. El Gantt reserva 330px para tarea, avatar y avance, filas de 58px y cabecera de 64px; oculta la columna de duración para ampliar el calendario. Mantiene desplazamiento temporal explícito.

A ≤767px se abre Lista al montar y permanecen disponibles las otras vistas. La columna fija del Cronograma mide 220px. Lista organiza el título sobre responsables, estado, avance y acceso al detalle. Formularios y resumen pasan a una columna. El shell usa padding de 24px en escritorio y 16px/12px en móvil, con espacio inferior de 90px.

### Elevation, Shapes and Components

El fondo mezcla lavanda y turquesa suaves; en oscuro usa índigo y petróleo. El vidrio agrupa navegación, filtros e inspector con bordes luminosos y sombra suave; el calendario mantiene una superficie estable para leer fechas y barras. Filtros: blur de 20px; inspector: blur de 28px; ambos con saturación de 160% y respaldo opaco cuando no se admite `backdrop-filter`. No se presupone refracción física.

Shell e inspector tienen radio de 24px; calendario, lista y filtros, 18px; botones, 14px; campos, 12px. El inspector conserva ancho máximo de 440px, margen de 12px (6px en móvil), sombra ambiental y entrada de `.18s` solo sin preferencia de movimiento reducido.

Botones y campos miden al menos 44px; tabs y segmentos, 40px. Acciones rápidas de fase, hito, exportación, filtros y ajuste de cronograma usan iconos con nombre accesible y título; la creación principal mantiene texto. El foco usa contorno de 3px del acento.

Responsables usan foto cuando existe; si falta o falla, iniciales o icono de persona. Avatares de 32px (27px en Gantt), cinco tonos deterministas, nombre accesible y tooltip en hover/foco. Los grupos muestran hasta tres personas y un contador adicional. No sustituir UID por nombre como identidad de autorización.

Mantener las barras como botones, editor de fechas como alternativa al arrastre y confirmación antes de persistir reprogramaciones. Guardados usan región de estado; errores usan alerta y conservan el borrador. Cronograma, Lista y Tablero representan las mismas tareas y métricas. Estos cambios no extienden tokens al calendario público ni regeneran el frontmatter o sidecar global.
