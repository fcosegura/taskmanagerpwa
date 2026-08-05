# agents.md — Task Manager PWA

> Guía comprensiva del proyecto para agentes de IA. Lee este archivo completo antes de modificar cualquier código.

---

## 1. Visión General

**Task Manager PWA** es una aplicación de gestión de tareas de tipo Progressive Web App (PWA) con soporte offline, sincronización en la nube, y funcionalidades de IA. Permite gestionar tareas, eventos de calendario y notas adhesivas con múltiples vistas (lista, Kanban, calendario, timeline, tablero de notas, vista hoy, agenda diaria).

### Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 (JSX, sin TypeScript) |
| Build | Vite 8 |
| Backend / API | Cloudflare Worker (`src/worker.js`) |
| Base de datos | Cloudflare D1 (SQLite) |
| IA | Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct`) |
| Autenticación | Google OAuth (Sign In with Google) + sesiones HttpOnly opacas |
| Cifrado | AES-256-GCM field-level en el Worker (`d1-field-crypto.js` + Web Crypto API) |
| PWA | Service Worker (`public/sw.js`) + `manifest.json` |
| Tests unitarios | Node.js built-in test runner (`node --test`) |
| Tests E2E | Playwright (Chromium) |
| CI/CD | GitHub Actions |
| Linting | ESLint 9 (flat config) + Husky pre-push |
| Deploy | `wrangler deploy` a Cloudflare Workers |

### Lenguaje

- **Código**: Inglés (variables, funciones, nombres de archivos).
- **Comentarios**: Mezcla español/inglés. Respetar el idioma existente al modificar.
- **UI**: Español (labels, mensajes, fechas).

---

## 2. Estructura del Proyecto

```
taskmanagerpwa/
├── index.html                  # Entry point HTML (SPA)
├── package.json                # Dependencias y scripts npm
├── vite.config.js              # Configuración de Vite (React plugin, manual chunks)
├── wrangler.toml               # Configuración Cloudflare Worker + D1 + Workers AI
├── schema.sql                  # Schema DDL para Cloudflare D1
├── eslint.config.js            # ESLint flat config (React, hooks, a11y)
├── playwright.config.ts        # Configuración Playwright E2E
├── .env.example                # Variable: VITE_GOOGLE_CLIENT_ID
│
├── src/
│   ├── main.jsx                # Entry point React + registro de Service Worker + detección de updates
│   ├── App.jsx                 # ⭐ Componente raíz (~85KB). Todo el estado vive aquí.
│   ├── App.css                 # Estilos específicos de App
│   ├── index.css               # ⭐ Estilos globales (~79KB). Sistema de diseño completo.
│   ├── ui-cleanup.css          # Estilos adicionales de limpieza UI
│   ├── worker.js               # ⭐ Cloudflare Worker (~67KB). API completa + auth + sync + cifrado.
│   ├── storage.js              # ⭐ Capa de persistencia (localStorage + sync cloud + AI + auth client)
│   ├── constants.js            # Constantes: statuses, prioridades, categorías, normalización
│   ├── utils.jsx               # Utilidades: IDs, fechas, parsing NLP, linkificación
│   ├── d1-field-crypto.js      # Cifrado AES-256-GCM + hashing SHA-256 + snapshots (usado por el Worker)
│   ├── focusRecommendation.js  # Algoritmo de recomendación de foco (scoring determinístico)
│   ├── calendarEvents.js       # Expansión de eventos recurrentes + indexado por fecha
│   ├── calendarTaskIndex.js    # Índice de tareas por fecha (indexTasksByDate)
│   ├── dailyStatusActivities.js # Recolección y partición de actividades para daily status
│   ├── dailyStatusFallback.js  # Daily status markdown sin IA (fallback Scrum report)
│   ├── plannedSlots.js         # Validación y normalización de bloques de tiempo
│   ├── statusLog.js            # Registro auditado de cambios de estado (max 100 entries)
│   ├── taskSorter.js           # Comparador multi-nivel de tareas (grupo + prioridad)
│   ├── taskStatusCascade.js    # Cascada de estado padre→hijos (blocked, paused, done)
│   ├── kanbanDoneRange.js      # Filtro de tareas done por ventana temporal
│   ├── kanbanTaskLimit.js      # WIP limits + colapso de columnas (5 tareas visible)
│   ├── kanbanTaskVisibility.js # Visibilidad de hijos en columna Done del Kanban
│   ├── jiraTicket.js           # Parsing, formateo y herencia de tickets Jira
│   ├── todayViewHelpers.js     # Sanitización de descripciones (oculta payloads cifrados)
│   ├── taskTrashHelpers.js     # Helpers de papelera (conteo de hijos abiertos al borrar)
│   │
│   ├── core/
│   │   └── history/
│   │       ├── undoManager.js  # Undo transaccional (una tx activa, auto-expire 6s)
│   │       └── UndoToast.jsx   # Toast de deshacer suscrito al undoManager
│   │
│   ├── components/
│   │   ├── KanbanView.jsx      # Vista Kanban con drag-and-drop y filtrado Epic/Sub-task
│   │   ├── CalendarView.jsx    # Vista calendario mensual con festivos españoles
│   │   ├── TasksView.jsx       # Vista lista con búsqueda, filtros, quickAdd e IA
│   │   ├── TodayView.jsx       # Vista de hoy con recomendación de foco y progreso
│   │   ├── TimelineView.jsx    # Vista timeline/auditoría cronológica de status
│   │   ├── DailyAgendaView.jsx # Vista agenda diaria/semanal con time slots (06:00-22:00)
│   │   ├── BoardView.jsx       # Tablero de notas adhesivas con Pointer Events
│   │   ├── TaskModal.jsx       # Modal crear/editar tarea (NLP dates, IA parsing, Jira)
│   │   ├── EventModal.jsx      # Modal crear/editar evento (recurrencia, colores)
│   │   ├── TaskRow.jsx         # Componente de fila de tarea reutilizable (lista y board)
│   │   ├── TaskPreviewModal.jsx # Preview read-only con audit trail de statusLog
│   │   ├── TaskSheetDrawer.jsx # Slide-over drawer de edición de tarea
│   │   ├── TaskTrashDropZone.jsx # Zona drop de papelera (Lista/Kanban) con confirmación
│   │   ├── CommandMenu.jsx     # Paleta de comandos (Cmd+K) con navegación por teclado
│   │   ├── Login.jsx           # Pantalla de login con Google Identity Services
│   │   ├── BottomNav.jsx       # Navegación inferior mobile + botón Quick Add central
│   │   ├── SettingsModal.jsx   # Focus Mode priorities + densidad visual
│   │   ├── StatusManagerModal.jsx # CRUD de statuses personalizados con kinds/themes
│   │   ├── ExternalAppDrawer.jsx # Drawer con iframe de MyNotebook + postMessage
│   │   ├── AgendaPlanModal.jsx  # Modal de time-blocking para asignar planned slots
│   │   ├── StatusChangeCommentModal.jsx # Comentario obligatorio al cambiar status
│   │   ├── PriorityPickerModal.jsx     # Selector rápido de prioridad visual
│   │   ├── DailyStatusDaysModal.jsx    # Selector de días (1-7) para daily status
│   │   ├── DailyStatusResultModal.jsx  # Visualización y copia del daily status report
│   │   ├── CopyTicketButton.jsx        # Botón copiar ticket Jira al clipboard
│   │   ├── Toast/              # Sistema de toasts unificado (useToasts + ToastContainer)
│   │   ├── shared/
│   │   │   └── index.jsx       # Pill, CategoryPill, NBtn, Chip + re-exports de ui/
│   │   └── ui/
│   │       └── index.jsx       # Button, IconButton, Input, Modal, Sheet (design system)
│   │
│   ├── hooks/
│   │   └── useModalDialog.js   # Hook: focus trap, Escape, focus restore, tab cycling
│   │
│   └── assets/                 # Assets estáticos (importados por Vite)
│
├── public/
│   ├── manifest.json           # PWA manifest (standalone, es, productivity)
│   ├── sw.js                   # Service Worker v4 (estrategias diferenciadas)
│   ├── icon-192.png / icon-512.png  # Iconos PWA (any maskable)
│   ├── screenshot-wide.png / screenshot-narrow.png  # Screenshots PWA (wide/narrow)
│   ├── favicon.svg             # Favicon
│   └── icons.svg               # Sprite SVG de iconos de la app
│
├── tests/                      # Tests unitarios (node --test)
│   └── *.test.js               # 21 archivos de test
│
├── e2e/                        # Tests E2E (Playwright)
│   ├── app.spec.ts             # Escenarios completos de la app
│   └── api-mock.ts             # Mock stateful in-memory de API
│
├── scripts/
│   └── debounced-vite-build.mjs # Watcher src/ con debounce 4s (evita SQLITE_BUSY)
│
├── .github/workflows/
│   └── e2e.yml                 # CI: test:verify en push/PR a main (timeout 20min)
│
├── .husky/
│   └── pre-push               # Hook: npm run test:verify (bypass: SKIP_HOOKS=1)
│
└── apps/                       # Sub-apps embebidas
    ├── taskmanager/             # (build de producción)
    └── mynotebook/              # App de notas embebida via iframe
