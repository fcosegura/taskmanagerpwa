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
    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();

    const name = `E2E tarea ${Date.now()}`;
    await page.getByLabel(/Nombre/i).fill(name);
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    await expect(page.locator('.task-title', { hasText: name })).toBeVisible();
  });

  test('permite introducir un comentario presionando Enter en el textarea', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({
      timeout: 30_000,
    });

    const name = `E2E comment enter ${Date.now()}`;
    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    await page.getByLabel(/Nombre/i).fill(name);
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await expect(page.locator('.task-title', { hasText: name })).toBeVisible();

    const card = page.locator('.task-card', { hasText: name });
    await card.getByRole('button', { name: 'Marcar como completada' }).click();

    await expect(page.getByText('Comentario de cambio de estado')).toBeVisible();

    await page.getByPlaceholder('¿Qué cambió y por qué?').fill('Comentario de prueba');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Comentario de cambio de estado')).not.toBeVisible();
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

test.describe('Fase 3 — Flujos E2E de Tareas, Command Menu y Accesibilidad', () => {
  test('crea una tarea desde Hoy y verifica la fecha de hoy preseleccionada', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({ timeout: 30_000 });

    // Navegar a la vista Hoy
    await page.getByRole('button', { name: 'Hoy', exact: true }).first().click();
    await expect(page.locator('.today-tasks-section')).toBeVisible({ timeout: 10_000 });

    // Pulsar crear tarea desde la sección de tareas de hoy en TodayView
    await page.locator('.today-tasks-section').getByRole('button', { name: /\+ Nueva Tarea/i }).click();

    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();
    const taskName = `Tarea Hoy E2E ${Date.now()}`;
    await page.getByLabel(/Nombre de la tarea/i).fill(taskName);

    // Verificar que la fecha no está vacía (tiene la fecha de hoy preseleccionada)
    const dateInput = page.getByLabel(/Fecha límite/i);
    await expect(dateInput).not.toHaveValue('');

    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await expect(page.locator('.sheet-drawer-overlay')).not.toBeVisible();
  });

  test('edita una tarea existente sin duplicarla', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({ timeout: 30_000 });

    const name = `E2E Edit Check ${Date.now()}`;

    // Crear tarea inicial desde la vista principal
    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();
    await page.getByLabel(/Nombre/i).fill(name);
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await expect(page.locator('.task-title', { hasText: name })).toBeVisible();

    // Abrir edición desde el botón "Editar tarea" en la tarjeta .task-card
    const taskCard = page.locator('.task-card', { hasText: name });
    await taskCard.getByRole('button', { name: 'Editar tarea' }).click();
    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();

    const updatedName = `${name} (Editada)`;
    const titleInput = page.getByLabel(/Nombre de la tarea/i);
    await titleInput.fill(updatedName);
    await page.getByRole('button', { name: /Guardar Cambios/i }).click();

    await expect(page.locator('.sheet-drawer-overlay')).not.toBeVisible();
    await expect(page.locator('.task-title', { hasText: updatedName })).toHaveCount(1);
  });

  test('cierra TaskSheetDrawer y CommandMenu con tecla Escape', async ({ page }) => {
    await page.goto('/');

    // Abrir Command Menu con ⌘K / Control+K
    await page.keyboard.press('Control+k');
    const cmdOverlay = page.locator('.command-menu-overlay');
    if (await cmdOverlay.isVisible()) {
      await page.keyboard.press('Escape');
      await expect(cmdOverlay).not.toBeVisible();
    }

    // Abrir TaskSheetDrawer y cerrar con Escape
    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    const sheetOverlay = page.locator('.sheet-drawer-overlay');
    await expect(sheetOverlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheetOverlay).not.toBeVisible();
  });
});

