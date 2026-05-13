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
});

test.describe('navegación', () => {
  test('cambia entre pestañas de vista en el header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.locator('.brand-title').filter({ hasText: 'Kanban' })).toBeVisible();

    await page.getByRole('button', { name: 'Calendario' }).click();
    await expect(page.locator('.brand-title').filter({ hasText: 'Calendario' })).toBeVisible();

    await page.getByRole('button', { name: 'Tareas' }).click();
    await expect(page.locator('.brand-title').filter({ hasText: 'Tareas' })).toBeVisible();
  });
});