```

---

## 3. Arquitectura

### 3.1 Patrón General

```
┌────────────────────────────────────────────────────┐
│              Frontend (React SPA)                   │
│  ┌──────────────────────────────────────────────┐  │
│  │             App.jsx (root)                   │  │
│  │  Estado centralizado via useState/useRef     │  │
│  │  React.lazy + Suspense para vistas           │  │
│  │  Props drilling a todos los componentes      │  │
│  └──────────┬───────────────────────────────────┘  │
│             │                                       │
│  ┌──────────▼───────────────────────────────────┐  │
│  │           storage.js                         │  │
│  │  localStorage (fuente de verdad local)       │  │
│  │  Sync incremental (ops: upserts/deletes)     │  │
│  │  Auth client (login/logout/checkSession)     │  │
│  │  AI client (parse/generate/dailyStatus)      │  │
│  └──────────┬───────────────────────────────────┘  │
│             │ fetch /api/* (con HttpOnly cookie)    │
└─────────────┼──────────────────────────────────────┘
              │
┌─────────────▼──────────────────────────────────────┐
│         Cloudflare Worker (worker.js)               │
│  ┌──────────────────────────────────────────────┐  │
│  │  Router manual (pathname + method)           │  │
│  │  Auth dual: session token + Google ID token  │  │
│  │  Security headers (CSP, COOP, X-Frame)       │  │
│  │  AES-GCM field encryption/decryption         │  │
│  │  Entity ID scoping (profileId::entityId)     │  │
│  │  Auto-migration de schema                    │  │
│  └──────────┬───────────────────────────────────┘  │
│             │                                       │
│  ┌──────────▼──────────┐  ┌─────────────────────┐  │
│  │   Cloudflare D1     │  │  Workers AI         │  │
│  │   (SQLite)          │  │  Llama 3.1 8B       │  │
│  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 3.2 Sin router de cliente

La app **no usa** React Router ni ningún router. Es un **SPA de una sola ruta** donde el estado `view` en `App.jsx` controla qué componente se renderiza. Las vistas se cargan con `React.lazy` + `Suspense`.

**Navegación desktop** (header con pills de sub-vista):

| Área | Sub-vistas |
|---|---|
| **Hoy** | `today` |
| **Tareas** | `tasks` (lista), `kanban` |
| **Calendario** | `calendar` (mes), `daily` (agenda) |
| **Notas** | `board` (tablero), `timeline` (cronología) |

**Navegación mobile**: `<BottomNav>` con tabs Hoy, Tareas, Calendario, Notas + botón central Quick Add.

### 3.3 State Management

**No se usa ninguna librería de estado** (ni Redux, ni Zustand, ni Context). Todo el estado reside en `App.jsx` mediante `useState`, `useRef`, `useCallback`, `useMemo`.

Estado principal en `App.jsx`:

| Estado | Tipo | Descripción |
|---|---|---|
| `tasks` | `Task[]` | Todas las tareas del perfil actual |
| `boardNotes` | `Note[]` | Notas adhesivas del perfil actual |
| `events` | `Event[]` | Eventos de calendario del perfil actual |
| `view` | `string` | Vista activa (`'today'`, `'tasks'`, `'kanban'`, `'calendar'`, `'daily'`, `'board'`, `'timeline'`) |
| `authenticated` | `null\|boolean` | `null` = verificando, `false` = no auth, `true` = logueado |
| `authVersion` | `number` | Trigger para recargar datos del cloud |
| `profiles` | `Profile[]` | Todos los workspaces del usuario |
| `activeProfileId` | `string` | Perfil/workspace activo |
| `statuses` | `Status[]` | Statuses del perfil (default + custom) |
| `filter` / `searchQuery` / `categoryFilter` | `string` | Filtros |
| `summaryFilter` | `string` | Filtro de resumen |
| `focusMode` / `focusPriorityLevels` | `boolean` / `string[]` | Modo foco y niveles |
| `density` | `string` | Densidad UI: `'comfortable'` o `'compact'` (localStorage `taskmanager_density`) |
| `syncState` | `string` | `'idle'`, `'saving'`, `'saved'`, `'error'`, `'offline'` |
| `theme` | `string` | `'light'` o `'dark'` |
| `isOnline` | `boolean` | Conectividad (`navigator.onLine` + eventos online/offline) |
| `installPromptEvent` | `Event\|null` | Evento `beforeinstallprompt` para instalar PWA |
| `sessionExpiredLoggedOut` | `boolean` | Muestra aviso en Login tras logout forzado por sesión expirada |
| `swUpdateAvailable` | `boolean` | Indica update del SW disponible |

**Fuera de React state (módulos dedicados)**:
- **Toasts**: `useToasts()` en `App.jsx` → cola de mensajes (`ToastContainer`)
- **Undo**: `undoManager.js` (singleton, una transacción activa con auto-expire 6s) + `UndoToast`

**Refs críticos** (para evitar re-renders y race conditions):

| Ref | Propósito |
|---|---|
| `latestPayloadRef` | Último payload `{tasks, boardNotes, events}` sin causar re-render |
| `lastSyncedPayloadRef` | JSON serializado del último payload sincronizado (dedup) |
| `syncInFlightRef` | Flag de sync activo (evita concurrencia) |
| `pendingSyncRef` | Flag de cambios pendientes durante sync |
| `syncDebounceTimerRef` | Timer del debounce de 2s |
| `syncNowRef` | Ref al método de sync inmediato |

---

## 4. Modelo de Datos

### 4.1 Base de Datos (D1 — schema.sql)

**Nota**: Los IDs de entidades en D1 usan scoping: `${profileId}::${entityId}`. El worker hace scope al guardar y unscope al devolver.

#### Tabla `tasks`
```sql
id TEXT PRIMARY KEY,           -- Formato: profileId::entityId
user_id TEXT NOT NULL,
profile_id TEXT NOT NULL,
name TEXT NOT NULL,            -- ⚠ Cifrado con AES-GCM en D1
url TEXT,                      -- ⚠ Cifrado
notes TEXT,                    -- ⚠ Cifrado
status TEXT NOT NULL,          -- No cifrado (necesario para queries)
priority TEXT NOT NULL,        -- No cifrado
category TEXT,                 -- ⚠ Cifrado
ticket_number TEXT,            -- ⚠ Cifrado
date TEXT,                     -- ⚠ Cifrado
end_date TEXT,                 -- ⚠ Cifrado
time TEXT,                     -- ⚠ Cifrado
planned_slots TEXT,            -- ⚠ Cifrado (JSON string)
subtasks TEXT,                 -- ⚠ Cifrado (JSON string: [{ id, name, done }])
dependencies TEXT DEFAULT '[]', -- ⚠ Cifrado (JSON string de ids)
hide_in_kanban_done INTEGER DEFAULT 0,
completed_at TEXT,             -- ⚠ Cifrado
status_log TEXT,               -- ⚠ Cifrado (JSON: [{ id, fromStatus, toStatus, comment, at }])
content_hash TEXT,             -- SHA-256 del snapshot plano
created_at DATETIME,
updated_at DATETIME
```

#### Tabla `notes`
```sql
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
profile_id TEXT NOT NULL,
title TEXT,                    -- ⚠ Cifrado
text TEXT,                     -- ⚠ Cifrado
x REAL,                        -- Posición X en el board (no cifrado)
y REAL,                        -- Posición Y en el board (no cifrado)
content_hash TEXT,
created_at DATETIME,
updated_at DATETIME
```

#### Tabla `events`
```sql
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
profile_id TEXT NOT NULL,
title TEXT NOT NULL,           -- ⚠ Cifrado
startDate TEXT NOT NULL,       -- ⚠ Cifrado
endDate TEXT,                  -- ⚠ Cifrado
color TEXT,                    -- ⚠ Cifrado
allDay INTEGER DEFAULT 1,     -- No cifrado
startTime TEXT,                -- ⚠ Cifrado
endTime TEXT,                  -- ⚠ Cifrado
recurrenceFrequency TEXT DEFAULT 'none', -- ⚠ Cifrado
recurrenceInterval INTEGER DEFAULT 1,    -- No cifrado
recurrenceUntil TEXT,          -- ⚠ Cifrado
recurrenceCount INTEGER,       -- No cifrado
content_hash TEXT,
created_at DATETIME,
updated_at DATETIME
```

#### Tabla `profiles`
```sql
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
name TEXT NOT NULL,            -- ⚠ Cifrado
custom_statuses TEXT,          -- ⚠ Cifrado (JSON string)
created_at DATETIME,
updated_at DATETIME
```

#### Tabla `sessions`
```sql
token TEXT PRIMARY KEY,        -- 64-char hex (32 random bytes)
user_id TEXT NOT NULL,
expires_at INTEGER NOT NULL    -- Unix timestamp (1 hora)
```

#### Tabla `ai_rate_limits`
```sql
user_id TEXT PRIMARY KEY,
window_start INTEGER NOT NULL,
request_count INTEGER NOT NULL DEFAULT 0
```

### 4.2 Statuses

Los statuses se clasifican por **kinds** con propiedades semánticas:

| Kind | `sortWeight` | `isTerminal` | `canBeFocused` | Ejemplo Default |
|---|---|---|---|---|
| `active` | 100 | false | true | `in_progress` |
| `backlog` | 50 | false | true | `not_done` |
| `waiting` | 20 | false | false | `paused` |
| `blocked` | 10 | false | false | `blocked` |
| `done` | 0 | true | false | `done` |

**Statuses por defecto:**

| id | label | kind | theme |
|---|---|---|---|
| `not_done` | Sin empezar | backlog | neutral |
| `in_progress` | En curso | active | info |
| `paused` | Pausado | waiting | warning |
| `blocked` | Bloqueado | blocked | danger |
| `done` | Hecho | done | success |

Los perfiles pueden agregar **statuses personalizados** via `StatusManagerModal`, asignando kind y theme.

**Statuses con cascada** (`PARENT_CASCADE_STATUSES`): `blocked`, `paused`, `done` — cuando un padre cambia a estos, sus hijos se actualizan automáticamente.

### 4.3 Prioridades

`critical` > `high` > `medium` > `low` (definidas en `P_ORDER`: critical=0, high=1, medium=2, low=3).

### 4.4 Categorías

Libres (string), con soporte especial para **categorías Jira** (auto-detección desde URLs de Jira). Se permite crear categorías inline en `TaskModal`.

---

## 5. API del Worker

Base URL: según entorno (`localhost:8788` en dev, dominio de producción en deploy).

Todas las respuestas incluyen **security headers** (CSP, COOP, X-Frame-Options: DENY, Permissions-Policy). Las rutas protegidas requieren autenticación via cookie de sesión.

### 5.1 Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/login` | No | Valida Google ID token, crea sesión de 1 hora, limpia sesiones expiradas |
| `POST` | `/api/logout` | No | Borra sesión de D1 y limpia cookie |
| `GET` | `/api/session` | Sí | Verifica que la sesión es válida (`{ authenticated: true }`) |

**Flujo de auth:**
1. Frontend usa Google Sign-In → obtiene JWT `credential`
2. POST a `/api/login` con el credential
3. Worker verifica JWT contra Google OAuth API (`oauth2.googleapis.com/tokeninfo`)
4. Crea sesión: token random hex 64 chars, almacenado en `sessions`, expira en **1 hora**
5. Cookie: `__Host-taskmanager_session` en producción (Secure, `__Host-` prefix) o `taskmanager_session` en localhost
6. Atributos: `HttpOnly; SameSite=Strict (prod) / Lax (local); Path=/; Max-Age=3600`
7. Frontend verifica sesión cada 60s y en `visibilitychange` via `checkSession()`

**Auth dual en `authenticate()`:**
1. Primero intenta validar como token opaco hex 64-chars contra tabla `sessions`
2. Si no es hex, intenta validación directa como Google ID Token via API de Google

### 5.2 Datos y Workspace

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/data?profileId=...` | Retorna tasks, notes, events y profiles del workspace. Descifra todos los campos. |
| `POST` | `/api/profiles` | Crea nuevo workspace (cifra el nombre) |
| `POST` | `/api/profiles/update` | Actualiza custom_statuses de un workspace (cifra) |
| `POST` | `/api/profiles/delete` | Borra workspace + todos sus datos (bloquea si es el último) |

### 5.3 Sincronización

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/sync` | Endpoint principal de sync |

**Modos de sync:**

1. **`payload` mode (Full Reset)**: Borra todas las entidades del perfil y reinserta el dataset completo del cliente.
2. **`ops` mode (Delta Sync)**: Ejecuta arrays de `deletes` (por ID) seguidos de `upserts` para tasks, notes, events.

**Content Hash Optimization:**
- Para cada entidad, el worker calcula `SHA-256` de un snapshot normalizado (`stableStringify` con claves ordenadas).
- Los upserts usan: `ON CONFLICT(id) DO UPDATE SET ... WHERE content_hash IS NOT excluded.content_hash OR content_hash IS NULL`.
- Esto evita escrituras innecesarias en D1 cuando los datos no han cambiado.

**Batch Processing**: Todas las statements se ejecutan atómicamente via `env.DB.batch(batch)`.

**Límites de payload** (`checkSyncLimits`): Max 8,000 tasks, 2,000 notes, 4,000 events por sync request.

### 5.4 IA

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/ai/parse-task` | Parsea texto libre a task struct (título, fecha, prioridad, tags) |
| `POST` | `/api/ai/generate-tasks` | Genera plan de tareas (main + child tasks) desde texto |
| `POST` | `/api/ai/daily-status` | Genera daily status Scrum report en español (markdown) |

**Modelo**: `@cf/meta/llama-3.1-8b-instruct` via Cloudflare Workers AI (`env.AI.run`).

**Rate limit**: **48 requests por ventana de 60 segundos** por usuario (tabla `ai_rate_limits`). Retorna 429 si excede.

**Fallbacks**: Cada endpoint de IA tiene un parser/generador determinístico de fallback que se activa si Workers AI falla, timeout, o retorna JSON inválido:
- `parseTaskFallback` — regex para extraer datos de texto
- `generateTaskPlanFallback` — generador basado en reglas
- `buildDailyStatusFallbackReport` — report markdown sin IA

### 5.5 Schema Auto-migration

El worker ejecuta auto-migraciones al recibir requests:
- `ensureSecuritySchema` — crea tablas `sessions` y `ai_rate_limits`
- `ensureProfilesSchema` — crea tabla `profiles` y agrega columnas nuevas via `ALTER TABLE`
- `ensureDefaultProfile` — crea perfil por defecto (`${userId}:work`, nombre "Trabajo") y migra filas legacy con `profile_id` NULL

---

## 6. Flujo de Datos y Sincronización

### 6.1 Persistencia Local

`storage.js` es la capa de persistencia. Keys en `localStorage`: `taskmanager_v1:<profileId>` (con fallback a `taskmanager_v1`).

```
Acción del usuario (ej: crear tarea)
    │
    ▼
App.jsx (applyTaskUpdate / commitStatusChange)
    │
    ├──► setState (tasks) — re-render inmediato
    │
    └──► latestPayloadRef.current actualizado
              │
              ▼ (debounced 2000ms o inmediato en hide/unload)
         syncNowRef.current()
              │
              ├──► serializePayload() vs lastSyncedPayloadRef (dedup)
              │    Si son iguales → skip
              │
              ├──► syncInFlightRef check (evita concurrencia)
              │
              ├──► localStorage.setItem() — persist local inmediato
              │
              └──► saveData() → POST /api/sync
                   Calcula ops incrementales (upserts/deletes)
                   contra lastCloudSnapshotByProfile
                        │
                        ▼
                   Worker cifra campos → content_hash → D1 batch
                        │
                        ▼
                   syncState → 'saved' (1.6s) → 'idle'
```

### 6.2 Sync Triggers

| Trigger | Comportamiento |
|---|---|
| Cambio en `tasks`/`boardNotes`/`events` | Debounce 2000ms |
| `visibilitychange` → `'hidden'` | Flush inmediato |
| `beforeunload` | Flush inmediato |
| Logout | Flush inmediato antes de cerrar sesión |

### 6.3 Dedup y Concurrencia

- **Dedup**: Se compara `JSON.stringify(payload)` con `lastSyncedPayloadRef.current`. Si son idénticos, se omite el sync.
- **Concurrencia**: Si hay un sync en vuelo (`syncInFlightRef.current`), se marca `pendingSyncRef.current = true`. Al completar, se ejecuta un sync de seguimiento inmediato.

### 6.4 Offline-First

- **Lecturas**: Siempre desde `localStorage`.
- **Escrituras**: localStorage primero, luego intento de cloud sync.
- **Sin conexión**: La app funciona completa. `saveData` falla silenciosamente.
- **Reconexión**: El próximo ciclo de sync envía el estado actual.

### 6.5 Cifrado de Campos (Field-Level Encryption)

`d1-field-crypto.js` es un módulo compartido de crypto (Web Crypto API) **usado por el Worker** al leer/escribir D1. El cliente (`storage.js`) **no cifra**: guarda plaintext en localStorage y envía plaintext al sync; el cifrado ocurre solo server-side antes de persistir en D1.

Implementa:

1. **`importDataEncryptionKey(secret)`** — importa clave AES-256 de 32 bytes via Web Crypto API
2. **`encryptField(plaintext, key)`** — AES-GCM con IV de 12 bytes → formato `v1.<base64(iv+ciphertext)>`
3. **`decryptField(ciphertext, key)`** — reverso
4. **`stableStringify(obj)`** — JSON con claves ordenadas (determinístico)
5. **`sha256HexOfUtf8(str)`** — SHA-256 hex digest para `content_hash`
6. **`buildTaskPlainSnapshot(task)`** / **`buildNotePlainSnapshot`** / **`buildEventPlainSnapshot`** — constructores de snapshots normalizados

**Campos cifrados en D1** (los no-cifrados se mantienen para queries/indexes):
- **Tasks**: `name`, `url`, `notes`, `ticket_number`, `completed_at`, `category`, `date`, `end_date`, `time`, `subtasks`, `dependencies`, `planned_slots`, `status_log`
- **Notes**: `title`, `text`
- **Events**: `title`, `startDate`, `endDate`, `color`, `startTime`, `endTime`, `recurrenceFrequency`, `recurrenceUntil`
- **Profiles**: `name`, `custom_statuses`

**No cifrados** (para indexación y queries): `id`, `user_id`, `profile_id`, `status`, `priority`, `hide_in_kanban_done`, `x`, `y`, `allDay`, `recurrenceInterval`, `recurrenceCount`, `content_hash`, timestamps.

---

## 7. Componentes Clave

### 7.1 Vistas Principales

| Componente | Archivo | Descripción |
|---|---|---|
| `TodayView` | `components/TodayView.jsx` | Dashboard diario con recomendación de foco, overdue, schedule, progreso. Usa `recommendNextFocusTask`. |
| `TasksView` | `components/TasksView.jsx` | Lista con búsqueda, filtros (status chips, category chips), quickAdd, AI suggest, dependencias jerárquicas expand/collapse, papelera drag-and-drop. |
| `KanbanView` | `components/KanbanView.jsx` | Kanban con drag-and-drop para mover status o crear dependencias padre-hijo. Filtrado Epic vs Sub-task. Columnas colapsables. Papelera drag-and-drop. |
| `CalendarView` | `components/CalendarView.jsx` | Calendario mensual con festivos españoles. Tasks/events por fecha. Panel lateral con detalle del día. |
| `DailyAgendaView` | `components/DailyAgendaView.jsx` | Agenda 1-día o 7-días (06:00-22:00) con time slots, events, planned slots. Línea roja de hora actual. |
| `BoardView` | `components/BoardView.jsx` | Canvas de notas adhesivas con drag via Pointer Events (`setPointerCapture`). Edición inline. |
| `TimelineView` | `components/TimelineView.jsx` | Timeline de auditoría cronológica: creación, cambios de status, completados. Sidebar de selección. |

### 7.2 Modales y Drawers

| Componente | Trigger | Propósito |
|---|---|---|
| `TaskModal` | Crear/editar tarea | Formulario completo: NLP dates, AI parsing, Jira auto-detect, subtareas, dependencias |
| `EventModal` | Crear/editar evento | Formulario con recurrencia (daily/weekly/monthly), colores, all-day toggle |
| `TaskPreviewModal` | Click en tarea | Vista read-only con audit trail de statusLog y dependencias |
| `TaskSheetDrawer` | Editar tarea (slide-over) | Drawer lateral para edición con focus trap |
| `CommandMenu` | Cmd/Ctrl+K | Paleta de comandos: navegación, acciones, densidad, búsqueda de tareas |
| `StatusManagerModal` | Desde gestión de workspace | CRUD de statuses personalizados con kinds y themes |
| `SettingsModal` | Configuración | Focus mode priority levels + densidad visual (cómodo/compacto) |
| `AgendaPlanModal` | Time-blocking | Asignar tareas a time slots en la agenda |
| `StatusChangeCommentModal` | Cambio de status | Comentario obligatorio con shortcut Enter |
| `PriorityPickerModal` | Click en prioridad | Selector visual rápido |
| `DailyStatusDaysModal` | Generar status | Selector de días (1-7) |
| `DailyStatusResultModal` | Ver status generado | Visualización + copy to clipboard |
| `ExternalAppDrawer` | Abrir MyNotebook | Drawer lateral resizable con iframe + postMessage |
| `TaskTrashDropZone` | Drag en Lista/Kanban | Zona de papelera: drop → confirmación → `del()` (respeta parent blocking) |

### 7.3 Design System (`components/ui/` y `components/shared/`)

**Primitivas (`ui/index.jsx`)**:
- `Button` — ForwardRef con variantes: `primary`, `ghost`, `danger`
- `IconButton` — Botón con `aria-label`
- `Input` — Input con label wrapper
- `Modal` — Backdrop dialog (`role="dialog"`, `aria-modal="true"`)
- `Sheet` — Drawer/sheet con card header

**Domain-specific (`shared/index.jsx`)**:
- `Pill` — Badge de status/prioridad con CSS vars
- `CategoryPill` — Badge de categoría con tooltip
- `NBtn` — Botón de navegación con icono
- `Chip` — Chip de filtro con count y estado activo

**Feedback (`Toast/` + `core/history/`)**:
- `useToasts` / `ToastContainer` — cola unificada de toasts (`success` / `error` / `info` / `warning`), auto-dismiss, máx. ~5 visibles
- `undoManager` / `UndoToast` — undo transaccional desacoplado del estado React (una tx activa)

### 7.4 Hook: `useModalDialog(isOpen, onClose, initialFocusRef, closeOnEscape)`

- **Focus capture**: Recuerda `document.activeElement` al abrir
- **Initial focus**: Mueve foco a `initialFocusRef`, primer elemento focusable, o el contenedor
- **Focus trap**: Cicla Tab/Shift+Tab dentro del modal
- **Escape**: Cierra el modal (configurable)
- **Focus restore**: Restaura foco al elemento previo al cerrar

> **Convención**: Todos los modales usan `useModalDialog` para accesibilidad. **No** se usa `<dialog>` nativo directamente.

---

## 8. Módulos de Lógica de Negocio

### 8.1 `focusRecommendation.js` — Algoritmo de Recomendación de Foco

Función: `recommendNextFocusTask(tasks, statuses)`

Scoring determinístico multi-nivel:

| Factor | Puntos |
|---|---|
| **Horizonte**: Overdue | +100 |
| **Horizonte**: Hoy | +80 |
| **Horizonte**: Futuro/sin fecha | +0 |
| **Status Kind**: active | +40 |
| **Status Kind**: backlog | +0 |
| **Status Kind**: waiting | -60 |
| **Status Kind**: blocked | -80 |
| **Prioridad**: critical | +30 |
| **Prioridad**: high | +20 |
| **Prioridad**: medium | +10 |
| **Prioridad**: low | +5 |
| **Proximidad temporal**: dentro de 2h | +15 |
| **Proximidad temporal**: 2-6h | +10 |
| **Proximidad temporal**: más tarde hoy | +5 |

Filtra candidatos con `canBeFocused: true` y no terminales. Retorna top 1 con `reason` y `reasonCode` human-readable.

### 8.2 `taskStatusCascade.js` — Cascada de Estado

- `shouldCascadeStatusToChildren(newStatus)` — true si status está en `PARENT_CASCADE_STATUSES` (`blocked`, `paused`, `done`)
- `applyStatusWithChildCascade(tasks, parentId, newStatus)` — actualiza parent + todos los hijos recursivamente. Gestiona `completedAt`.

### 8.3 `taskSorter.js` — Ordenación Multi-nivel

`compareTasksForTaskList(a, b)` ordena tareas en 6 grupos:
1. Active Jira tasks (grupo 0)
2. Active standard tasks (grupo 1)
3. Blocked/Paused Jira (grupo 2)
4. Blocked/Paused standard (grupo 3)
5. Completed Jira (grupo 4)
6. Completed standard (grupo 5)

Dentro del grupo: por prioridad (critical > high > medium > low).

### 8.4 `statusLog.js` — Audit Log

- Max 100 entries (`MAX_STATUS_LOG_ENTRIES`)
- Formato: `{ id, fromStatus, toStatus, comment, at (ISO) }`
- `appendStatusLogEntry()` — agrega entry validada al array

### 8.5 `calendarEvents.js` — Eventos Recurrentes

- `buildEventOccurrences(event, rangeStart, rangeEnd)` — expande daily/weekly/monthly con `recurrenceUntil` y `recurrenceCount`
- `indexEventsByDate(events, rangeStart, rangeEnd)` — `Map<'YYYY-MM-DD', Event[]>` expandiendo multi-day y recurrentes

### 8.6 `plannedSlots.js` — Bloques de Tiempo

- `isValidPlannedSlot(slot)` — valida `{ id, date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM) }`, `endTime > startTime`
- `normalizePlannedSlots(slots)` — deduplica y ordena cronológicamente
- `plannedSlotsStableJson(slots)` — JSON estable para hashing

### 8.7 `dailyStatusActivities.js` — Actividades para Daily Status

- `collectDailyStatusActivities(tasks, startMs, endMs)` — escanea `statusLog` en ventana temporal
- `partitionDailyStatusActivities(activities)` — particiona en secciones Scrum: `doneInPeriod`, `activeNow`, `blocked`

### 8.8 `jiraTicket.js` — Integración Jira

- `extractJiraTicketFromUrl(url)` — regex para `/browse/PROJECT-123`
- `getJiraTaskDefaultsFromUrl(url)` — defaults (Category: "Jira Task", Priority: "high")
- `applyTicketNumberToTaskName(name, ticket)` — agrega `[TICKET-ID]` sin duplicar
- `inheritTicketFromParentTask(child, parent)` — herencia de ticket padre a hijo

### 8.9 `todayViewHelpers.js`

- `getDisplayDescription(notes)` — sanitiza notas ocultando payloads cifrados (prefijos `v1.`, `eyJ`, tokens >30 chars sin espacio)

### 8.10 Kanban Helpers

- **`kanbanDoneRange.js`**: Filtro de completados por rango (`week`, `two_weeks`, `month`, `all`). Calcula inicio de semana ISO (lunes).
- **`kanbanTaskLimit.js`**: `KANBAN_COLLAPSED_TASK_LIMIT = 5`. Ordena por recencia de entrada al status (via `statusLog`). Colapsa columnas mostrando solo 5 tareas.
- **`kanbanTaskVisibility.js`**: En columna Done, muestra root tasks done pero oculta child tasks si su padre ya está done.

### 8.11 `core/history/undoManager.js` — Undo Transaccional

- Una sola transacción activa: `{ id, description, rollbackFn, expiresAt }`
- `pushUndoTransaction({ description, rollbackFn, timeoutMs? })` — reemplaza la tx previa; auto-expire por defecto **6s**
- `performUndo()` — ejecuta `rollbackFn` y limpia
- `clearUndoTransaction()` — limpia sin rollback (cambio de workspace, import, logout)
- UI: `UndoToast.jsx` se suscribe via `subscribeToUndo`

Usado al eliminar tareas/notas/eventos y al convertir nota → tarea.

### 8.12 `taskTrashHelpers.js` — Papelera

- `countOpenChildTasks(parentTask, allTasks)` — cuenta hijos abiertos (misma regla que parent blocking en `del()`)

---

## 9. Funcionalidades Especiales

### 9.1 Focus Mode

- Filtra tareas por prioridades configuradas (`focusPriorityLevels`: `high`, `critical` por defecto)
- **Recursión de dependencias**: incluye automáticamente TODAS las tareas hijas (dependencies) de las tareas filtradas, sin importar la prioridad de los hijos

### 9.2 Parent Task Blocking

- Un parent task **no puede** moverse a `done` ni **eliminarse** si tiene hijos abiertos (no-done)
- Se muestra un toast (`showParentBlockedMessage` via `showToast`) y se bloquea la operación

### 9.3 Drag-and-Drop para Dependencias

- En las vistas Lista y Kanban, arrastrar una tarea standalone sobre otra crea una relación padre-hijo
- `linkStandaloneTaskAsChild(sourceTaskId, targetTaskId)` — valida links circulares e inválidos, hereda ticket Jira

### 9.4 Papelera (Task Trash Drop Zone)

- En Lista y Kanban: zona de drop visible al arrastrar una tarea
- Drop → modal de confirmación (detalla subtareas/deps); si hay hijos abiertos, salta al parent blocking toast
- Tras borrar: undo disponible ~6s via `UndoToast`

### 9.5 Densidad Visual

- `comfortable` (default) o `compact`, persistido en `localStorage` (`taskmanager_density`)
- Aplicado como `data-density` en `.app-shell`
- Configurable desde Settings y Command Menu (`sys-density`)

### 9.6 AI Task Parsing

- `parseTaskWithAI(text)` → extrae título, fecha, hora, categoría, prioridad de texto libre
- `generateTasksFromText(text)` → genera plan con main tasks + child tasks, muestra preview modal antes de confirmar
- `generateDailyStatus(activities, days)` → genera report Scrum en español vía IA

### 9.7 Data Export/Import

- **Export JSON**: Backup single-workspace (legacy) o multi-workspace v2 (todos los workspaces)
- **Import JSON**: Valida y restaura backups. Multi-workspace import crea nuevos workspaces y recarga.
- **Metadata preservada**: custom statuses con `kind`, `isTerminal`, `canBeFocused`, `sortWeight`, `theme`

### 9.8 Session Liveness y Offline UX

- `checkSession()` cada 60s + en `visibilitychange` a `'visible'`
- Si sesión expira en servidor → `forceLogout()` limpia todo, marca `sessionExpiredLoggedOut` y muestra Login con aviso
- Banner offline cuando `!isOnline`; `syncState` puede ser `'offline'`
- Prompt de instalación PWA via `beforeinstallprompt` (si no está instalada)

### 9.9 Undo

- Acciones destructivas registran snapshot + `rollbackFn` en `undoManager`
- `clearUndoTransaction()` al cambiar workspace, importar o logout (evita rollbacks cruzados)

---

## 10. Estilos y Diseño

### 10.1 Archivos CSS

| Archivo | Propósito | Tamaño |
|---|---|---|
| `src/index.css` | Sistema de diseño global: variables, dark mode, density, componentes, layouts, responsive | ~79KB |
| `src/App.css` | Estilos específicos del componente App | ~3KB |
| `src/ui-cleanup.css` | Ajustes adicionales de limpieza visual | ~14KB |
| `src/components/TimelineView.css` | Estilos del timeline | ~12KB |
| `src/components/ExternalAppDrawer.css` | Estilos del drawer de apps externas | ~4KB |

### 10.2 Convenciones CSS

- **Vanilla CSS** — No usa Tailwind, SASS, ni CSS-in-JS
- **Variables CSS** para temas (light/dark)
- **Dark mode**: clase en root + variables CSS
- **Densidad**: atributo `data-density="comfortable|compact"` en `.app-shell`
- **Responsive**: media queries
- Status pills usan CSS vars del status definition (`bv`, `tv`, `label`)

---

## 11. Autenticación y Seguridad

### 11.1 Security Headers (Worker)

Aplicados a TODAS las respuestas via `withSecurityHeaders`:
- **CSP**: Permite Google Auth scripts/frames, self-hosted assets, inline styles, Google avatar images
- **COOP**: `same-origin-allow-popups`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY`
- **Permissions-Policy**: Bloquea camera, microphone, geolocation, payment

### 11.2 Cookie de Sesión

| Aspecto | Producción | Local |
|---|---|---|
| Nombre | `__Host-taskmanager_session` | `taskmanager_session` |
| HttpOnly | ✅ | ✅ |
| Secure | ✅ | ❌ |
| SameSite | Strict | Lax |
| Max-Age | 3600 (1 hora) | 3600 |
| `__Host-` prefix | ✅ (fuerza Secure + Path=/) | ❌ |

### 11.3 Log Anonymization

El worker anonimiza user IDs en logs usando SHA-256 truncado (`shortHashForLog`) en lugar de emails en plaintext.

---

## 12. PWA y Service Worker

### 12.1 Manifest (`public/manifest.json`)

- `display: "standalone"` — Sin barra de navegador
- `theme_color: "#2563eb"` — Azul
- `background_color: "#eef3fb"` — Azul claro
- `lang: "es"` — Español
- `categories: ["productivity", "utilities"]`
- Iconos: 192px y 512px (`any maskable`)

### 12.2 Service Worker (`public/sw.js`) — Versión `taskmanager-v4`

| Tipo de Request | Estrategia |
|---|---|
| `/api/*` | **Network Only** (nunca cachear sync/workspace data) |
| CDNs externos | Network First → fallback cache |
| Navegación (`request.mode === 'navigate'`) | Network First → cache → fallback `/index.html` (SPA offline) |
| Assets estáticos (mismo origen) | Cache First → fallback network |

- **Pre-cache on install**: `/`, `/index.html`, `/manifest.json`, iconos
- **`skipWaiting()`** + **`clients.claim()`** en activación
- **Purga** de caches antiguas en activación

### 12.3 SW Update Detection

En `main.jsx`:
1. Registra `/sw.js`
2. Escucha `updatefound` + `statechange` del nuevo SW
3. Dispatcha `window.dispatchEvent(new Event('taskmanager-sw-update'))`
4. `App.jsx` escucha el evento y muestra banner de recarga

---

## 13. Testing

### 13.1 Tests Unitarios

- **Runner**: Node.js built-in (`node --test`)
- **Comando**: `npm test`
- **Ubicación**: `tests/*.test.js` (21 archivos)
- **Sin dependencias** de testing (no Jest, no Vitest, solo `node:assert` y `node:test`)
- **Cobertura**: storage, focus recommendation, daily status, kanban helpers, task sorting, status cascade, today view, jira ticket, status log, calendar tasks, command menu, copy ticket, external app drawer, task sheet drawer, status change comment modal, density, task trash drop zone, undo manager

### 13.2 Tests E2E

- **Framework**: Playwright (`@playwright/test`)
- **Comando**: `npm run test:e2e`
- **Browser**: Chromium (desktop)
- **Server**: `npm run build && npm run preview` en port 4173
- **Parallel**: `fullyParallel: true`
- **Retries**: 0 local, 2 en CI
- **Tracing**: on-first-retry

**API Mock** (`e2e/api-mock.ts`):
- Backend in-memory stateful (`Map` para profiles y tasks por profile)
- Mockea: `/api/session`, `/api/data`, `/api/sync`, `/api/profiles/*`, `/api/logout`
- Deshabilita Service Worker via `page.addInitScript`
- Soporte para `installUnauthorizedMocks` (simular sesión expirada)

**Escenarios cubiertos**:
- Auth simulada y sesión expirada (401)
- CRUD de tareas (crear desde modal, quickAdd, comentarios en cambio de status)
- Navegación entre vistas
- MyNotebook drawer (abrir/cerrar con Escape)
- Creación desde vista Hoy con fecha preseleccionada
- Edición de tareas sin duplicados
- Cierre de drawers/modales con Escape
- Cambio entre workspaces con actualización de estado
- Export/Import multi-workspace JSON con custom statuses metadata
- Recomendación de foco y cambio rápido de status

### 13.3 Verificación Completa

```bash
npm run test:verify   # = npm test && npm run lint && npm run test:e2e
```

Ejecutado automáticamente en:
- **Pre-push** (Husky hook) — bypass: `SKIP_HOOKS=1 git push` o `HUSKY=0`
- **CI** (GitHub Actions `e2e.yml`) — push a `main` y PRs, timeout 20min, ubuntu-latest, Node 22

---

## 14. Desarrollo Local

### 14.1 Requisitos

- Node.js ≥ 22
- npm

### 14.2 Setup

```bash
npm install
cp .env.example .env           # Configurar VITE_GOOGLE_CLIENT_ID
```

### 14.3 Scripts

| Script | Comando | Descripción |
|---|---|---|
| Frontend dev | `npm run dev` | Vite dev server (HMR, sin worker) |
| Worker dev | `npm run dev:worker` | Build + D1 schema + Wrangler dev local (port 8788) |
| Worker dev live | `npm run dev:worker:live` | Como dev:worker con rebuild debounced (4s) |
| Build | `npm run build` | Vite production build → `dist/` |
| Lint | `npm run lint` | ESLint (React, hooks, a11y) |
| Tests unitarios | `npm test` | Node.js test runner |
| Tests E2E | `npm run test:e2e` | Playwright (requiere build previo) |
| E2E UI mode | `npm run test:e2e:ui` | Playwright con UI interactiva |
| Verificación | `npm run test:verify` | Tests + lint + E2E |
| Deploy | `npm run deploy` | Build + wrangler deploy |

### 14.4 Variables de Entorno

| Variable | Dónde | Uso |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | `.env` | Client ID de Google OAuth (frontend) |
| `GOOGLE_CLIENT_ID` | `wrangler.toml` [vars] | Mismo valor (worker) |
| `DATA_ENCRYPTION_KEY` | Wrangler secret | Clave AES-256 (32 bytes). `wrangler secret put DATA_ENCRYPTION_KEY` |

### 14.5 Worker en Local

1. `vite build` genera `dist/`
2. `wrangler d1 execute task-manager-db --local --file=schema.sql` aplica schema
3. Worker auto-migra tablas faltantes y columnas nuevas (`ALTER TABLE`)
4. `wrangler dev --local` inicia worker con Assets binding a `dist/` y D1 emulado (SQLite local)

**Nota**: El script `debounced-vite-build.mjs` observa `src/` y ejecuta `vite build` con debounce de 4s para evitar errores `SQLITE_BUSY` por recargas excesivas de Wrangler.

---

## 15. Deploy

```bash
npm run deploy   # = vite build && wrangler deploy
```

- **Destino**: Cloudflare Workers
- **Assets**: `[assets]` binding desde `dist/`
- **D1**: Base de datos con schema auto-migrado
- **Workers AI**: Binding `[ai]` con `remote = true`
- **Secretos**: `DATA_ENCRYPTION_KEY` via `wrangler secret put`

---

## 16. CI/CD (GitHub Actions)

**Workflow**: `.github/workflows/e2e.yml`

| Campo | Valor |
|---|---|
| Triggers | Push a `main`, PRs |
| Runner | `ubuntu-latest` |
| Node | 22 (con caché npm) |
| Timeout | 20 minutos |
| Steps | checkout → setup node → `npm ci` → install Playwright Chromium → `npm run test:verify` |
| On failure | Upload `playwright-report/` y `test-results/` (7 días) |

**Branch protection recomendada**: Requerir que el job "Playwright E2E" pase antes de merge a `main`.

---

## 17. Convenciones de Código

### 17.1 Generales

- **JavaScript puro** (no TypeScript). Componentes usan `.jsx`, lógica usa `.js`.
- **ESModules** (`"type": "module"` en package.json).
- **App.jsx contiene TODO el estado**. No refactorizar a Context/Redux sin aprobación explícita.
- **Props drilling** es el patrón establecido.
- **React.lazy + Suspense** para code-splitting de vistas.
- **Vite manual chunks**: `vendor-react`, `vendor-react-dom`, `vendor-chrono`.

### 17.2 Componentes

- Componentes funcionales con hooks.
- Modales usan `useModalDialog` hook (focus trap, no `<dialog>` nativo).
- Design system en `components/ui/` (Button, IconButton, Input, Modal, Sheet).
- Domain components en `components/shared/` (Pill, CategoryPill, NBtn, Chip).
- Feedback de usuario via `showToast` (`useToasts`), no `setBackupMessage` ad-hoc.
- Undo destructivo via `pushUndoTransaction` + `UndoToast`; limpiar con `clearUndoTransaction` al cambiar workspace/import/logout.
- Iconos via sprite `/icons.svg`.
- Drag-and-drop: HTML5 Drag API en Kanban/Lista (incluye papelera), Pointer Events en Board.

### 17.3 Estilos

- CSS vanilla con variables CSS para temas.
- No Tailwind, no CSS-in-JS, no SASS.
- Temas via variables CSS y clase en root.

### 17.4 Backend

- Worker como un solo archivo (`src/worker.js`).
- Router manual (switch sobre pathname y method).
- Queries parametrizadas con `.bind(...)`.
- `authenticate()` como middleware en rutas protegidas.
- `withSecurityHeaders()` en todas las respuestas.
- Field-level encryption AES-GCM en el worker.
- Auto-migraciones de schema.

### 17.5 Testing

- Tests unitarios: `node --test` con `node:assert`.
- Tests E2E: Playwright con mocks de API in-memory.
- Todo cambio debe pasar `npm run test:verify`.

---

## 18. Reglas Importantes para Agentes de IA

> **⚠️ LEER ANTES DE HACER CUALQUIER CAMBIO**

1. **No cambiar la arquitectura de estado**. El estado centralizado en `App.jsx` con props drilling es intencional. No migrar a Context, Redux, Zustand, etc.

2. **No migrar a TypeScript** sin instrucción explícita del usuario.

3. **No agregar dependencias** sin justificación. El proyecto es intencionalmente minimal (`react`, `react-dom`, `chrono-node`).

4. **No dividir `worker.js`** en múltiples archivos sin aprobación. Es un solo archivo por diseño.

5. **No dividir `App.jsx`** en múltiples archivos de estado sin aprobación.

6. **Respetar el sistema de estilos**. No introducir Tailwind, CSS modules, styled-components, etc.

7. **Usar `useModalDialog` hook** para modales. No usar `<dialog>` nativo directamente ni librerías de modales.

8. **HTML5 Drag API** para drag en Kanban/Lista. **Pointer Events** para drag en Board.

9. **Todos los cambios deben pasar `npm run test:verify`** (tests unitarios + lint + E2E).

10. **Campo encryption**: Los campos sensibles se cifran en el worker con AES-GCM antes de D1. Si se agrega un campo sensible, agregarlo a la lista de cifrado en el worker.

11. **Content hash** (`content_hash`) debe generarse con `stableStringify` + `sha256HexOfUtf8` del snapshot normalizado. Es la base del sync eficiente.

12. **IDs** se generan con `uid()` (base-36 random) en el cliente. En D1 se almacenan con scoping `profileId::entityId`.

13. **La app es offline-first**. Toda nueva funcionalidad debe funcionar sin conexión (localStorage como fallback).

14. **Queries SQL siempre parametrizadas** (`.bind(...)`). Nunca interpolar valores.

15. **Endpoints de IA necesitan rate limit** (48/60s por usuario). Todo nuevo endpoint de IA debe verificar `consumeAiRateLimit`.

16. **Fallbacks para IA**: Todo endpoint de IA debe tener un fallback determinístico para cuando Workers AI falla.

17. **La sesión expira en 1 hora** (no 30 días). El frontend verifica liveness cada 60s.

18. **UI en español**: Labels, mensajes de usuario, fechas en español. Código en inglés.

19. **Entity ID scoping**: Siempre usar `scopedEntityId`/`unscopedEntityId` al leer/escribir en D1. No almacenar IDs sin scope.

20. **Auto-migraciones**: El worker auto-crea tablas y columnas faltantes. No depender de que el schema.sql se ejecute manualmente en producción.

21. **Custom statuses tienen metadata semántica**: `kind`, `isTerminal`, `canBeFocused`, `sortWeight`, `theme`. Respetar al crear/editar statuses.

22. **Parent blocking**: Un parent task no puede moverse a `done` ni eliminarse si tiene hijos abiertos. Respetar esta regla en cualquier nuevo flujo de cambio de status o borrado.

23. **Logs anonimizados**: Usar `shortHashForLog` para user IDs en logs del worker. Nunca loguear emails en plaintext.

24. **Feedback UX**: Usar `showToast` (`useToasts`) para mensajes al usuario. Acciones destructivas (borrar tarea/nota/evento, convertir nota→tarea) deben registrar undo via `pushUndoTransaction` y limpiar con `clearUndoTransaction` al cambiar workspace/import/logout.

25. **Cifrado solo en Worker**: No cifrar en el cliente. `d1-field-crypto.js` se usa desde `worker.js`; localStorage guarda plaintext.
