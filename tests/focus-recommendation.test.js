import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { STATUS, STATUS_KINDS, normalizeStatusDefinition, normalizeStatuses } from '../src/constants.js';
import { recommendNextFocusTask } from '../src/focusRecommendation.js';
import { normalizeDataPayload, normalizeMultiBackupPayload } from '../src/storage.js';

describe('Status Semantics and Normalization', () => {
  test('normalizes standard statuses correctly with kind, isTerminal, canBeFocused, sortWeight', () => {
    const normalized = normalizeStatuses(STATUS);
    assert.strictEqual(normalized.length, 5);

    const doneStatus = normalized.find((s) => s.v === 'done');
    assert.strictEqual(doneStatus.kind, 'done');
    assert.strictEqual(doneStatus.isTerminal, true);
    assert.strictEqual(doneStatus.canBeFocused, false);

    const activeStatus = normalized.find((s) => s.v === 'in_progress');
    assert.strictEqual(activeStatus.kind, 'active');
    assert.strictEqual(activeStatus.isTerminal, false);
    assert.strictEqual(activeStatus.canBeFocused, true);
    assert.strictEqual(activeStatus.sortWeight, 100);
  });

  test('forces official semantics on standard status even with corrupt metadata', () => {
    const corruptDone = {
      v: 'done',
      label: 'Completado',
      kind: 'backlog',
      isTerminal: false,
      canBeFocused: true,
      sortWeight: 999
    };
    const normalized = normalizeStatusDefinition(corruptDone);

    assert.strictEqual(normalized.v, 'done');
    assert.strictEqual(normalized.kind, 'done');
    assert.strictEqual(normalized.isTerminal, true);
    assert.strictEqual(normalized.canBeFocused, false);
    assert.strictEqual(normalized.sortWeight, 0);
  });

  test('normalizes old custom statuses without metadata to backlog', () => {
    const oldCustomStatus = { v: 'custom_old_status', label: 'Mi Estado Viejo', tv: '--color-text-primary', bv: '--color-background-secondary', bov: '--color-border-secondary' };
    const normalized = normalizeStatusDefinition(oldCustomStatus);

    assert.strictEqual(normalized.v, 'custom_old_status');
    assert.strictEqual(normalized.kind, 'backlog');
    assert.strictEqual(normalized.isTerminal, false);
    assert.strictEqual(normalized.canBeFocused, true);
    assert.strictEqual(normalized.sortWeight, 50);
  });

  test('converts invalid custom status kind to backlog', () => {
    const invalidCustomStatus = { v: 'custom_invalid', label: 'Invalido', kind: 'super_kind' };
    const normalized = normalizeStatusDefinition(invalidCustomStatus);

    assert.strictEqual(normalized.kind, 'backlog');
    assert.strictEqual(normalized.isTerminal, false);
    assert.strictEqual(normalized.canBeFocused, true);
  });

  test('separates visual theme from semantic kind and preserves valid custom semantics', () => {
    const customStatus = {
      v: 'custom_waiting_client',
      label: 'Esperando cliente',
      theme: 'warning',
      kind: 'waiting',
      tv: '--color-text-warning',
      bv: '--color-background-warning',
      bov: '--color-border-warning'
    };

    const normalized = normalizeStatusDefinition(customStatus);
    assert.strictEqual(normalized.theme, 'warning');
    assert.strictEqual(normalized.kind, 'waiting');
    assert.strictEqual(normalized.canBeFocused, false);
  });
});

