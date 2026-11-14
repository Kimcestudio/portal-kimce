# Proyectos · implementación visual

Dirección: [decisión aprobada](direccion.md). Alcance: espacio interno de Proyectos; sin migración del sistema visual global ni cambios al calendario público.

La interfaz incorpora fondo lavanda/turquesa, controles translúcidos, inspector flotante y estados complementarios al morado KIMCE. El Gantt reduce la columna fija a 330px (220px en móvil), integra responsables compactos y mantiene espacio para el calendario. Los avatares admiten foto, iniciales e icono de respaldo, con nombre accesible y tooltip al enfocar. Las acciones secundarias usan iconos; crear tarea conserva texto. Filtros y opciones avanzadas se despliegan cuando hacen falta.

Se conservan las tres vistas sobre las mismas tareas, permisos por UID, edición de fechas y confirmación de reprogramación. Los cambios de presentación no alteran el modelo de datos.

## Evidencia local

- [Listado](listado.png): proyectos, responsables y acciones compactas.
- [Cronograma](gantt.png): fases, barras de estado, hitos, avatares y calendario ampliado.
- [Editor](editor.png): inspector y edición de tarea.
- [Móvil](mobile.png): distribución de tareas en pantalla estrecha.
- [Oscuro](dark.png): superficies y controles en tema oscuro.

Las capturas corresponden a datos de demostración locales; no acreditan una publicación ni guardados en producción.

## Verificación

TypeScript y 15 pruebas de dominio aprobados según la verificación de esta sesión. Build pendiente al documentar. Sin despliegue. La revisión visual y su veredicto final se registran por separado al cerrar la implementación.

No se incorporan nuevos recursos raster al producto: las capturas anteriores son evidencia local, y las fotos de avatar provienen del perfil existente cuando está disponible.
