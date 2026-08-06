import type { Page, Route } from '@playwright/test';

const E2E_PROFILE_ID = 'e2e-ws-1';
const SECOND_PROFILE_ID = 'e2e-ws-2';
const IMPORTED_PROFILE_ID = 'ws-importado';

export const E2E_TASK_NAME = 'Tarea E2E inicial';
export const SECOND_TASK_NAME = 'Tarea workspace secundario';

// Como guarda la app real (handleSaveStatuses): lista completa de estados estándar + custom.
const STANDARD_STATUSES = [
  { v: 'not_done', label: 'Sin iniciar' },
  { v: 'in_progress', label: 'En progreso' },
  { v: 'paused', label: 'En pausa' },
  { v: 'blocked', label: 'Bloqueado' },
  { v: 'done', label: 'Completado' },
];

export const ACTIVE_CUSTOM_STATUS = { v: 'custom_review', label: 'Revisión E2E', theme: 'info', kind: 'active' };
export const SECOND_CUSTOM_STATUS = { v: 'custom_qa_secundario', label: 'QA Secundario', theme: 'success', kind: 'active' };

interface MockProfile {
  id: string;
  name: string;
  customStatuses?: unknown[];
}

function json(body: unknown) {
  return JSON.stringify(body);
}

function respondOk(route: Route) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
}

/**
 * Simula el Worker para que la app entre en modo autenticado sin Google OAuth ni Wrangler.
 * Soporta múltiples workspaces para tests de cambio de workspace y backup.
 *
 * El mock es stateful para perfiles y estados custom: lo que la app guarda vía
 * POST /api/profiles/update se devuelve después en GET /api/data, igual que el Worker real.
 */
export async function installApiMocks(page: Page): Promise<void> {
  // Estado en memoria por test: perfiles (con sus estados custom) y tareas por workspace.
  const profiles = new Map<string, MockProfile>([
    [E2E_PROFILE_ID, { id: E2E_PROFILE_ID, name: 'E2E', customStatuses: [...STANDARD_STATUSES, ACTIVE_CUSTOM_STATUS] }],
    [SECOND_PROFILE_ID, { id: SECOND_PROFILE_ID, name: 'Secundario', customStatuses: [...STANDARD_STATUSES, SECOND_CUSTOM_STATUS] }],
    [IMPORTED_PROFILE_ID, { id: IMPORTED_PROFILE_ID, name: 'Importado' }],
  ]);

  const tasksByProfile = new Map<string, unknown[]>([
    [E2E_PROFILE_ID, [{ id: 'first-task', name: E2E_TASK_NAME, status: 'not_done', priority: 'medium', subtasks: [] }]],
    [SECOND_PROFILE_ID, [{ id: 'second-task', name: SECOND_TASK_NAME, status: 'not_done', priority: 'medium', subtasks: [] }]],
    [IMPORTED_PROFILE_ID, [{ id: 'imported-task', name: 'Tarea importada E2E', status: 'custom_imported', priority: 'medium', subtasks: [] }]],
  ]);

  const profilesList = () => [...profiles.values()].map((profile) => ({ ...profile }));

  const workspaceData = (profileId: string) =>
    json({
      tasks: tasksByProfile.get(profileId) ?? [],
      boardNotes: [],
      events: [],
      profiles: profilesList(),
      activeProfileId: profileId,
    });

  // Evitar que el Service Worker intercepte requests durante los tests E2E.
  await page.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register = async () => new EventTarget() as unknown as ServiceWorkerRegistration;
    }
  });

  await page.route((url) => url.pathname === '/api/session', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      : route.continue(),
  );

  await page.route((url) => url.pathname === '/api/data', (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue();
    }
    const requestUrl = new URL(route.request().url());
    const profileId = requestUrl.searchParams.get('profileId') || E2E_PROFILE_ID;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: workspaceData(profileId),
    });
  });

  await page.route((url) => url.pathname === '/api/sync', (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    return respondOk(route);
  });

  await page.route((url) => url.pathname === '/api/profiles', (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    const requestBody = route.request().postDataJSON();
    const name = requestBody?.name || 'Nuevo workspace';
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
    const id = `ws-${slug}`;
    const profile: MockProfile = { id, name };
    profiles.set(id, profile);
    tasksByProfile.set(id, []);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profile: { ...profile } }),
    });
  });

  await page.route((url) => url.pathname === '/api/profiles/update', (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    const requestBody = route.request().postDataJSON();
    const profileId = requestBody?.profileId;
    const customStatuses = requestBody?.customStatuses;
    const profile = typeof profileId === 'string' ? profiles.get(profileId) : undefined;
    if (profile && Array.isArray(customStatuses)) {
      profile.customStatuses = customStatuses;
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, profiles: profilesList() }),
    });
  });

  await page.route((url) => url.pathname === '/api/profiles/delete', (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    const requestBody = route.request().postDataJSON();
    if (typeof requestBody?.profileId === 'string') {
      profiles.delete(requestBody.profileId);
      tasksByProfile.delete(requestBody.profileId);
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, profiles: profilesList() }),
    });
  });

  await page.route((url) => url.pathname === '/api/notes/ai', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ meta: [] }),
    });
  });

  await page.route((url) => url.pathname === '/api/notes/search', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], source: 'mock' }),
    });
  });

  await page.route((url) => /\/api\/notes\/[^/]+\/related$/.test(url.pathname), (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ related: [], status: null }),
    });
  });

  await page.route((url) => url.pathname === '/api/notes/ai/dismiss', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ meta: { dismissed: [] } }),
    });
  });

  await page.route((url) => url.pathname === '/api/logout', (route) => respondOk(route));
}

/**
 * Simula una sesión no válida para tests de autenticación/error.
 */
export async function installUnauthorizedMocks(page: Page): Promise<void> {
  await page.route((url) => url.pathname === '/api/session', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
      : route.continue(),
  );
  await page.route((url) => url.pathname === '/api/data', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
      : route.continue(),
  );
}