describe('Status Manager Modal Semantics Rules', () => {
  const DEFAULT_KEYS = new Set(['not_done', 'in_progress', 'paused', 'blocked', 'done']);

  test('standard statuses cannot change their semantic kind', () => {
    const standardDone = normalizeStatusDefinition({ v: 'done', label: 'Completado' });

    // Simulate update kind logic on standard status
    const updateKindOnStandard = (status, newKind) => {
      if (DEFAULT_KEYS.has(status.v)) return status; // Protection
      const kindMeta = STATUS_KINDS.find((k) => k.value === newKind) || STATUS_KINDS[0];
      return normalizeStatusDefinition({
        ...status,
        kind: newKind,
        isTerminal: kindMeta.isTerminal,
        canBeFocused: kindMeta.canBeFocused,
        sortWeight: kindMeta.sortWeight,
      });
    };

    const result = updateKindOnStandard(standardDone, 'backlog');
    assert.strictEqual(result.kind, 'done');
    assert.strictEqual(result.isTerminal, true);
  });

  test('custom statuses CAN change their semantic kind', () => {
    const customStatus = normalizeStatusDefinition({ v: 'custom_review', label: 'En revisión', kind: 'backlog' });

    const updateKindOnCustom = (status, newKind) => {
      if (DEFAULT_KEYS.has(status.v)) return status;
      const kindMeta = STATUS_KINDS.find((k) => k.value === newKind) || STATUS_KINDS[0];
      return normalizeStatusDefinition({
        ...status,
        kind: newKind,
        isTerminal: kindMeta.isTerminal,
        canBeFocused: kindMeta.canBeFocused,
        sortWeight: kindMeta.sortWeight,
      });
    };

    const result = updateKindOnCustom(customStatus, 'active');
    assert.strictEqual(result.kind, 'active');
    assert.strictEqual(result.canBeFocused, true);
    assert.strictEqual(result.sortWeight, 100);
  });

  test('changing visual theme does not automatically change semantic kind of an existing status', () => {
    const customStatus = normalizeStatusDefinition({
      v: 'custom_client',
      label: 'Esperando Cliente',
      theme: 'neutral',
      kind: 'waiting'
    });

    // Update theme only
    const updatedThemeStatus = normalizeStatusDefinition({
      ...customStatus,
      theme: 'danger',
      tv: '--color-text-danger',
      bv: '--color-background-danger',
      bov: '--color-border-danger'
    });

    assert.strictEqual(updatedThemeStatus.theme, 'danger');
    assert.strictEqual(updatedThemeStatus.kind, 'waiting'); // Preserved!
  });

  test('theme suggestion applies default kind on creation, allowing user override', () => {
    const THEME_TO_KIND_SUGGESTION = {
      neutral: 'backlog',
      info: 'active',
      warning: 'waiting',
      danger: 'blocked',
      success: 'done',
    };

    // User selects 'danger' theme for new status -> suggested kind is 'blocked'
    let selectedTheme = 'danger';
    let suggestedKind = THEME_TO_KIND_SUGGESTION[selectedTheme];
    assert.strictEqual(suggestedKind, 'blocked');

    // User explicitly overrides kind to 'active'
    let userChosenKind = 'active';
    const newStatus = normalizeStatusDefinition({
      v: 'custom_urgent_review',
      label: 'Revisión Urgente',
      theme: selectedTheme,
      kind: userChosenKind
    });

    assert.strictEqual(newStatus.theme, 'danger');
    assert.strictEqual(newStatus.kind, 'active');
  });
});

