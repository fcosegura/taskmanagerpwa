# Corregir altas de subtareas en el drawer

## Contexto y decisión

`TaskSheetDrawer` todavía mantiene una sección de checklist legacy basada en `task.subtasks` y crea objetos `{ id, title, completed }`. El modelo vigente representa la jerarquía con tareas independientes: el padre contiene los IDs de sus hijas en `dependencyTaskIds`. `App.jsx` ya usa ese modelo para cascadas, bloqueo de padres, ordenación y drag-and-drop.

No se hará una migración automática de checklists existentes. Las entradas legacy se conservarán visibles como legado de solo lectura para no perder datos ni crear tareas inesperadas. Desde este cambio, toda alta nueva desde el drawer creará una tarea hija real.

## Plan de implementación

1. **Cambiar el contrato del drawer** en `src/components/TaskSheetDrawer.jsx`.
   - Recibir `allTasks` o la lista de hijas derivada desde `App` para mostrar las tareas reales enlazadas al padre.
   - Sustituir `handleAddSubtask`, `handleToggleSubtask` y `handleRemoveSubtask` sobre `form.subtasks` por un estado local de títulos de hijas pendientes y acciones de enlace/desenlace.
   - Mostrar las hijas reales usando `dependencyTaskIds`; eliminar una relación debe quitar el ID del padre, no borrar la tarea hija.
   - Mostrar `task.subtasks` legacy existentes en una sección claramente marcada como legado, sin controles de edición, toggle o borrado.
   - El campo “Añadir sub-tarea” debe acumular títulos válidos como nuevas hijas pendientes, no insertar objetos en `subtasks`.
   - Mantener intactos los demás campos y el comportamiento de crear/editar, incluyendo Jira, fechas, estado, prioridad, cierre y foco accesible.

2. **Centralizar el guardado del drawer en `src/App.jsx`**.
   - Añadir un handler específico para el payload del drawer que reciba la tarea editada, los títulos pendientes y los IDs de hijas a desvincular.
   - Para una tarea existente, generar IDs con `uid()`, crear tareas hijas independientes con defaults válidos (`not_done`, prioridad heredada o `medium` según la convención elegida por el código existente), y añadir esos IDs al `dependencyTaskIds` del padre.
   - Para una tarea nueva, generar primero el ID del padre y crear padre e hijas en la misma actualización de `tasks`, evitando hijos huérfanos si el usuario cancela el drawer antes de guardar.
   - Aplicar la misma normalización de tickets y metadatos básicos que usa `upsert`; las hijas no deben copiar `subtasks` ni tener dependencias propias.
   - Respetar las restricciones actuales de jerarquía: no crear enlaces duplicados, no enlazar una tarea consigo misma y no modificar una relación padre-hija inválida. La lógica debe reutilizar o alinearse con `applyTaskUpdate`/`linkStandaloneTaskAsChild` en vez de introducir una dirección de dependencia distinta.
   - Mantener los IDs legacy de `subtasks` fuera de `dependencyTaskIds`; no convertirlos silenciosamente.
   - Pasar al drawer `allTasks` y el nuevo callback de guardado desde el render de `TaskSheetDrawer`.

3. **Ajustar las etiquetas y estados de la UI**.
   - Usar “Tareas hijas” o una etiqueta equivalente para diferenciar el modelo vigente de “Sub-tareas legacy”.
   - Indicar que desvincular no elimina la tarea y que las tareas nuevas se guardan al pulsar Guardar.
   - Deshabilitar o validar el alta de títulos vacíos y evitar duplicar una hija pendiente con otra ya enlazada por nombre/ID cuando aplique.

4. **Actualizar pruebas**.
   - Extender `tests/task-sheet-drawer.test.js` para comprobar que el drawer ya no crea objetos legacy al añadir una nueva entrada y que el payload conserva `dependencyTaskIds`.
   - Añadir pruebas unitarias para la transformación de guardado, preferiblemente extrayendo una función pura pequeña si la lógica de creación padre/hijas resulta difícil de probar dentro de `App.jsx`: creación de padre nuevo con hijas, edición de padre existente, IDs únicos, enlace de las hijas y desvinculación sin borrado.
   - Cubrir que los checklists legacy se conservan sin alteración y no se convierten automáticamente.
   - Añadir o ajustar un escenario E2E en `e2e/app.spec.ts` y `e2e/api-mock.ts` si el flujo de UI existente permite probar el drawer: crear padre, añadir una hija desde el drawer, guardar, reabrir y verificar que aparece como tarea hija; verificar que cancelar antes de guardar no persiste una hija.

## Casos y riesgos a validar

- Crear una tarea nueva con una o varias hijas en una sola operación.
- Editar un padre existente y añadir una hija sin perder sus dependencias actuales.
- Desvincular una hija existente y comprobar que la tarea sigue en la lista.
- Abrir una tarea con `subtasks` legacy y guardar cambios no relacionados sin modificar ese array.
- Cancelar el drawer después de escribir títulos pendientes: no debe cambiar `tasks` ni disparar sync.
- Intentar guardar un padre en `done` con hijas abiertas: debe conservar la validación actual de `applyTaskUpdate`.
- Evitar que la creación desde el drawer introduzca una relación invertida o un ciclo.
- Confirmar que el sync serializa las nuevas hijas como tareas normales y sus relaciones mediante `dependencyTaskIds`.

## Validación final

Ejecutar `npm test`, `npm run lint`, `npm run build` y, si se añade/ajusta el flujo, `npm run test:e2e`. La verificación completa del repositorio sigue siendo `npm run test:verify`.
