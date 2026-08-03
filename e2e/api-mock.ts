import type { Page, Route } from '@playwright/test';

const E2E_PROFILE_ID = 'e2e-ws-1';
const SECOND_PROFILE_ID = 'e2e-ws-2';

export const E2E_TASK_NAME = 'Tarea E2E inicial';
export const SECOND_TASK_NAME = 'Tarea workspace secundario';

function json(body: unknown) {
  return JSON.stringify(body);
}

function emptyWorkspaceJson(activeProfileId = E2E_PROFILE_ID) {
  return json({
    tasks: [],
    boardNotes: [],
    events: [],
    profiles: [
      { id: E2E_PROFILE_ID, name: 'E2E' },
      { id: SECOND_PROFILE_ID, name: 'Secundario' },
      { id: 'ws-importado', name: 'Importado' },
    ],
    activeProfileId,
  });
}

function workspaceData(profileId: string) {
  const importedTask = { id: 'imported-task', name: 'Tarea importada E2E', status: 'not_done', priority: 'medium', subtasks: [] };
  const tasks =
    profileId === 'ws-importado'
      ? [importedTask]
      : profileId === SECOND_PROFILE_ID
        ? [{ id: 'second-task', name: SECOND_TASK_NAME, status: 'not_done', priority: 'medium', subtasks: [] }]
        : [{ id: 'first-task', name: E2E_TASK_NAME, status: 'not_done', priority: 'medium', subtasks: [] }];
  return json({
    tasks,
    boardNotes: [],
    events: [],
    profiles: [
      { id: E2E_PROFILE_ID, name: 'E2E' },
      { id: SECOND_PROFILE_ID, name: 'Secundario' },
      { id: 'ws-importado', name: 'Importado' },
    ],
    activeProfileId: profileId,
  });
}

function respondOk(route: Route) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
}

/**
 * Simula el Worker para que la app entre en modo autenticado sin Google OAuth ni Wrangler.
 * Soporta múltiples workspaces para tests de cambio de workspace y backup.
 */
export async function installApiMocks(page: Page): Promise<void> {
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
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profile: { id, name } }),
    });
  });

  await page.route((url) => url.pathname === '/api/profiles/delete', (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    return respondOk(route);
  });

  await page.route((url) => url.pathname === '/api/profiles/update', (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    return respondOk(route);
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
