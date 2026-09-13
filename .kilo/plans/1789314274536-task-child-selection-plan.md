# Plan: Selección de tareas hijas en nueva tarea

## Contexto

`TaskSheetDrawer` se usa desde el menú de nueva tarea y desde la edición rápida. Su sección `Tareas hijas` todavía permite introducir títulos para crear tareas al guardar y muestra el checklist `subtasks` como una sección legacy. El modal `TaskModal` ya trabaja con la relación vigente `dependencyTaskIds`, seleccionando tareas existentes.

## Cambios

1. Actualizar `src/components/TaskSheetDrawer.jsx` para que `Tareas hijas` use selección de tareas existentes:
   - Eliminar el estado y handlers de títulos hijos pendientes (`newChildTitle`, `pendingChildTitles`, `handleAddPendingChild`, `handleRemovePendingChild`).
   - Mantener `dependencyTaskIds` en el formulario y añadir una selección por checkbox equivalente al modal de edición.
   - Excluir la tarea actual, tareas terminadas y tareas que sean padres de la tarea actual; mantener seleccionadas las relaciones ya existentes para permitir conservarlas o desmarcarlas.
   - Mostrar las tareas seleccionadas y permitir desmarcarlas directamente; usar el mismo modelo `dependencyTaskIds` para alta y edición.
   - Eliminar `legacySubtasks` y el bloque visual `Sub-tareas legacy`; no modificar ni borrar silenciosamente `task.subtasks` de una tarea existente al guardar.
   - Ajustar textos para indicar que se eligen tareas ya creadas y eliminar el mensaje de que se crearán al guardar.

2. Simplificar el contrato de guardado en `src/App.jsx`:
   - Retirar la lógica de `pendingChildTitles`, creación de `newChildren`, generación de IDs hijos y `unlinkedChildIds`.
   - Usar directamente `taskPayload.dependencyTaskIds` normalizado al guardar tanto una tarea nueva como una existente.
   - Conservar las validaciones actuales de estado, bloqueo del padre al pasar a completada y actualización de relaciones.
   - Mantener la creación de la tarea nueva con un único `uid()` y la actualización normal de tareas existentes mediante el flujo actual.
   - No cambiar la persistencia, normalización ni migración de `subtasks`; la eliminación solicitada es del uso legacy en esta UI, no de datos ya almacenados.

3. Actualizar `tests/task-sheet-drawer.test.js` para reflejar el contrato nuevo:
   - Comprobar que el drawer selecciona candidatos mediante `dependencyTaskIds` y no contiene el flujo de títulos pendientes.
   - Comprobar que desaparecen `legacySubtasks`, el bloque `legacy-subtasks` y la afirmación de creación de hijos al guardar.
   - Cambiar las expectativas del handler de App para validar el guardado directo de relaciones existentes.
   - Mantener una prueba de que el payload conserva `subtasks` existentes sin presentarlos ni gestionarlos desde la sección nueva.

## Validación

- Ejecutar `npm test` y `npm run lint`.
- Ejecutar `npm run build` para verificar el bundle del drawer lazy-loaded.
- Ejecutar `npm run test:e2e` si el entorno de Playwright está disponible, verificando alta de una tarea seleccionando una o más tareas existentes como hijas y edición/desvinculación de relaciones.

## Riesgos y límites

- La selección seguirá la regla vigente del modal: no ofrecer tareas terminadas ni relaciones que puedan formar una relación inválida; no se cambia el comportamiento drag-and-drop ni el modelo de dependencias.
- Las tareas nuevas hijas por título dejan de crearse desde este menú; para ese caso deberán crearse primero como tareas independientes y luego seleccionarse.
- Los checklists legacy permanecen intactos en almacenamiento y en otros flujos para evitar pérdida de datos.
