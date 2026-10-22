import { test, expect, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installApiMocks, installUnauthorizedMocks, E2E_TASK_NAME, SECOND_TASK_NAME } from './api-mock';

// Leer el contenido de una descarga. `createReadStream()` puede devolver 0 bytes de forma
// intermitente para descargas blob pequeñas y el fichero temporal puede seguir bloqueado
// unos instantes en Windows, así que reintentamos la lectura desde disco.
async function readDownloadedText(download: Download): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const filePath = await download.path();
      if (filePath) {
        const text = await readFile(filePath, 'utf-8');
        if (text.length > 0) return text;
      }
    } catch {
      // El fichero todavía puede estar bloqueado: reintentamos.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('No se pudo leer el archivo descargado.');
}

// La app muestra siempre un selector de modo tras autenticarse; entra en el modo
// completo y espera al shell principal.
async function enterFullMode(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Modo completo/i }).click();
  await expect(page.getByRole('heading', { name: /Prioriza lo importante/i })).toBeVisible({
    timeout: 30_000,
  });
}

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test.describe('autenticación simulada', () => {
  test('muestra el shell principal con resumen de tareas', async ({ page }) => {
    await enterFullMode(page);
    await expect(page.getByText('Sincroniza tus tareas', { exact: false })).not.toBeVisible();
  });
});

