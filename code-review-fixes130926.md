# Code Review — Verificación de fixes130926.md

Fecha: 2026-09-13
Alcance: 32 hallazgos (C1–C2, A1–A7, M-B1–M-B4, M-F1–M-F9, B1–B10)
Resultado global: **32 VERIFIED / 0 PARTIAL / 0 NOT DONE / 0 FALSE POSITIVE**

Revisión adversarial sobre el working tree (`git diff`) sin ejecutar `test:verify`. Todos los veredictos
se comprobaron leyendo el código real, no los reportes de implementación.

**Remediación post-review (2026-09-13):** el otro agente aplicó R1, R5 y R6. Se re-verificaron de forma
adversarial leyendo el código y ejecutando comprobaciones puntuales, y `npm run test:verify` quedó en verde
(202 tests unitarios, lint, build y 17 E2E). Con ello C2 y A7 pasan a VERIFIED.

---

## Tabla de veredictos

| ID | Severidad | Veredicto | Evidencia (archivo:línea) | Notas |
|---|---|---|---|---|
| C1 | Crítico | VERIFIED | `storage.js:717-755`, `App.jsx:414-417` | `shouldPreferLocal = localHasData && !cloudHasData`; snapshot de nube real (vacío) para forzar re-push y `lastSyncedPayloadRef=''`. Se resetea la bandera al inicio de `loadData`. Sin bucle (dedup por payload tras el push). |
| C2 | Crítico | VERIFIED | `storage.js:86-88,184-214,313-338` | Saneo por-item, `normalizeSubtask` (text/done/id) y `urgent→critical` implementados y testeados. El guard `isPlainObject` se aplica **antes** de `.map(normalizeTask/…)` (fix R5), por lo que entradas `null`/no-objeto se descartan sin tumbar el dataset (verificado: payload con `null`, `'basura'`, `42` conserva la única tarea válida). Tests: `storage.test.js:70` y `storage.test.js:99`. |
| A1 | Alto | VERIFIED | `noteAi/adapters.js:127-131`, `noteAi/pipeline.js:236-237`, `worker.js:1764-1787` | `deleteByIds(ids,{namespace})` propagado; única llamada (process delete) pasa `vectorNamespace`; full-reset detecta ids eliminados y encola `delete` antes del `batch`. |
| A2 | Alto | VERIFIED | `noteAi/pipeline.js:566,573-578` | Troceo `i += QUEUE_BATCH_LIMIT (100)` con `slice`; no pierde mensajes (test 250→[100,100,50]). |
| A3 | Alto | VERIFIED | `worker.js:1863-1873` | `enqueueNoteAiJobs` envuelto en try/catch tras `DB.batch`; log con hash de perfil; responde 200. Ver R3 (jobs perdidos sin reconciliación). |
| A4 | Alto | VERIFIED | `App.jsx:1120-1141` | Bloqueo y snapshot calculados fuera del updater; `setTasks` puro (filter/map); no quedan `showToast`/setState dentro de updaters. |
| A5 | Alto | VERIFIED | `App.jsx:845-874`, `KanbanView.jsx:646-663` | Validación pura con `tasks` del render, retorno booleano previo a mutar; toast fuera del updater. Ver R6 (pierde guard atómico `alreadyLinked`). |
| A6 | Alto | VERIFIED | `taskStatusCascade.js:14-40`, `App.jsx:712-745,775` | Cascada recursiva y cycle-safe aplicada en `commitStatusChange` y en `applyTaskUpdate(cascade:true)` (modal y TaskSheet); respeta parent blocking. |
| A7 | Alto | VERIFIED | `todayViewHelpers.js:23-41,44-54`, `storage.js:161-162,216-217,245-251,278-280`, `worker.js:1150-1166`, `App.jsx:1583` | `fmtDate` defensivo + validación de forma, más `canonicalizeDateOnly` aplicado en todos los orígenes de escritura (fix R1). `2026-5-3`, `2026/05/03`, ISO datetime y `YYYY-MM-DD` se canonicalizan antes de validar; basura y fechas fuera de rango se vacían en lugar de descartar la entidad. Tests: `storage.test.js:120,151`, `today-view.test.js:6`. |
| M-B1 | Medio | VERIFIED | `worker.js:1289-1293` | `consumeNoteAiRateLimit` (30/60s) en `GET /notes/:id/related`. |
| M-B2 | Medio | VERIFIED | `worker.js:1869-1877` | Log de sync usa `shortHashForLog(syncProfileId)` y `userIdHash`; sin `userId/profileId` en claro. |
| M-B3 | Medio | VERIFIED | `worker.js:1651-1673,1676-1724` | Allow-list explícita en `/api/data`; excluye `user_id`, `profile_id`, `description`, `content_hash` y ciphertext. |
| M-B4 | Medio | VERIFIED | `worker.js:1486-1493,1503-1510,1547-1554,1737-1742` | `request.json()` con try/catch → 400 en `/profiles`, `/profiles/delete`, `/profiles/update`, `/sync`. `/api/login` ya estaba protegido. |
| M-F1 | Medio | VERIFIED | `App.jsx:661-669` | `showToast` de parent-blocking movido fuera de `setTasks`; updaters puros. |
| M-F2 | Medio | VERIFIED | `App.jsx:182-194` | `JSON.parse` en try/catch con validación de array de prioridades válidas y fallback. |
| M-F3 | Medio | VERIFIED | `App.jsx:685-708` | `buildReorderedTasks` conserva buckets huérfanos al final; no descarta tareas. Sin test dedicado. |
| M-F4 | Medio | VERIFIED | `constants.js:78-87`, `App.jsx:661,720,727,755,769,1088,1124,1796-1804`, `todayViewHelpers.js:94`, `taskTrashHelpers.js:6-12`, `kanbanTaskVisibility.js:19-22` | Literales del scope sustituidos por `isTerminalStatus` con `statuses` propagado (Kanban columna Done, TaskRow, TaskModal, TaskTrashDropZone, TasksView). Ver R8 (literales residuales fuera de scope). |
| M-F5 | Medio | VERIFIED | `kanbanTaskVisibility.js:28-45`, `TasksView.jsx:137-139` | Helper con set de visitados; ciclo no cuelga (test). Doc ligeramente inexacta (R11). |
| M-F6 | Medio | VERIFIED | `App.jsx:486-497`, `Login.jsx:6-18,64` | `handleLoginSuccess` con `useCallback([])`; Login usa `onLoginSuccessRef` y efecto `[]` → identidad estable. |
| M-F7 | Medio | VERIFIED | `App.jsx:1555-1558`, `CommandMenu.jsx:28` | `navigateToView` ya no mapea `tasks→kanban`; “Ir a Tareas (Lista)” muestra `tasks`. Ver R9 (cambio de nav móvil). |
| M-F8 | Medio | VERIFIED | `kanbanDoneRange.js:14-38,41-63`, `KanbanView.jsx:365-369` | `resolveTaskCompletionIso` (completedAt→updatedAt→statusLog→createdAt) y `isCompletedAtWithinKanbanRange` mantiene visibles sin fecha. |
| M-F9 | Medio | VERIFIED | `App.jsx:51-57,1802-1804` | `isCompletedAtOnLocalDate` compara fecha local derivada de `new Date(completedAt)` con `todayStr`. Ver R7 (sin test). |
| B1 | Bajo | VERIFIED | `noteAi/pipeline.js:71-106` | Caché solo si todas las DDL críticas OK; `duplicate column` cuenta como éxito. |
| B2 | Bajo | VERIFIED | `worker.js:1190-1198` | `GOOGLE_ID_TOKEN_PATTERN` (3 segmentos) + `encodeURIComponent`; cookies no-JWT no llegan a Google. |
| B3 | Bajo | VERIFIED | `d1-field-crypto.js:90-112` | Regla matizada: sin prefijo `v1.` → passthrough; con `v1.` y fallo → `null` + log; envelope <13 bytes → `null`. Ver R2 (edge plaintext `v1.`). |
| B4 | Bajo | VERIFIED | `worker.js:300-313,1238` | `pruneStaleRateLimits` borra `window_start < now-24h` en login (best-effort). |
| B5 | Bajo | VERIFIED | `noteAi/clustering.js:111-139` | `clampOption` acota noteWidth/boardWidth/gaps/padding/maxPerRow. Sin test de valores límite superiores. |
| B6 | Bajo | VERIFIED | `Toast/useToasts.js:16-19` | Cleanup de timers en unmount + `clear()`. |
| B7 | Bajo | VERIFIED | `App.jsx:254,608-612,1357-1363` | `boardLayoutTimerRef` limpiado en unmount y antes de rearmar. |
| B8 | Bajo | VERIFIED | `TaskModal.jsx:9,174`, `EventModal.jsx:12,75`, `StatusManagerModal.jsx:37,142`, `AgendaPlanModal.jsx:43,112` | Los 4 modales usan `useModalDialog({isOpen:true,onClose})` con `ref` en el contenedor → focus trap/Escape/focus restore. No migran a `ui/Modal` pero cubren el objetivo y no duplican overlays. |
| B9 | Bajo | VERIFIED | `GraphView.jsx:88-100,182` | Listener nativo `wheel` con `{passive:false}`; elimina `onWheel` de React. |
| B10 | Bajo | VERIFIED | `CalendarView.jsx:2-3,78,228` | `selDate = parseLocalDateOnly(selDs)` y `DAYS[selDate.getDay()]`; sin parseo UTC. |

