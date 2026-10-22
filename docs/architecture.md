# Arquitectura de Task Manager PWA

El frontend conserva React y props drilling. La API conserva sus URLs, cookies,
formatos de sincronización y cifrado AES-GCM. No se añaden dependencias.

## Frontend

- `App.jsx`: compone la interfaz, los modos completo/rápido, navegación y acciones
  de tareas/notas/eventos. `uiMode` sigue siendo estado en memoria en App.
- `hooks/useSession.js`: autenticación, login/logout y verificación de sesión;
  notifica a App para limpiar su interfaz.
- `hooks/useWorkspace.js`: estado de los datos del workspace, perfiles y estados
  personalizados; carga y descarta respuestas de cargas canceladas. Expone
  `resetWorkspace`, `switchProfile`, `invalidateWorkspace`, `reloadWorkspace` y
  `saveStatuses` en lugar de los setters internos (`ready`, `hydratedSession`).
- `hooks/useCloudSync.js`: debounce, exclusión de escrituras concurrentes,
  seguimiento de cambios pendientes, reconexión y eventos de visibilidad.
  `resetSync` limpia el trabajo pendiente al cerrar la sesión.
- `api/`: clientes HTTP de autenticación, perfiles, Task AI, Note AI y reintentos
  de lectura. No contienen estado React.
- `data/localStore.js`: acceso a localStorage, claves por perfil y cache Note AI.
- `data/normalize.js`: normalización y validación de entidades y backups.
- `data/syncOps.js`: diferencias incrementales y snapshots; funciones puras.
- `data/cloudSync.js`: coordina almacenamiento local y API; mantiene snapshots
  separados por perfil para construir las operaciones incrementales.
- `storage.js`: fachada compatible con los imports anteriores. El código nuevo
  importa directamente el módulo responsable.

## Worker

`worker.js` sigue exportando `{ fetch, queue }` para Cloudflare. El manejador HTTP
aplica bootstrap, autenticación y contexto antes de despachar las rutas.

- `worker/routes/`: auth pública, workspaces, datos/sync, Task AI y Note AI.
  Cada manejador devuelve una Response o `null` si no reconoce la ruta.
- `worker/repositories/entities.js`: lectura, descifrado y preparación de upserts
  de tareas, notas y eventos. Las operaciones de sync se confirman con D1 batch.
- `worker/auth.js`: validación Google, tokens opacos y cookies de una hora.
- `worker/schema.js`: auto-migraciones y caché de bootstrap.
- `worker/profiles.js`: resolución de perfiles y cifrado/descifrado de metadata.
- `worker/taskAi.js`: generación, parsing y fallbacks determinísticos.
- `worker/rateLimits.js`: límites por usuario y limpieza de ventanas antiguas.
- `worker/http.js`, `entityIds.js`, `logging.js`: cabeceras, IDs y logs anonimizados.
- `noteAi/pipeline.js`: mantiene el pipeline de análisis, Vectorize y colas.

Los módulos del Worker no se importan desde el frontend. Los datos sensibles
se cifran exclusivamente en el servidor; las consultas conservan parámetros y
el aislamiento por usuario/perfil.

## Estilos

`index.css` importa en orden los tokens, estilos base y estilos de componentes.
Los estilos de Agenda, Command Menu, Task Sheet y Hoy viven junto a sus
componentes. Se cargan de forma anticipada para conservar exactamente la cascada
anterior y evitar diferencias entre vistas cargadas con React.lazy.

## Verificación

- `npm test`: pruebas unitarias y de integración sin dependencias adicionales.
- `tests/cloud-sync.test.js`: persistencia por perfil, deltas y reintentos.
- `tests/worker-routes.test.js`: HTTP contra SQLite real en memoria, cifrado,
  sync completo/incremental, aislamiento, perfiles, autenticación y rate limit.
- `npm run test:verify`: unitarios, lint y E2E existentes con Playwright.
- `npm run build`: compilación de producción.

Este refactor conserva el comportamiento anterior. Los problemas de resolución
de conflictos offline y de validación de sesión descritos en la revisión requieren
cambios funcionales independientes. Dos excepciones ya aplicadas en el cliente:
`checkSession` solo considera expirada la sesión ante un 401 (los 5xx son
transitorios) y el logout local se completa aunque `/api/logout` falle sin red.

## Notas extendidas

El tablero permite crear notas rápidas y extendidas. Las extendidas conservan el
mismo `title` y `text` cifrados y el mismo pipeline Note AI (etiquetas, resumen,
relaciones, búsqueda, duplicados, organización y RAG). `noteType` distingue
`quick` (también para notas anteriores) de `extended`; D1 lo guarda en
`note_type`, con auto-migración y participación en el hash de sincronización.
La tarjeta muestra hasta 180 caracteres; `ExtendedNoteModal` permite editar el
contenido completo, desplazarse, guardar y confirmar el descarte de cambios.
El guardado usa el flujo local y cloud existente; el aviso del modal confirma el
guardado en la app, mientras el indicador global informa del estado de sync.
Los límites de contexto de los modelos Note AI existentes siguen aplicándose;
el texto persistido no se recorta.

### Revisión de la experiencia de edición

- Las notas extendidas nuevas se incorporan al tablero al guardar por primera
  vez; cerrar o descartar una creación no deja tarjetas vacías.
- El editor mantiene visibles las acciones mientras el contenido y el panel de
  etiquetas/resumen se desplazan. Incluye recuento de palabras y caracteres,
  Ctrl+S/Command+S y aviso del navegador ante una recarga con cambios pendientes.
- El descarte coloca el foco en «Seguir editando». El foco inicial de los modales
  respeta la interacción si el usuario ya ha empezado a escribir.
- «Ampliar» convierte una nota rápida conservando su ID, contenido y metadata.
  Los botones de creación comparten tamaños y forma con los del tablero.
- El tablero se reinicia al cambiar de perfil para aislar el editor abierto.

La selección de tarjetas, resultados y relaciones conserva el panel de notas relacionadas. El editor extendido solo se abre con el botón explícito «Abrir ↗» de la tarjeta.

## Relevancia de Note AI

Las etiquetas de respaldo filtran palabras vacías en español/inglés y priorizan
hashtags explícitos, entidades, título y términos destacados del contenido.
Las respuestas parciales del modelo conservan los campos válidos, sin fallar
cuando faltan listas de entidades. El esquema de análisis/vector se incrementa
para reanalizar notas existentes al volver a abrir Notas (en lotes).

La búsqueda consulta el texto descifrado del perfil antes de usar vectores:
las consultas de uno o dos términos significativos exigen coincidencias de
palabras completas, sin distinguir tildes. Para consultas más largas combina
coincidencias de texto con resultados semánticos de score mínimo 0.6. Las
coincidencias textuales se ordenan primero, incluso si la nota aún no tiene
embedding. El umbral es una regla conservadora, no una calibración medida en
producción. No se mezclan notas de distintos perfiles.

El grafo, el panel del tablero y la API de relacionadas complementan la metadata
con solapamiento de términos significativos (Jaccard >= 0.25, top 6 por nota).
Esto enlaza notas cortas como «Prueba»/«otra prueba» sin depender de la cola o
Vectorize; un título común por sí solo no basta para enlazar contenido largo
sin relación. Este solapamiento no se usa como prueba de duplicidad.