test.describe('tareas', () => {
  test('crea una tarea desde el modal y aparece en la lista', async ({ page }) => {
    await enterFullMode(page);

    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();

    const name = `E2E tarea ${Date.now()}`;
    await page.getByLabel(/Nombre/i).fill(name);
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    await expect(page.locator('.task-title', { hasText: name })).toBeVisible();
  });

  test('crea una tarea padre vinculando tareas existentes desde el drawer', async ({ page }) => {
    await enterFullMode(page);

    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();

    const parentName = `E2E padre ${Date.now()}`;
    await page.getByLabel(/Nombre/i).fill(parentName);

    const childOption = page.locator('.dependency-task-item', { hasText: E2E_TASK_NAME });
    await expect(childOption).toBeVisible();
    await childOption.getByRole('checkbox').click();
    await expect(childOption.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: /^Guardar$/i }).click();

    const parentCard = page.locator('.task-card', { hasText: parentName });
    await expect(parentCard).toBeVisible();
    await expect(parentCard.locator('.dependency-rail[title="Esta tarea tiene tareas hijas"]')).toBeVisible();
  });

  test('permite desvincular una tarea hija existente al editar', async ({ page }) => {
    await enterFullMode(page);

    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();

    const parentName = `E2E unlink ${Date.now()}`;
    await page.getByLabel(/Nombre/i).fill(parentName);
    await page.locator('.dependency-task-item', { hasText: E2E_TASK_NAME }).getByRole('checkbox').click();
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    const parentCard = page.locator('.task-card', { hasText: parentName });
    await expect(parentCard).toBeVisible();
    await expect(parentCard.locator('.dependency-rail[title="Esta tarea tiene tareas hijas"]')).toBeVisible();

    await parentCard.getByRole('button', { name: 'Editar tarea' }).click();
    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();

    const childOption = page.locator('.dependency-task-item', { hasText: E2E_TASK_NAME });
    await expect(childOption.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
    await childOption.getByRole('checkbox').click();
    await page.getByRole('button', { name: /Guardar Cambios/i }).click();

    await expect(parentCard.locator('.dependency-rail')).not.toBeVisible();
  });

  test('cancelar el drawer no persiste la selección de hijas', async ({ page }) => {
    await enterFullMode(page);

    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();

    const parentName = `E2E cancel ${Date.now()}`;
    await page.getByLabel(/Nombre/i).fill(parentName);
    await page.locator('.dependency-task-item', { hasText: E2E_TASK_NAME }).getByRole('checkbox').click();

    await page.getByRole('button', { name: /Cancelar/i }).click();
    await expect(page.locator('.sheet-drawer-overlay')).not.toBeVisible();

    await expect(page.locator('.task-title', { hasText: parentName })).not.toBeVisible();
  });

  test('permite introducir un comentario presionando Enter en el textarea', async ({ page }) => {
    await enterFullMode(page);

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
    await enterFullMode(page);

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
    await enterFullMode(page);

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

  test('muestra tareas pendientes de los próximos cinco días en Hoy', async ({ page }) => {
    await enterFullMode(page);

    // La vista Hoy solo muestra los próximos 5 días laborables: elegimos el siguiente
    // día laborable para que el test no dependa del día de la semana en que se ejecute.
    const futureDate = new Date();
    do {
      futureDate.setDate(futureDate.getDate() + 1);
    } while (futureDate.getDay() === 0 || futureDate.getDay() === 6);
    const futureDateString = [
      futureDate.getFullYear(),
      String(futureDate.getMonth() + 1).padStart(2, '0'),
      String(futureDate.getDate()).padStart(2, '0'),
    ].join('-');
    const taskName = `Tarea Próxima E2E ${Date.now()}`;

    await page.getByRole('button', { name: /crear nueva tarea/i }).click();
    await expect(page.locator('.sheet-drawer-overlay')).toBeVisible();
    await page.getByLabel(/Nombre de la tarea/i).fill(taskName);
    await page.getByLabel(/Fecha límite/i).fill(futureDateString);
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    await page.getByRole('button', { name: 'Hoy', exact: true }).first().click();
    const upcoming = page.locator('.upcoming-tasks-subblock');
    await expect(upcoming).toBeVisible();
    await expect(upcoming).toContainText('Próximas tareas (1)');
    await expect(upcoming.locator('.task-title', { hasText: taskName })).toBeVisible();
  });

  test('edita una tarea existente sin duplicarla', async ({ page }) => {
    await enterFullMode(page);

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
    await enterFullMode(page);

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
    await enterFullMode(page);
    await expect(page.getByText(E2E_TASK_NAME)).toBeVisible();

    await page.getByRole('button', { name: /Cambiar workspace/i }).click();
    await page.getByRole('menuitemradio', { name: 'Secundario' }).click();
    await expect(page.getByText(SECOND_TASK_NAME)).toBeVisible();
    await expect(page.getByText(E2E_TASK_NAME)).not.toBeVisible();
  });
});

test.describe('backup e importación', () => {
  test('exporta un backup multi-workspace con los estados custom de cada workspace', async ({ page }) => {
    await enterFullMode(page);

    await page.getByRole('button', { name: 'Acciones' }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Exportar backup' }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^taskmanager-backup-.*\.json$/);

    // Leer el JSON descargado con la API de Playwright (sin rutas rígidas del sistema local).
    const backup = JSON.parse(await readDownloadedText(download));

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
    await enterFullMode(page);

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
    await enterFullMode(page);
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
    await enterFullMode(page);

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
    await enterFullMode(page);

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

test.describe('selector de modo y modo rápido', () => {
  test('muestra el selector de modo tras el login y de nuevo al recargar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Modo completo/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Modo rápido/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /Modo completo/i })).toBeVisible({ timeout: 30_000 });
  });

  test('muestra las secciones del día en modo rápido', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Modo rápido/i }).click();
    await expect(page.locator('.quick-mode-card')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Siguiente foco/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Tareas de hoy/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Próximas tareas/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Agenda y eventos/i })).toBeVisible();

    // Una tarea con fecha pasada revela la sección "Atrasadas".
    await page.getByLabel('Nombre de la tarea').fill('Atrasada E2E');
    await page.getByLabel('Fecha').fill('2020-01-01');
    await page.getByRole('button', { name: 'Añadir' }).click();
    await expect(page.getByRole('heading', { name: /Atrasadas/i })).toBeVisible();

    // La agenda es solo lectura: no hay botones de edición/borrado dentro de la tarjeta de eventos.
    await expect(page.locator('.quick-mode-section').filter({ hasText: 'Agenda y eventos' }).getByRole('button')).toHaveCount(0);
  });

  test('crea una tarea desde el mini-formulario del modo rápido', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Modo rápido/i }).click();
    const name = `Rápida E2E ${Date.now()}`;
    await page.getByLabel('Nombre de la tarea').fill(name);
    await page.getByRole('button', { name: 'Añadir' }).click();
    const todaySection = page.locator('.quick-mode-section').filter({
      has: page.getByRole('heading', { name: /Tareas de hoy/i }),
    });
    await expect(todaySection.locator('.today-task-card', { hasText: name })).toBeVisible();
  });

  test('completa una tarea con el checkbox en modo rápido', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Modo rápido/i }).click();
    const name = `Completar E2E ${Date.now()}`;
    await page.getByLabel('Nombre de la tarea').fill(name);
    await page.getByRole('button', { name: 'Añadir' }).click();
    const todaySection = page.locator('.quick-mode-section').filter({
      has: page.getByRole('heading', { name: /Tareas de hoy/i }),
    });
    const card = todaySection.locator('.today-task-card', { hasText: name });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /Completar/ }).click();
    await page.getByPlaceholder('¿Qué cambió y por qué?').fill('Listo');
    await page.keyboard.press('Enter');
    await expect(todaySection.locator('.today-task-card', { hasText: name })).not.toBeVisible();
  });

  test('pegar una URL MAPP en modo rápido autorrellena categoría y título', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Modo rápido/i }).click();

    const nameInput = page.getByLabel('Nombre de la tarea');
    await nameInput.fill('Revisar ticket');
    await page.getByLabel('URL').fill('https://acme.atlassian.net/browse/MAPP-123');

    await expect(nameInput).toHaveValue(/\[MAPP-123\]/);
    await expect(page.getByLabel('Categoría')).toHaveValue('Jira Task');
    await expect(page.getByRole('button', { name: 'Alta' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Añadir' }).click();
    const todaySection = page.locator('.quick-mode-section').filter({
      has: page.getByRole('heading', { name: /Tareas de hoy/i }),
    });
    const card = todaySection.locator('.today-task-card', { hasText: 'Revisar ticket' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Jira Task');
    await expect(card).toContainText('[MAPP-123]');
  });

  test('el enlace de versión completa navega a la vista Hoy', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Modo rápido/i }).click();
    await page.getByRole('button', { name: /Versión completa/i }).click();
    await expect(page.locator('.today-view-container')).toBeVisible({ timeout: 10_000 });
  });

  test('el botón del header vuelve al modo rápido', async ({ page }) => {
    await enterFullMode(page);
    await page.getByRole('button', { name: 'Modo rápido' }).click();
    await expect(page.locator('.quick-mode-card')).toBeVisible();
  });
});