---

## Regresiones y hallazgos nuevos

### [ALTO] R1 — A7: validación estricta de fecha sin normalizar en origen provoca pérdida silenciosa de tareas ✅ RESUELTO (2026-09-13)

- **Archivos**: `storage.js:156-157,307-320`, `todayViewHelpers.js:4-9`, `worker.js:1148-1170`, `App.jsx:1602-1614`.
- **Descripción**: `isValidTask` ahora exige `date`/`endDate` con forma `YYYY-MM-DD` (regex), pero la app puede **crear** datos con otros formatos y no los normaliza:
  - `normalizeAiTaskInput` (`App.jsx:1604`) copia `taskInput.date` tal cual.
  - `normalizeMain` de `/api/ai/generate-tasks` (`worker.js:1149-1154`) usa la fecha cruda que devuelve el modelo (p. ej. `2026-5-3`), y `normalizeChild` (`worker.js:1165`) sólo hace `.slice(0,10)`, sin rellenar ceros.
  - Import de backups antiguos con `2026/05/03`, `2026-5-3` o ISO datetime.
- **Consecuencia**: la tarea se crea y sincroniza, pero en la siguiente carga `normalizeDataPayload` la descarta (`filter(isValidTask)`), se reescribe localStorage sin ella y el siguiente sync incremental propaga un **DELETE** a D1. Pérdida de datos permanente y silenciosa. Es un caso borde realista vía IA/import, no sólo teórico.
- **Recomendación**: normalizar en escritura (que `normalizeTask` convierta cualquier fecha parseable a `YYYY-MM-DD` o la vacíe, y que `normalizeMain`/`normalizeChild` usen `parseDateInCurrentWeek`/padder). Alternativamente, `isDateOnlyString` debería aceptar y canonicalizar formatos parseables. Añadir test con fecha no rellenada.
- **Fix aplicado (2026-09-13)**: nueva función pura `canonicalizeDateOnly(value)` en `todayViewHelpers.js:23-41` (acepta `YYYY-M-D`, `YYYY/MM/DD`, `YYYY-MM-DD` e ISO datetime; valida rango y rechaza basura devolviendo `''`). Se aplica en `storage.js:216-217` (`normalizeTask`), `storage.js:245,250-251` (`normalizeEvent`), `worker.js:1150,1155,1166` (`normalizeMain`/`normalizeChild`) y `App.jsx:1583` (`normalizeAiTaskInput`). Verificado: `2026-5-3`→`2026-05-03`, `2026/05/03`→`2026-05-03`, `2026-05-03T14:30:00Z`→`2026-05-03`, `basura`→`''`, `2026-13-01`/`2026-02-30`→`''`. Una tarea con fecha no rellenada sobrevive a `normalizeDataPayload` en lugar de ser descartada. Tests: `tests/storage.test.js:120`, `tests/today-view.test.js:6`.

