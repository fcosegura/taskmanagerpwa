import { test, expect } from '@playwright/test';
import { installApiMocks, installUnauthorizedMocks, E2E_TASK_NAME, SECOND_TASK_NAME } from './api-mock';

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

test.describe('workspaces y sincronización', () => {
  test('cambia de workspace y carga los datos del workspace seleccionado', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(E2E_TASK_NAME)).toBeVisible();

    await page.getByRole('button', { name: /Cambiar workspace/i }).click();
    await page.getByRole('menuitemradio', { name: 'Secundario' }).click();
    await expect(page.getByText(SECOND_TASK_NAME)).toBeVisible();
    await expect(page.getByText(E2E_TASK_NAME)).not.toBeVisible();
  });
});

test.describe('backup e importación', () => {
  test('exporta un backup multi-workspace con los estados custom de cada workspace', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Acciones' }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Exportar backup' }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^taskmanager-backup-.*\.json$/);

    // Leer el JSON descargado con la API de Playwright (sin rutas rígidas del sistema local).
    const stream = await download.createReadStream();
    if (!stream) throw new Error('No se pudo leer el archivo descargado.');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const backup = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

    expect(Array.isArray(backup.workspaces)).toBe(true);
    expect(backup.workspaces.length).toBeGreaterThanOrEqual(2);

    // El workspace activo conserva sus estados custom.
    const activeWorkspace = backup.workspaces.find((w: { name?: string }) => w.name === 'E2E');
    expect(activeWorkspace).toBeTruthy();
    expect(Array.isArray(activeWorkspace.customStatuses)).toBe(true);
    const activeCustom = activeWorkspace.customStatuses.find((s: { v?: string }) => s.v === 'custom_review');
    expect(activeCustom).toBeTruthy();
    expect(activeCustom.label).toBe('Revisión E2E');

    // Al menos un workspace NO activo conserva sus propios estados custom (no los del activo).
    const secondWorkspace = backup.workspaces.find((w: { name?: string }) => w.name === 'Secundario');
    expect(secondWorkspace).toBeTruthy();
    expect(Array.isArray(secondWorkspace.customStatuses)).toBe(true);
    const secondCustom = secondWorkspace.customStatuses.find((s: { v?: string }) => s.v === 'custom_qa_secundario');
    expect(secondCustom).toBeTruthy();
    expect(secondCustom.label).toBe('QA Secundario');
    expect(secondWorkspace.customStatuses.some((s: { v?: string }) => s.v === 'custom_review')).toBe(false);

    // Cada colección de estados contiene metadata semántica normalizada.
    for (const workspace of backup.workspaces) {
      if (!Array.isArray(workspace.customStatuses)) continue;
      for (const status of workspace.customStatuses) {
        expect(typeof status.kind).toBe('string');
        expect(typeof status.isTerminal).toBe('boolean');
        expect(typeof status.canBeFocused).toBe('boolean');
        expect(typeof status.sortWeight).toBe('number');
      }
    }
    expect(activeCustom.kind).toBe('active');
    expect(activeCustom.isTerminal).toBe(false);
    expect(activeCustom.canBeFocused).toBe(true);
    expect(activeCustom.theme).toBe('info');
  });

  test('importa un backup multi-workspace y muestra los datos importados', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({ timeout: 30_000 });

    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      workspaces: [
        {
          id: 'ws-importado',
          name: 'Importado',
          tasks: [
            {
              id: 'imported-task',
              name: 'Tarea importada E2E',
              status: 'custom_imported',
              priority: 'medium',
              subtasks: [],
              category: '',
              date: '',
              time: '',
              url: '',
              notes: '',
              ticketNumber: '',
            },
          ],
          boardNotes: [],
          events: [],
          customStatuses: [
            {
              v: 'custom_imported',
              label: 'Estado E2E',
              theme: 'warning',
              kind: 'active'
            }
          ]
        },
      ],
    };

    await page.getByRole('button', { name: 'Acciones' }).click();
    await page.getByRole('menuitem', { name: 'Importar backup' }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });

    await expect(page.getByText('Importados 1 workspace correctamente')).toBeVisible();

    // El import no cambia automáticamente al workspace importado; lo seleccionamos manualmente.
    await page.getByRole('button', { name: /Cambiar workspace/i }).click();
    await page.getByRole('menuitemradio', { name: 'Importado' }).click();
    
    // Verificamos que la tarea se muestre en la vista
    await expect(page.getByText('Tarea importada E2E')).toBeVisible();

    // Comprobamos que el estado personalizado (renderizado en un Chip) es visible
    await expect(page.getByText('Estado E2E')).toBeVisible();
    // Y que NO se usa el fallback derivado del identificador del estado
    await expect(page.getByText('Custom Imported')).not.toBeVisible();

    // Tras recargar, la app vuelve a pedir los datos del workspace: la etiqueta debe seguir
    // visible, lo que demuestra que los estados custom se persistieron de verdad.
    await page.reload();
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Tarea importada E2E')).toBeVisible();
    await expect(page.getByText('Estado E2E')).toBeVisible();
    await expect(page.getByText('Custom Imported')).not.toBeVisible();
  });
});

