import { test, expect } from '@playwright/test';
import { installApiMocks } from './api-mock';

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test.describe('autenticación simulada', () => {
  test('muestra el shell principal con resumen de tareas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Sincroniza tus tareas', { exact: false })).not.toBeVisible();
  });
});

test.describe('tareas', () => {
  test('crea una tarea desde el modal y aparece en la lista', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    await expect(page.getByText('Nueva tarea')).toBeVisible();

    const name = `E2E tarea ${Date.now()}`;
    await page.getByLabel('Nombre').fill(name);
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.locator('.task-title', { hasText: name })).toBeVisible();
  });

  test('permite introducir un comentario presionando Enter en el textarea', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({
      timeout: 30_000,
    });

    const name = `E2E comment enter ${Date.now()}`;
    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    await page.getByLabel('Nombre').fill(name);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('.task-title', { hasText: name })).toBeVisible();

    const card = page.locator('.task-card', { hasText: name });
    await card.getByRole('button', { name: 'Marcar como completada' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Comentario de cambio de estado')).toBeVisible();

    await page.getByPlaceholder('¿Qué cambió y por qué?').fill('Comentario de prueba');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: /Hechas/i }).click();
    await expect(card.getByRole('button', { name: 'Marcar como no completada' })).toBeVisible();
  });
});

test.describe('navegación', () => {
  test.skip('cambia entre pestañas de vista en el header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({
      timeout: 30_000,
    });

    const headerTabs = page.locator('.desktop-tabs');

    await headerTabs.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.locator('.brand-title').filter({ hasText: 'Kanban' })).toBeVisible();

    await headerTabs.getByRole('button', { name: 'Calendario' }).click();
    await expect(page.locator('.brand-title').filter({ hasText: 'Calendario' })).toBeVisible();

    await headerTabs.getByRole('button', { name: 'Agenda diaria' }).click();
    await expect(page.locator('.brand-title').filter({ hasText: 'Agenda diaria' })).toBeVisible();
    await expect(page.locator('.daily-agenda-view')).toBeVisible();

    await headerTabs.getByRole('button', { name: 'Tareas' }).click();
    await expect(page.locator('.brand-title').filter({ hasText: 'Tareas' })).toBeVisible();

    await headerTabs.getByRole('button', { name: 'Cronología' }).click();
    await expect(page.locator('.brand-title').filter({ hasText: 'Cronología' })).toBeVisible();
    await expect(page.locator('.timeline-container')).toBeVisible();
  });
});


test.describe('panel MyNotebook', () => {
  test('abre MyNotebook desde el header y cierra con Escape y click fuera', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Notebook' }).click();
    await expect(page.locator('.external-app-drawer')).toBeVisible();
    await expect(page.locator('.external-app-frame')).toHaveAttribute(
      'src',
      'https://mynotebook.fcovidalsegura.workers.dev/',
    );

    await page.keyboard.press('Escape');
    await expect(page.locator('.external-app-overlay')).not.toHaveClass(/open/);

    await page.getByRole('button', { name: 'Notebook' }).click();
    await expect(page.locator('.external-app-overlay')).toHaveClass(/open/);
    await page.mouse.click(24, 160);
    await expect(page.locator('.external-app-overlay')).not.toHaveClass(/open/);
  });
});
