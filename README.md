# Task Manager PWA

Aplicación de gestión de tareas de tipo **Progressive Web App (PWA)** con soporte offline, sincronización en la nube mediante Cloudflare Workers/D1, cifrado de datos y funcionalidades asistidas por Inteligencia Artificial (Workers AI).

---

## 🚀 Características Principales

- **Múltiples Vistas de Trabajo**:
  - **Hoy (`today`)**: Vista focalizada diaria con algoritmo determinístico de recomendación de foco.
  - **Tareas (`tasks`)**: Vista en lista completa con búsqueda rápida, filtros y parsing NLP.
  - **Kanban (`kanban`)**: Tablero drag-and-drop con WIP limits y soporte para Epics y Sub-tasks.
  - **Calendario (`calendar`)**: Vista mensual con eventos recurrentes y festivos.
  - **Agenda Diaria (`daily`)**: Time-blocking por franjas horarias (06:00 a 22:00).
  - **Tablero de Notas (`board`)**: Notas adhesivas organizadas visualmente en lienzo 2D.
  - **Timeline (`timeline`)**: Histórico y auditoría de cambios de estado (*statusLog*).
- **Asistencia IA (Cloudflare Workers AI - Llama 3.1)**:
  - Creación y estructuración inteligente de tareas desde texto libre.
  - Desglose de planes de acción en subtareas (main/child tasks).
  - Generación de reportes de estado diario (Daily Standup / Scrum Report).
- **Sincronización Cloud y Modo Offline**:
  - Persistencia local inmediata (`localStorage`) con sincronización delta incremental a Cloudflare D1.
  - Service Worker (v4) con estrategias de caching diferenciadas para soporte offline completo.
- **Seguridad y Privacidad**:
  - Autenticación con Google OAuth (Sign-In with Google) y sesiones opacas en cookies `HttpOnly`.
  - Cifrado de datos a nivel de campo (AES-256-GCM + SHA-256) server-side y client-side.
- **Multitrabajo / Workspaces**:
  - Gestión de múltiples perfiles independientes con personalización de estados (*custom statuses*).

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 19 (JSX, sin TypeScript), CSS Vanilla |
| **Build & Tooling** | Vite 8, ESLint 9 (Flat Config), Husky |
| **Backend & API** | Cloudflare Workers (`src/worker.js`) |
| **Base de Datos** | Cloudflare D1 (SQLite serverless) |
| **Inteligencia Artificial** | Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct`) |
| **Autenticación** | Google Identity Services + Cookies `HttpOnly` |
| **PWA & Offline** | Service Worker (`public/sw.js`) + Web App Manifest |
| **Testing** | Node.js Test Runner (Unitario), Playwright (E2E) |

---

## 💻 Desarrollo Local

### Requisitos Previos

- **Node.js**: `>= 22`
- **npm** instalado

### Instalación

```bash
git clone https://github.com/tu-usuario/taskmanagerpwa.git
cd taskmanagerpwa
npm install
```

### Configuración de Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```env
VITE_GOOGLE_CLIENT_ID=tu_google_client_id.apps.googleusercontent.com
```

### Comandos Principales

- **Frontend en Desarrollo**:
  ```bash
  npm run dev
  ```
- **Worker & DB Local**:
  ```bash
  npm run dev:worker
  ```
- **Worker con Hot-Reload (desarrollo completo)**:
  ```bash
  npm run dev:worker:live
  ```
- **Construir para Producción**:
  ```bash
  npm run build
  ```

---

## 🧪 Testing y Calidad de Código

El proyecto cuenta con verificación automatizada de código (Unit tests, Linting y E2E):

- **Ejecutar Tests Unitarios**:
  ```bash
  npm test
  ```
- **Ejecutar Linter**:
  ```bash
  npm run lint
  ```
- **Ejecutar Tests E2E (Playwright)**:
  ```bash
  npm run test:e2e
  ```
- **Verificación Completa**:
  ```bash
  npm run test:verify
  ```

> 💡 **Hooks Git (Husky)**: Tras `npm install`, se activa un hook `pre-push` que ejecuta `npm run test:verify`. Si algún test o linter falla, el push será cancelado. Para realizar un push de emergencia sin ejecutar el check:
> ```bash
> SKIP_HOOKS=1 git push
> ```

---

## 🚀 Despliegue

Para desplegar el frontend y worker a **Cloudflare Workers**:

```bash
npm run deploy
```

---

## 📄 Licencia

Este proyecto es privado. Todos los derechos reservados.

