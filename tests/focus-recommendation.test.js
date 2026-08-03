import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { STATUS, normalizeStatusDefinition, normalizeStatuses } from '../src/constants.js';
import { recommendNextFocusTask } from '../src/focusRecommendation.js';

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

  test('normalizes old custom statuses without metadata', () => {
    const oldCustomStatus = { v: 'custom_old_status', label: 'Mi Estado Viejo', tv: '--color-text-primary', bv: '--color-background-secondary', bov: '--color-border-secondary' };
    const normalized = normalizeStatusDefinition(oldCustomStatus);

    assert.strictEqual(normalized.v, 'custom_old_status');
    assert.strictEqual(normalized.kind, 'backlog');
    assert.strictEqual(normalized.isTerminal, false);
    assert.strictEqual(normalized.canBeFocused, true);
    assert.strictEqual(normalized.sortWeight, 50);
  });

  test('separates visual theme from semantic kind', () => {
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
      { v: 'custom_fast', label: 'Rápido', kind: 'active', sortWeight: 200, canBeFocused: true },
      { v: 'custom_slow', label: 'Lento', kind: 'active', sortWeight: 50, canBeFocused: true }
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