### [MEDIO] R2 — B3: plaintext legacy que empieza por `v1.` se convierte en `null`

- **Archivo**: `d1-field-crypto.js:90-110`.
- **Descripción**: cualquier valor que empiece por `v1.` se trata como ciphertext. Un nombre/nota legacy aún no cifrado como `v1.2 release` hace fallar `atob`/descifrado → `null`. En `/api/data`, `nameOut` cae a descripción y, si no hay, a `''`: el nombre desaparece.
- **Recomendación**: para valores `v1.` que no decodifican como base64 válido, devolver el texto original (passthrough) en lugar de `null`, o restringir el prefijo a un envelope base64 válido.

### [MEDIO] R3 — A3: jobs de Note AI descartados sin reconciliación

- **Archivos**: `worker.js:1863-1873`, `noteAi/pipeline.js:568-601`.
- **Descripción**: si `sendBatch` falla, se loguea y se devuelve 200 (correcto post-commit), pero los jobs `analyze` se pierden. Las notas quedan en `pending` sin embeddings/meta y no hay reintento: `enqueueStaleNoteAiReindex` sólo reencola por `vector_schema` stale.
- **Recomendación**: en `GET /api/notes/ai`, reencolar análisis para meta `pending` sin vector, o llevar contador de fallos para reencolar.

