# Plan: Próximas tareas en Hoy

## Contexto y decisiones

- `App.jsx` calcula actualmente `todayTasks` y `overdueTasks` a partir de `focusTasks`; `TodayView` solo recibe esas colecciones y las renderiza junto a los eventos del día.
- La nueva ventana será de **mañana hasta dentro de 5 días**, ambas fechas inclusivas. No se duplicarán las tareas de hoy.
- Solo se considerará la fecha de inicio `task.date`. `endDate` no hará que una tarea iniciada antes reaparezca en varios días.
- Solo se mostrarán tareas con estado no terminal/completado (`status !== 'done'`), respetando `focusTasks` para que Focus Mode siga siendo la fuente de visibilidad.
- No se requieren cambios en Worker, D1, storage, API ni modelo de datos.

## Cambios de implementación

1. Añadir una función pura y testeable en `src/todayViewHelpers.js` para obtener las tareas futuras de una ventana de fechas. Debe:
   - recibir tareas, fecha actual local y número de días;
   - generar fechas con calendario local, sin parsear fechas `YYYY-MM-DD` como UTC;
   - excluir tareas sin `date`, completadas, con fecha de hoy, fuera del límite superior o con fechas inválidas;
   - devolver las tareas ordenadas por fecha y, dentro de cada fecha, por prioridad y hora de forma estable.
2. En `src/App.jsx`, calcular la colección futura desde `focusTasks` y `todayStr`, usando exactamente cinco días futuros, y pasarla a `TodayView` como nueva prop. Mantener intactos los cálculos actuales de hoy, atrasadas, métricas y recomendación de foco.
3. En `src/components/TodayView.jsx`:
   - recibir la nueva prop con valor por defecto vacío;
   - agrupar las tareas por `task.date` y renderizar una sección `Próximas tareas` después del bloque de atrasadas, dentro de la columna de tareas;
   - mostrar grupos en orden cronológico, con encabezados localizados que incluyan día de la semana y fecha;
   - reutilizar el patrón actual de tarjetas: completar, abrir/editar, estado, categoría, hora y enlace;
   - mostrar un estado vacío no alarmista cuando no haya tareas en la ventana;
   - evitar que el bloque de próximas tareas altere la recomendación de foco o la sección de agenda.
4. En `src/index.css`, añadir estilos específicos para la sección, encabezados diarios, separación entre grupos y estado vacío, reutilizando variables, tarjetas existentes, densidad y responsive móvil. La jerarquía visual debe distinguirla de `Tareas de Hoy` y de `Tareas Atrasadas` sin crear un nuevo layout de página.

## Pruebas

1. Ampliar `tests/today-view.test.js` con casos para:
   - ventana exacta de cinco fechas: incluye mañana y el quinto día, excluye hoy y el sexto día;
   - exclusión de tareas `done`, sin fecha y con fecha inválida;
   - cambio de mes/año y fechas de fin de mes sin desfase UTC;
   - orden por fecha, prioridad y hora, incluyendo tareas sin hora.
2. Añadir o ampliar una prueba E2E en `e2e/app.spec.ts` que cree una tarea con fecha relativa a hoy dentro de la ventana, navegue a Hoy y verifique el encabezado de próximas tareas, el grupo de fecha y la tarjeta. Crear también una tarea fuera de la ventana o completada para comprobar que no aparece.
3. Ejecutar `npm test`, `npm run lint`, `npm run build` y `npm run test:e2e`; cerrar con `npm run test:verify` según las convenciones del proyecto.

## Riesgos y validaciones

- Usar fechas locales de solo calendario evita que una zona horaria desplace una tarea al día anterior o siguiente.
- La fecha de referencia debe calcularse en el mismo render que `todayStr`; no usar un intervalo fijo de milisegundos de 24 horas para atravesar cambios de horario.
- El selector de estado y las acciones de completar deben conservar los callbacks actuales de `TodayView`, incluido el flujo de comentario obligatorio gestionado por `App.jsx`.
- La nueva sección debe funcionar sin conexión porque solo deriva datos ya cargados en memoria/localStorage.
- No añadir dependencias ni modificar la arquitectura centralizada de estado.
