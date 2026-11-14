# Implementación de Proyectos y Gantt

Fecha: 1 de octubre de 2026. Seguimiento de [la auditoría original](2026-09-30-proyectos-gantt.md). Alcance: implementación local de Proyectos, modelo de tareas, reglas, publicación mínima y verificación de desarrollo. No acredita un despliegue en producción.

## Entregado

- Espacio de trabajo con Trabajo, Resumen, Recursos y notas y Equipo. Cronograma, Lista y Tablero comparten editor y datos; móvil abre Lista. Incluye filtros, estados vacíos, acciones visibles y exportación Excel.
- Modelo canónico por documento en `hubActividades`, vinculado por `proyectoId`; migración del Gantt legado sin borrar el origen. Validación de fechas reales, jerarquía y dependencias; fases calculadas y progreso común. Fechas de Lima y duraciones inclusivas, con calendario laboral configurable.
- Guardado asíncrono por tarea, transacciones y detección de conflictos. Reprogramación revisable, deshacer, borrador conservado ante fallos y feedback de guardado.
- Permisos basados en UID: administrador o `ownerIds` planifica; `assigneeIds` puede actualizar ejecución (estado, avance, bloqueo) de su tarea. Los nombres no conceden permiso.
- Archivo y restauración de proyectos y tareas; recursos con enlaces web validados, notas editables/buscables/fijables y carga semanal con estimaciones explícitas.
- Compartición activable y revocable mediante endpoint de proyección mínima. El documento interno, notas, recursos, bloqueos y contactos no forman parte de la respuesta pública. Ajustes de rutas para exportación estática y Hosting.
- Extensiones acotadas a Proyectos en `PRODUCT.md` y `DESIGN.md`, preservando la guía previa del calendario público.

## Verificación disponible

Pasaron 15 pruebas de dominio y la suite de emulador: reglas, concurrencia de repositorio, migración, endpoint/revocación y finalización idempotente. La compilación final de producción pasó, incluidas validación de tipos y generación de 113 páginas. Estos resultados verifican desarrollo local, no la configuración desplegada.

Las capturas usan datos de demostración, sin escrituras a Firebase. Se inspeccionaron los archivos siguientes:

| Evidencia | Alcance |
|---|---|
| [Móvil](proyectos-capturas/mobile.png) | Lista inicial, toolbar adaptable, nombres y acciones visibles |
| [Oscuro](proyectos-capturas/dark.png) | Cronograma, fases, barras, dependencias y superficies oscuras |
| [Escritorio](proyectos-capturas/desktop.png) | Cronograma claro recapturado desde servidor aislado con estilos cargados |

También se verificó foco dentro del editor, preservación del borrador ante errores y Lista móvil sin desbordamiento horizontal.

Estas imágenes no prueban acceso autenticado, todas las interacciones, contraste exhaustivo, zoom 200% ni rendimiento a escala. No se asigna una nueva puntuación de accesibilidad o rendimiento sin esa verificación.

## Límites y publicación pendiente

La migración del legado bloquea de forma segura cuando la unión de IDs implicados supera 450. No hay migrador por lotes entregado para ese caso. El usuario conserva los datos originales y necesita una migración controlada antes de guardar ese cronograma.

Falta publicar Hosting, reglas de Firestore y Functions conjuntamente; publicar solo el frontend no completa los cambios de autorización ni el endpoint público. Tras publicar, deben comprobarse enlaces reales, recarga de rutas administrativas/de colaborador/públicas y revocación contra el entorno desplegado. No se afirma que ningún hallazgo de producción esté cerrado por disponer de código o pruebas locales.

## Revisión de cierre

Dictamen independiente: **ship**, limitado a las cuatro correcciones revisadas: foco del editor, campos deshabilitados durante guardado, filas móviles consistentes y documentación específica. Las cuatro quedaron resueltas. No equivale a una certificación exhaustiva de toda la aplicación.