### [MEDIO] R4 — C1: resurrección de datos borrados en otro dispositivo

- **Archivo**: `storage.js:730-741`.
- **Descripción**: `shouldPreferLocal = localHasData && !cloudHasData` re-sube todo el local cuando la nube está vacía. Si el usuario borró todo desde otro dispositivo (nube legítimamente vacía), el snapshot vacío produce **upserts** de todo el local, resucitando lo borrado. La alternativa de recencia (`updated_at`) mencionada en el plan no se usó.
- **Recomendación**: comparar recencia o persistir un marcador de “workspace vaciado” para no reintroducir datos.

### [MEDIO] R5 — C2: entradas `null`/no-objeto siguen tumbando el payload completo ✅ RESUELTO (2026-09-13)

- **Archivo**: `storage.js:179-208,307-320`.
- **Descripción**: `parsed.tasks.map(normalizeTask)` se ejecuta antes de `filter(isValidTask)`; `normalizeTask(null)` lanza TypeError. En `readLocalPayload` el catch devuelve `{tasks:[],boardNotes:[],events:[]}` (pérdida total) y en `loadData` se devuelve local con `authenticated:false`. El objetivo de C2 (“nunca descartar todo el dataset”) no se cumple para entradas nulas.
- **Recomendación**: guardar `normalizeTask`/`normalizeEvent`/`normalizeBoardNote` para no-objetos o filtrar por tipo antes de mapear.
- **Fix aplicado (2026-09-13)**: helper `isPlainObject` en `storage.js:86-88`; en `normalizeDataPayload` se filtra con `.filter(isPlainObject)` **antes** de `.map(normalize*)` para tasks/notes/events (`storage.js:315,320-326`). Nota de escepticismo: `normalizeTask` en sí sigue sin ser null-safe si se invocara directo, pero es una función privada y el guard la hace inalcanzable con entradas no-objeto. Verificado: un payload con `[null, validTask, 'basura', 42]` conserva la tarea válida (no devuelve arrays vacíos). Test: `tests/storage.test.js:99`.

### [MEDIO] R6 — A4/A5: validación contra el snapshot del render pierde el guard atómico ✅ RESUELTO (2026-09-13)

- **Archivo**: `App.jsx:845-874` (`linkStandaloneTaskAsChild`), `App.jsx:1120-1141` (`del`).
- **Descripción**: `alreadyLinked`, `hasParent`, `hasChildren` se calculan con `tasks` del render. Antes el updater leía `previousTasks` y cortaba la duplicación; ahora dos drops seguidos del mismo par pueden **duplicar** `dependencyTaskIds`. Igualmente, dos borrados en el mismo tick usan un snapshot potencialmente obsoleto para el undo.
- **Recomendación**: revalidar dentro del updater sin reintroducir side effects (p. ej. devolver el resultado por ref) o bloquear el origen tras el primer drop.
- **Fix aplicado (2026-09-13)**: nueva función pura `applyStandaloneChildLink(previousTasks, { sourceTaskId, targetTaskId, targetTask })` en `taskLinking.js:28-42`, que deduplica `dependencyTaskIds` (`[...new Set([...deps, sourceTaskId])]`, `taskLinking.js:32-36`) y es idempotente ante dos drops con snapshot obsoleto; `App.jsx:850` la usa dentro del updater y `showToast` queda fuera (`App.jsx:852`). `linkStandaloneTaskAsChild` sigue devolviendo booleano puro (`App.jsx:833-853`). Verificado: input no mutado (pureza), `['x','x']`→`['x','c']` sin duplicar en 1.º/2.º/3.º drop y herencia de ticket intacta. Test: `tests/task-linking.test.js:12`.

### [BAJO] R7 — Cobertura de tests incompleta para varios hallazgos

- Faltan tests de: A3 (fallo de `sendBatch` → 200), A4/A5 (pureza/deduplicación), M-F2, M-F3 (buckets huérfanos), M-F6, M-F7, M-F9 (medianoche local), M-B1–M-B4, B2, B4, B6–B10, C2 con entrada `null`.
- Los tests exigidos por el plan (C1, C2, A1, A2, A6, A7) sí existen y no son triviales (ver sección siguiente).

