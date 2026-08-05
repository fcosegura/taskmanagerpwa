# Plan de Mejoras UX / Calidad de Producto — Task Manager PWA

## Contexto

Proyecto bien construido: offline-first, sync incremental con dedup/backoff, field-level
encryption en worker, security headers, fallbacks determinísticos de IA, 108 tests unitarios
OK, PWA con service worker v4. El foco elegido es **UX / calidad de producto**.

Hallazgos clave verificados en código:
- No hay detección de `navigator.onLine` ni listener `online`/`offline` en la UI. El sync
  falla **silenciosamente**; `syncState='error'` solo muestra "Error al guardar" sin retry
  (src/App.jsx:1564-1569, src/App.jsx:250-252).
- Sin sistema de toasts unificado: notificaciones vía `backupMessage` + ~17 `setTimeout`.
- Sin prompt de instalación PWA (`beforeinstallprompt`) ni detección `appinstalled`.
- Manifest sin `screenshots` (requisito para install prompt en escritorio).
- Sesión expira en **1 hora** y `checkSession()` cada 60s → logout inesperado a mitad de uso.
- Sin indicador de carga inicial / skeletons / estados de error globales.
- No hay guard de conectividad; reconexión depende solo del próximo ciclo de sync.

## Reglas respetadas (de AGENTS.md)

- Estado centralizado en `App.jsx` con props drilling (NO mover a Context/Redux sin aprobación).
- Vanilla CSS, variables CSS, theme light/dark en root.
- UI en español, código en inglés.
- Modales usan `useModalDialog`.
- Todos los cambios deben pasar `npm run test:verify`.

---

## Tareas propuestas (orden sugerido)

### 1. Indicador de conectividad offline/online global
- Añadir estado `isOnline` en `App.jsx` (default `navigator.onLine`).
- Listeners `online`/`offline` en `window` con cleanup en `useEffect`.
- Banner/pill persistente "Sin conexión — los cambios se guardarán cuando vuelvas" + indicador
  "Reconectando…" cuando `online` vuelve y hay sync pendiente.
- Aprovechar `pendingSyncRef` y `syncNowRef` para forzar un flush al reconectar.

### 2. Sistema de toasts unificado
- Crear `src/components/Toast/index.jsx` (+ hooks `useToasts`) con tipos: `success`, `error`,
  `info`, `warning`, auto-dismiss y cola.
- Reemplazar los ~17 bloques `setBackupMessage` + `setTimeout(...,4200)` de `App.jsx` por
  llamadas `showToast(...)`. Mantener `backupMessage` como fallback fugaz si es necesario.
- Estilos en `index.css` (o archivo dedicado) siguiendo variables CSS existentes.

### 3. Estado de sync accionable (no solo informativo)
- Mantener `syncState` pero diferenciar visualmente y dar acción:
  - `error` → toast + botón "Reintentar" que invoca `syncNowRef.current({ immediate: true })`.
  - `offline` → indicar pendiente + auto-flush al reconectar (tarea 1).
- Añadir semántica `aria-live` ya presente y refinar textos (español).

### 4. Prompt de instalación PWA + detección de instalación
- Capturar `beforeinstallprompt`, guardar evento, mostrar banner "Instalar app" (ocultable
  cuando `appinstalled` o ya instalado).
- Añadir `screenshots` al `public/manifest.json` para habilitar install prompt en escritorio.
- Mantener el banner de update de SW existente.

### 5. Manejo de expiración de sesión sin perder contexto
- Antes de `forceLogout()`, guardar en localStorage un flag `sessionExpiredNeedsLogin`.
- Mostrar pantalla intermedia "Sesión expirada — vuelve a iniciar sesión para continuar"
  en lugar de un logout seco, preservando el último workspace activo.
- Al re-loguear, restaurar `activeProfileId` anterior.

### 6. Estados de carga y skeletons
- `ready`/`hydratedSession`: usar un loader inicial al arrancar en lugar de parpadeo.
- Vistas `React.lazy` ya tienen Suspense; añadir fallbacks de skeleton mínimos.

### 7. Onboarding y empty states (mejora de producto)
- Pantalla de primer uso (primer login sin datos): sugerir crear primera tarea / quick-add.
- Revisar empty states de vistas (TodayView ya tiene algunos) para consistencia visual con
  CTAs accionables.

### 8. Accesibilidad rápida (a11y)
- Auditoría ligera con eslint-plugin-jsx-a11y ya instalado (revisar warnings actuales).
- Verificar contraste dark/light, `aria-label` en botones icon-only, target de foco.

---

## Decisiones / riesgos

- **Indicador offline**: no existe hoy; es la mejora de mayor impacto y bajo riesgo (puro
  client-side, sin cambios de API).
- **Reemplazo de toasts**: riesgo medio — hay muchos `setTimeout` acoplados. Hacerlo de forma
  incremental y mantener tests existentes (hay tests de toasts/undo).
- **Prompt PWA**: requiere assets/screenshots; sin cambios de alcance worker.
- **Sesión**: la regla "1 hora" es intencional (seguridad). La mejora es solo UX de
  transición, no alargar la sesión, salvo decisión contraria.
- No tocar arquitectura de estado ni dividir `worker.js`/`App.jsx`.

## Validación

1. `npm test` — 108 unitarios siguen pasando.
2. `npm run lint` — sin warnings nuevos de a11y.
3. `npm run test:e2e` — regresión básica de flujos existentes.
4. `npm run build` — build de producción con PWA.
5. Manual: toggle offline en DevTools → banner aparece; reconexión → flush; simular error de
   sync → botón reintentar; instalación PWA desde escritorio.
6. `npm run test:verify` completo antes de cerrar.

## Fuera de alcance (explícito)

- Cambios de arquitectura de estado, migración a TS, dividir App.jsx/worker.js.
- Nuevas dependencias sin justificación (push notifications requieren backend+VAPID; si se
  quiere, es un plan separado).
- Cambios de seguridad/rate-limits (se abordan en un plan aparte si se solicita).