test('notas extendidas: guardar, reabrir, descartar y persistir tras recargar', async ({ page }) => {
  await enterFullMode(page);
  await page.locator('.desktop-tabs').getByRole('button', { name: 'Notas', exact: true }).click();
  await page.getByRole('button', { name: '+ Nota extendida', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Nota extendida', exact: true });
  await expect(modal).toBeVisible();
  const content = 'Proyecto de investigación #trabajo.\n'.repeat(400) + 'FIN DE LA NOTA';
  await modal.getByLabel('Título', { exact: true }).fill('Mi nota extendida');
  await modal.getByLabel('Contenido', { exact: true }).fill(content);
  const synced = page.waitForResponse((response) => response.url().includes('/api/sync') && response.request().postData()?.includes('FIN DE LA NOTA') === true);
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click();
  await synced;
  await expect(modal.getByRole('status')).toHaveText('Guardado en la app');
  const bounds = await page.locator('.extended-note-modal').boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: 'test-results/extended-note.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBounds = await page.locator('.extended-note-modal').boundingBox();
  expect(mobileBounds?.x).toBeGreaterThanOrEqual(0);
  expect((mobileBounds?.x || 0) + (mobileBounds?.width || 0)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/extended-note-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  const card = page.locator('.board-note').filter({ hasText: 'Mi nota extendida' });
  await expect(card).not.toContainText('FIN DE LA NOTA');
  await card.getByRole('button', { name: 'Abrir nota extendida', exact: true }).click();
  await expect(modal.getByLabel('Contenido', { exact: true })).toHaveValue(content);
  await modal.getByLabel('Contenido', { exact: true }).fill('Cambios descartados');
  await page.keyboard.press('Escape');
  await expect(modal.getByRole('alert')).toBeVisible();
  await modal.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  await expect.poll(async () => page.evaluate(() => Object.values(localStorage).some((value) => value.includes('FIN DE LA NOTA')))).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: /Modo completo/i }).click();
  await page.locator('.desktop-tabs').getByRole('button', { name: 'Notas', exact: true }).click();
  await card.getByRole('button', { name: 'Abrir nota extendida', exact: true }).click();
  await expect(modal.getByLabel('Contenido', { exact: true })).toHaveValue(content);
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.screenshot({ path: 'test-results/extended-note-board.png' });
});

test('notas extendidas: cancelar la creación no deja notas vacías', async ({ page }) => {
  await enterFullMode(page);
  await page.locator('.desktop-tabs').getByRole('button', { name: 'Notas', exact: true }).click();
  const count = await page.locator('.board-note').count();
  await page.getByRole('button', { name: '+ Nota extendida', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Nota extendida', exact: true });
  await expect(modal.getByLabel('Título', { exact: true })).toBeFocused();
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.locator('.board-note')).toHaveCount(count);
  await page.getByRole('button', { name: '+ Nota extendida', exact: true }).click();
  await modal.getByLabel('Contenido', { exact: true }).fill('Borrador descartado');
  await page.keyboard.press('Escape');
  await expect(modal.getByRole('button', { name: 'Seguir editando' })).toBeFocused();
  await modal.getByRole('button', { name: 'Descartar cambios' }).click();
  await expect(page.locator('.board-note')).toHaveCount(count);
});

test('notas extendidas: ampliar una nota rápida conserva contenido e ID y permite guardar con teclado', async ({ page }) => {
  await enterFullMode(page);
  await page.locator('.desktop-tabs').getByRole('button', { name: 'Notas', exact: true }).click();
  await page.getByRole('button', { name: '+ Nueva Nota', exact: true }).click();
  const card = page.locator('.board-note').first();
  await card.getByPlaceholder('Título', { exact: true }).fill('Nota rápida ampliada');
  await card.getByPlaceholder('Escribe tu nota…').fill('Contenido original');
  const id = await card.getAttribute('data-note-id');
  await card.getByRole('button', { name: 'Convertir en nota extendida' }).click();
  await card.getByRole('button', { name: 'Abrir nota extendida', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Nota extendida', exact: true });
  await expect(modal.getByLabel('Contenido', { exact: true })).toHaveValue('Contenido original');
  await modal.getByLabel('Contenido', { exact: true }).fill('Contenido ampliado con teclado');
  const savedToCloud = page.waitForResponse((response) => response.url().includes('/api/sync') && response.request().postData()?.includes('Contenido ampliado con teclado') === true);
  await page.keyboard.press('Control+s');
  await savedToCloud;
  await expect(modal.getByRole('status')).toHaveText('Guardado en la app');
  await expect(modal.getByText('4 palabras', { exact: false })).toBeVisible();
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(card).toHaveAttribute('data-note-id', id!);
  await expect(card).toContainText('Contenido ampliado con teclado');
  await page.route((url) => url.pathname === '/api/notes/ai', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ meta: [{
      noteId: id, status: 'ready', tags: ['trabajo', 'oculta'], dismissed: ['tag:oculta'],
      summary: 'Resumen de la nota ampliada', classification: 'Trabajo',
    }] }),
  }));
  await page.reload();
  await page.getByRole('button', { name: /Modo completo/i }).click();
  await page.locator('.desktop-tabs').getByRole('button', { name: 'Notas', exact: true }).click();
  await card.getByRole('button', { name: 'Abrir nota extendida', exact: true }).click();
  await expect(modal.getByLabel('Etiquetas de la nota')).toHaveText('#trabajo');
  await expect(modal.getByText('Resumen de la nota ampliada', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 600 });
  await modal.getByLabel('Contenido', { exact: true }).fill('Cambios pendientes');
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Seguir editando' })).toBeInViewport();
  await modal.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(modal.getByLabel('Contenido', { exact: true })).toBeFocused();
});