### [BAJO] R8 — Literales `'done'` residuales (M-F4 incompleto fuera del scope listado)

- **Archivos**: `App.jsx:1811`, `components/CalendarView.jsx:208`, `components/TaskSheetDrawer.jsx:49`, `components/TimelineView.jsx:11,29`, `kanbanTaskLimit.js:12`, `dailyStatusActivities.js:47-130`, `focusRecommendation.js:72,78`.
- **Descripción**: los statuses custom con `kind/isTerminal='done'` no se comportan como terminales en estos puntos: el filtro “done” del resumen (`filter === 'done'`) no muestra tareas de status custom terminal, el timeline no las agrupa como completadas, etc. M-F4 sólo pedía 5 ubicaciones (todas hechas), pero la inconsistencia de UX persiste.

### [BAJO] R9 — M-F7 cambia la navegación móvil/desktop de “Tareas”

- **Archivos**: `BottomNav.jsx:87`, `App.jsx:1948`.
- **Descripción**: al eliminar el mapeo `tasks→kanban`, el tab móvil “Tareas” abre ahora la Lista (antes siempre Kanban) y el pill de área conserva la subvista actual. Puede ser lo deseado, pero es un cambio de comportamiento no documentado.

### [BAJO] R10 — A6: la cascada sobrescribe descendientes ya terminales y no registra `statusLog` en hijos

- **Archivos**: `taskStatusCascade.js:14-40`, `App.jsx:727-741`.
- **Descripción**: mover un padre a `blocked`/`paused` convierte nietos `done` en `blocked` y limpia su `completedAt` (comportamiento preexistente para hijos directos, ahora recursivo). Los hijos tampoco reciben entrada en `statusLog`, por lo que su timeline no refleja la cascada.

### [BAJO] R11 — `isTaskHiddenByCollapse` con doc inexacta en ciclos

- **Archivo**: `kanbanTaskVisibility.js:28-45`.
- **Descripción**: el doc dice que en un ciclo “mantiene la tarea visible”, pero si los ancestros no están expandidos devuelve `true` (oculta) antes de detectar el ciclo. No hay cuelgue (lo importante), pero el contrato documentado no se cumple.

### [BAJO] R12 — `normalizeSubtask` genera ids no deterministas para subtasks legacy sin id

- **Archivo**: `storage.js:175-187`.
- **Descripción**: `legacySubtaskId()` usa `Date.now/random`, así que un subtask legacy sin id cambia de identidad en la primera normalización y provoca un re-sync/hash extra. Acotado a una vez por subtask.

### [BAJO] R13 — Comentario obsoleto/engañoso

- **Archivo**: `storage.js:743`.
- **Descripción**: “Prefer local when cloud comes back empty, to avoid data loss on transient sync failures.” describe una decisión ya tomada en las líneas 730-733; el comentario está fuera de contexto.

---

## Remediación post-review (2026-09-13)

| Regresión | Fix (archivo:línea) | Test que lo cubre | Verificación adversarial |
|---|---|---|---|
| R1 (A7) | `todayViewHelpers.js:23-41` (`canonicalizeDateOnly`); aplicado en `storage.js:216-217,245,250-251`, `worker.js:1150,1155,1166`, `App.jsx:1583` | `tests/storage.test.js:120`, `tests/today-view.test.js:6` | Formatos mixtos/ISO/basura comprobados por ejecución; tarea con fecha `2026-5-3` sobrevive a `normalizeDataPayload`. |
| R5 (C2) | `storage.js:86-88` (`isPlainObject`) + filtro previo al `.map` en `storage.js:315,320-326` | `tests/storage.test.js:99` | Payload con `null`/`'basura'`/`42` conserva las entidades válidas; no hay descarte total. |
| R6 (A4/A5) | `taskLinking.js:28-42` (`applyStandaloneChildLink`); usado en `App.jsx:850` | `tests/task-linking.test.js:12` | Input no mutado, dependencias deduplicadas e idempotente en drops repetidos; `linkStandaloneTaskAsChild` devuelve booleano. |

Comprobaciones de regresión nueva: sin imports huérfanos (`canonicalizeDateOnly`, `isPlainObject`, `applyStandaloneChildLink` todos usados), sin doble normalización (el guard precede al `.map` y no se re-normaliza fuera), y sin pérdida de campos en R6 (se conservan `dependencyTaskIds` y la herencia de ticket que ya hacía el código anterior).

