import type { Page } from '@playwright/test';

const E2E_PROFILE_ID = 'e2e-ws-1';

function emptyWorkspaceJson() {
  return JSON.stringify({
    tasks: [],
    boardNotes: [],
    events: [],
    profiles: [{ id: E2E_PROFILE_ID, name: 'E2E' }],
    activeProfileId: E2E_PROFILE_ID,
  });
}

/**
 * Simula el Worker para que `loadData` reciba 200 y la app entre en modo autenticado
 * sin Google OAuth ni Wrangler (Vite preview solo no expone `/api/*`).
 */
export async function installApiMocks(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/session',
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    },
  );

  await page.route(
    (url) => url.pathname === '/api/data',
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: emptyWorkspaceJson(),
      });
    },
  );

  await page.route(
    (url) => url.pathname === '/api/sync',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    },
  );
}