test('notas extendidas: seleccionar tarjeta y relaciones no abre el editor', async ({ page }) => {
  const notes = [
    { id: 'extended-a', title: 'Nota A', text: 'Contenido A', noteType: 'extended', x: 24, y: 20 },
    { id: 'extended-b', title: 'Nota B', text: 'Contenido B', noteType: 'extended', x: 270, y: 20 },
  ];
  await page.route((url) => url.pathname === '/api/data', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ tasks: [], boardNotes: notes, events: [],
      profiles: [{ id: 'e2e-ws-1', name: 'E2E' }], activeProfileId: 'e2e-ws-1' }),
  }));
  await page.route((url) => url.pathname === '/api/notes/ai', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ meta: [
      { noteId: 'extended-a', status: 'ready', relatedIds: ['extended-b'] },
      { noteId: 'extended-b', status: 'ready', relatedIds: ['extended-a'] },
    ] }),
  }));
  await enterFullMode(page);
  await page.locator('.desktop-tabs').getByRole('button', { name: 'Notas', exact: true }).click();
  const cardA = page.locator('[data-note-id="extended-a"]');
  const cardB = page.locator('[data-note-id="extended-b"]');
  const modal = page.getByRole('dialog', { name: 'Nota extendida', exact: true });
  await cardA.getByRole('button', { name: 'Seleccionar nota: Nota A', exact: true }).click();
  await expect(cardA).toHaveClass(/board-note--selected/);
  await expect(modal).not.toBeVisible();
  const related = page.locator('.board-related-panel');
  await related.getByRole('button', { name: /Nota B/ }).click();
  await expect(cardB).toHaveClass(/board-note--selected/);
  await expect(modal).not.toBeVisible();
  await expect(related.getByRole('button', { name: /Nota A/ })).toBeVisible();
  await cardA.click({ position: { x: 6, y: 6 } });
  await expect(cardA).toHaveClass(/board-note--selected/);
  await expect(modal).not.toBeVisible();
  await cardA.getByRole('button', { name: 'Abrir nota extendida', exact: true }).click();
  await expect(modal.getByLabel('Título', { exact: true })).toHaveValue('Nota A');
});