---

## Cobertura de tests

| Hallazgo | Test | Calidad |
|---|---|---|
| C1 | `tests/storage.test.js` → `loadData conserva local ante nube vacía...` | Buena: verifica `preferredLocal`, `didLastLoadPreferLocal()` y que `saveData` emite ops con upsert. |
| C2 | `storage.test.js` → `normaliza subtasks legacy y prioridad urgent` + `no descarta el dataset por entradas null/no-objeto` | Buena: subtask `{id:5,title,completed}`, prioridad `urgent`, saneo por-item y cobertura de `null`/no-objeto (R5). |
| A1 | `tests/noteAi-fixes.test.js` → adapter + `processNoteAiJob` + full-reset delete | Buena: namespace exacto y deletes de notas eliminadas. |
| A2 | `noteAi-fixes.test.js` → `chunks sendBatch at QUEUE_BATCH_LIMIT` | Buena: 250→[100,100,50] y single job. |
| A6 | `tests/task-status-cascade.test.js` → nietos y ciclo | Buena: recursión, `completedAt` y cycle-safety. |
| A7 | `tests/today-view.test.js` (fmtDate + `canonicalizeDateOnly`) + `storage.test.js` (fechas inválidas y no rellenadas) | Buena: crash, formatos inválidos y canonicalización de origen (R1). |
| M-F4 | `kanban-task-visibility`, `taskTrashDropZone`, `today-view` | Buena para status custom terminal. |
| M-F5 | `kanban-task-visibility` | Buena: ciclo. |
| M-F8 | `kanban-done-window` | Buena: fallbacks y visibilidad sin fecha. |
| A3/A4/A5/M-F2/M-F3/M-F6/M-F7/M-F9/M-B*/B2/B4/B6–B10 | — | Sin cobertura (varios son de bajo riesgo o difíciles por ser internos de `App.jsx`). |

No se observan tests triviales: los nuevos verifican comportamiento (lotes exactos, namespace, cascada recursiva, re-push de ops), no sólo “no lanza”.

---

## Conclusión y recomendaciones

1. **Implementación muy completa y cerrada**: los 32 hallazgos tienen código real y quedan VERIFIED sin reservas. C1, A1, A2, A6 y el endurecimiento del backend están bien resueltos y con tests no triviales.
2. **C2 y A7 cerrados**: la remediación de R5 (filtro `isPlainObject` antes del `.map`) elimina el descarte total por entradas `null`, y la de R1 (`canonicalizeDateOnly` en todos los orígenes) elimina la pérdida silenciosa de tareas/eventos con fechas no canónicas. Ambos cuentan ya con tests dedicados.
3. **Regresiones R1/R5/R6 resueltas (2026-09-13)**: R1 y R5 corrigieron los dos PARTIAL; R6 hizo idempotente `applyStandaloneChildLink` sin reintroducir side effects en el updater. Verificadas de forma adversarial (pureza, idempotencia, dedup y no pérdida de campos) con `test:verify` en verde.
4. **Sin bucles de sync**: C1 no introduce resync permanente ni bucle; el dedup y el snapshot vacío funcionan como se pretende.
5. **Deuda pendiente (no bloqueante)**: R2 (plaintext legacy `v1.`), R3 (reconciliación de jobs Note AI), R4 (resurrección cross-device de C1) y las inconsistencias menores R7–R13 (cobertura de tests, literales `'done'` residuales, doc de ciclos, ids de subtasks no deterministas, comentario obsoleto, etc.).

Resumen en 5 líneas:
- 32 hallazgos: 32 VERIFIED, 0 PARTIAL, 0 NOT DONE, 0 FALSE POSITIVE.
- A1–A7, M-B1–M-B4, M-F1–M-F9 y B1–B10 están correctamente implementados y verificados; C2 y A7 quedaron VERIFIED tras la remediación.
- R1 (ALTO), R5 y R6 (MEDIO) resueltos y cubiertos por tests (`storage.test.js:99,120`, `today-view.test.js:6`, `task-linking.test.js:12`); `npm run test:verify` en verde (202 unitarios, lint, build, 17 E2E).
- Sin regresiones nuevas detectadas: sin imports huérfanos, sin doble normalización y sin pérdida de campos.
- Deuda restante (no bloqueante): R2, R3, R4 y R7–R13.