describe('Focus Recommendation Algorithm (recommendNextFocusTask)', () => {
  const todayStr = '2026-08-03';
  const fakeNow = new Date('2026-08-03T12:00:00Z');

  test('excludes terminal/done tasks from recommendation', () => {
    const tasks = [
      { id: '1', name: 'Tarea hecha', status: 'done', date: todayStr },
      { id: '2', name: 'Tarea terminal custom', status: 'custom_done', date: todayStr }
    ];
    const statuses = [
      { v: 'custom_done', label: 'Archivado', kind: 'done', isTerminal: true, canBeFocused: false, sortWeight: 0 }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow, statuses });
    assert.strictEqual(res.task, null);
    assert.strictEqual(res.reasonCode, 'none');
  });

  test('prioritizes overdue task over normal future or today task', () => {
    const tasks = [
      { id: 't-today', name: 'Tarea de hoy', date: '2026-08-03', status: 'not_done', priority: 'high' },
      { id: 't-overdue', name: 'Tarea vencida', date: '2026-08-01', status: 'not_done', priority: 'medium' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 't-overdue');
    assert.strictEqual(res.reasonCode, 'overdue');
    assert.strictEqual(res.reason, 'Vencida');
  });

  test('prioritizes overdue task over active future task', () => {
    const tasks = [
      { id: 't-active-future', name: 'Tarea activa mañana', date: '2026-08-04', status: 'in_progress', priority: 'critical' },
      { id: 't-overdue', name: 'Tarea vencida', date: '2026-08-01', status: 'not_done', priority: 'low' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 't-overdue');
  });

  test('prioritizes today task over future task of equivalent priority', () => {
    const tasks = [
      { id: 't-future', name: 'Tarea mañana', date: '2026-08-04', status: 'not_done', priority: 'high' },
      { id: 't-today', name: 'Tarea hoy', date: '2026-08-03', status: 'not_done', priority: 'high' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 't-today');
    assert.strictEqual(res.reasonCode, 'priority');
  });

  test('treats past time today as overdue/past', () => {
    const tasks = [
      { id: 't-past-time', name: 'Tarea de la mañana', date: '2026-08-03', time: '09:00', status: 'not_done' },
      { id: 't-future-time', name: 'Tarea de la tarde', date: '2026-08-03', time: '17:00', status: 'not_done' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 't-past-time');
    assert.strictEqual(res.reasonCode, 'overdue');
  });

  test('grants higher time bonus to tasks scheduled within next 2 hours', () => {
    const tasks = [
      { id: 't-near', name: 'Tarea en 1 hora', date: '2026-08-03', time: '13:00', status: 'not_done', priority: 'medium' },
      { id: 't-far', name: 'Tarea en 7 horas', date: '2026-08-03', time: '19:00', status: 'not_done', priority: 'medium' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 't-near');
  });

  test('prioritizes active state over backlog state of same date and priority', () => {
    const tasks = [
      { id: 't-backlog', name: 'Tarea sin iniciar', date: '2026-08-03', status: 'not_done', priority: 'medium' },
      { id: 't-active', name: 'Tarea en progreso', date: '2026-08-03', status: 'in_progress', priority: 'medium' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 't-active');
    assert.strictEqual(res.reasonCode, 'active');
    assert.strictEqual(res.reason, 'En progreso');
  });

  test('penalizes waiting and blocked states when actionable task is present', () => {
    const tasks = [
      { id: 't-blocked', name: 'Tarea bloqueada alta prioridad', date: '2026-08-03', status: 'blocked', priority: 'critical' },
      { id: 't-waiting', name: 'Tarea esperando alta prioridad', date: '2026-08-03', status: 'paused', priority: 'high' },
      { id: 't-actionable', name: 'Tarea pendiente prioridad media', date: '2026-08-03', status: 'not_done', priority: 'medium' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 't-actionable');
  });

  test('uses sortWeight and custom kind semantics correctly', () => {
    const statuses = [
      { v: 'custom_fast', label: 'Rápido', kind: 'active', sortWeight: 100, canBeFocused: true },
      { v: 'custom_slow', label: 'Lento', kind: 'active', sortWeight: 10, canBeFocused: true }
    ];
    const tasks = [
      { id: 't1', name: 'Tarea Lenta', status: 'custom_slow', date: '2026-08-03' },
      { id: 't2', name: 'Tarea Rápida', status: 'custom_fast', date: '2026-08-03' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow, statuses });
    assert.strictEqual(res.task.id, 't2');
  });

  test('respects canBeFocused and falls back to blocked/waiting when no actionable candidate exists', () => {
    const tasks = [
      { id: 't-blocked', name: 'Única tarea bloqueada', date: '2026-08-03', status: 'blocked' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 't-blocked');
    assert.strictEqual(res.reasonCode, 'blocked');
    assert.strictEqual(res.reason, 'Bloqueo pendiente');
  });

  test('falls back to waiting task with correct reason when only waiting tasks exist', () => {
    const tasks = [
      { id: 't-waiting', name: 'Única tarea pausada', date: '2026-08-03', status: 'paused' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 't-waiting');
    assert.strictEqual(res.reasonCode, 'waiting');
    assert.strictEqual(res.reason, 'Esperando respuesta');
  });

  test('breaks ties deterministically by priority, date, time, and id/name', () => {
    const tasks = [
      { id: 'b-task', name: 'B Task', date: '2026-08-03', status: 'not_done', priority: 'medium' },
      { id: 'a-task', name: 'A Task', date: '2026-08-03', status: 'not_done', priority: 'medium' }
    ];

    const res = recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(res.task.id, 'a-task');
  });

  test('does not mutate input tasks or input arrays', () => {
    const originalTask = { id: '1', name: 'Original', status: 'not_done', date: '2026-08-03' };
    const tasks = [originalTask];
    const tasksCopy = JSON.stringify(tasks);

    recommendNextFocusTask({ tasks, today: todayStr, now: fakeNow });
    assert.strictEqual(JSON.stringify(tasks), tasksCopy);
    assert.strictEqual(tasks[0], originalTask);
  });
});

describe('Backup Compatibility and Metadata Persistence', () => {
  test('normalizes legacy single workspace backup payload without customStatuses', () => {
    const legacyPayload = {
      tasks: [
        { id: 't1', name: 'Tarea legacy', status: 'not_done', priority: 'medium', subtasks: [] }
      ]
    };

    const normalized = normalizeDataPayload(legacyPayload);
    assert.strictEqual(normalized.tasks.length, 1);
    assert.strictEqual(normalized.tasks[0].id, 't1');
    assert.strictEqual(normalized.customStatuses, undefined);
  });

  test('preserves normalized customStatuses in multi-workspace backup payload', () => {
    const multiBackup = {
      workspaces: [
        {
          id: 'ws1',
          name: 'Workspace 1',
          tasks: [
            { id: 't1', name: 'Tarea 1', status: 'custom_review', priority: 'high', subtasks: [] }
          ],
          customStatuses: [
            { v: 'custom_review', label: 'En revisión', theme: 'info', kind: 'active' }
          ]
        }
      ]
    };

    const normalized = normalizeMultiBackupPayload(multiBackup);
    assert.ok(normalized);
    assert.strictEqual(normalized.workspaces.length, 1);
    assert.strictEqual(normalized.workspaces[0].customStatuses.length, 1);
    assert.strictEqual(normalized.workspaces[0].customStatuses[0].kind, 'active');
    assert.strictEqual(normalized.workspaces[0].customStatuses[0].canBeFocused, true);
  });
});
