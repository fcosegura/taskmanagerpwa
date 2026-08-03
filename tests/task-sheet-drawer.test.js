import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { STATUS, PRIORITY } from '../src/constants.js';

describe('TaskSheetDrawer data model preservation & options', () => {
  test('constants.js defines valid PRIORITY and STATUS arrays with value and label', () => {
    assert.strictEqual(Array.isArray(PRIORITY), true);
    assert.strictEqual(PRIORITY.length, 4);
    assert.deepStrictEqual(
      PRIORITY.map((p) => p.v),
      ['low', 'medium', 'high', 'critical']
    );
    assert.deepStrictEqual(
      PRIORITY.map((p) => p.label),
      ['Baja', 'Media', 'Alta', 'Crítica']
    );

    assert.strictEqual(Array.isArray(STATUS), true);
    assert.strictEqual(STATUS.length, 5);
    assert.deepStrictEqual(
      STATUS.map((s) => s.v),
      ['not_done', 'in_progress', 'paused', 'blocked', 'done']
    );
    assert.deepStrictEqual(
      STATUS.map((s) => s.label),
      ['Sin iniciar', 'En progreso', 'En pausa', 'Bloqueado', 'Completado']
    );
  });

  test('payload creation preserves all task metadata, id, date, time, subtasks, ticketNumber, and url', () => {
    const existingTask = {
      id: 'task-123',
      name: 'Tarea Test Jira',
      category: 'Jira',
      ticketNumber: 'PROJ-999',
      url: 'https://jira.example.com/browse/PROJ-999',
      status: 'in_progress',
      priority: 'critical',
      date: '2026-08-01',
      time: '14:30',
      endDate: '2026-08-05',
      completedAt: '',
      hideInKanbanDone: false,
      notes: 'Notas de la tarea',
      subtasks: [{ id: 1, title: 'Sub 1', completed: false }],
      dependencyTaskIds: ['task-100']
    };

    const formEdit = {
      ...existingTask,
      name: 'Tarea Test Jira Actualizada',
      notes: 'Notas editadas'
    };

    // Simulated submit logic from TaskSheetDrawer
    const payload = existingTask?.id
      ? { ...existingTask, ...formEdit, id: existingTask.id }
      : { ...formEdit };

    assert.strictEqual(payload.id, 'task-123');
    assert.strictEqual(payload.name, 'Tarea Test Jira Actualizada');
    assert.strictEqual(payload.category, 'Jira');
    assert.strictEqual(payload.ticketNumber, 'PROJ-999');
    assert.strictEqual(payload.url, 'https://jira.example.com/browse/PROJ-999');
    assert.strictEqual(payload.status, 'in_progress');
    assert.strictEqual(payload.priority, 'critical');
    assert.strictEqual(payload.date, '2026-08-01');
    assert.strictEqual(payload.time, '14:30');
    assert.strictEqual(payload.notes, 'Notas editadas');
    assert.deepStrictEqual(payload.subtasks, [{ id: 1, title: 'Sub 1', completed: false }]);
    assert.deepStrictEqual(payload.dependencyTaskIds, ['task-100']);
  });
});