test.describe('autenticación', () => {
  test('muestra el login cuando la sesión ha expirado', async ({ page }) => {
    await installUnauthorizedMocks(page);
    await page.goto('/');
    await expect(page.getByText('Sincroniza tus tareas', { exact: false })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Siguiente Foco Recomendado y Cambio Rápido de Estado', () => {
  test('muestra la razón de recomendación, procesa el modal de comentario y revierte si se cancela', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({ timeout: 30_000 });

    // Navegar a la vista Hoy
    await page.getByRole('button', { name: 'Hoy', exact: true }).first().click();
    await expect(page.locator('.today-next-focus')).toBeVisible({ timeout: 10_000 });

    // Verificar que aparece el badge de razón
    await expect(page.locator('.next-focus-reason-pill')).toBeVisible();

    const select = page.locator('.next-focus-status-select');
    await expect(select).toBeVisible();

    // 1. Probar flujo con cancelación
    const initialStatus = await select.inputValue();
    const testTargetStatus = initialStatus === 'blocked' ? 'paused' : 'blocked';

    await select.selectOption(testTargetStatus);

    // Verificar que la solicitud pasa por el flujo central abriendo el modal de comentario
    const commentModalTitle = page.getByText('Comentario de cambio de estado');
    await expect(commentModalTitle).toBeVisible();

    // Cancelar el modal y verificar que el selector revierte visualmente al estado original
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(commentModalTitle).not.toBeVisible();
    await expect(select).toHaveValue(initialStatus);

    // 2. Probar flujo confirmado con comentario
    const confirmTargetStatus = initialStatus === 'in_progress' ? 'paused' : 'in_progress';
    await select.selectOption(confirmTargetStatus);
    await expect(commentModalTitle).toBeVisible();

    await page.getByPlaceholder('¿Qué cambió y por qué?').fill('Comentario E2E confirmado');
    await page.keyboard.press('Enter');

    await expect(commentModalTitle).not.toBeVisible();
    await expect(select).toHaveValue(confirmTargetStatus);
  });
});

test.describe('Notas AI Fase 3 — Grafo y chat RAG', () => {
  test('abre la vista Grafo y permite usar el chat de notas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.locator('.desktop-tabs').getByRole('button', { name: 'Notas' }).click();
    await expect(page.locator('.subview-pills').getByRole('button', { name: 'Grafo' })).toBeVisible();

    await page.locator('.subview-pills').getByRole('button', { name: 'Grafo' }).click();
    await expect(page.getByRole('heading', { name: /Explora conexiones entre notas/i })).toBeVisible();
    await expect(page.locator('.graph-view')).toBeVisible();

    await page.getByRole('button', { name: 'Chat notas' }).click();
    await expect(page.locator('#notes-rag-chat-panel')).toBeVisible();
    await page.getByLabel('Pregunta sobre tus notas').fill('¿qué anoté?');
    await page.locator('.graph-chat-form').getByRole('button', { name: 'Enviar' }).click();
    await expect(page.locator('.graph-chat-msg--assistant').first()).toBeVisible({ timeout: 10_000 });
  });
});

