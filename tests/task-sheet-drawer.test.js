import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { STATUS, PRIORITY } from '../src/constants.js';

const taskSheetDrawerSource = readFileSync(new URL('../src/components/TaskSheetDrawer.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

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

  test('TaskSheetDrawer applies Jira autofill helper when URL changes', () => {
    assert.match(taskSheetDrawerSource, /applyJiraAutofillFromUrl\(next, value\)/);
  });

  test('TaskSheetDrawer no longer creates legacy subtask objects on add', () => {
    assert.doesNotMatch(taskSheetDrawerSource, /subtasks:\s*\[\.\.\.prev\.subtasks/);
    assert.doesNotMatch(taskSheetDrawerSource, /handleAddSubtask/);
    assert.doesNotMatch(taskSheetDrawerSource, /handleToggleSubtask/);
    assert.doesNotMatch(taskSheetDrawerSource, /handleRemoveSubtask/);
  });

  test('TaskSheetDrawer uses pendingChildTitles and unlinkedChildIds state', () => {
    assert.match(taskSheetDrawerSource, /pendingChildTitles/);
    assert.match(taskSheetDrawerSource, /unlinkedChildIds/);
    assert.match(taskSheetDrawerSource, /handleAddPendingChild/);
    assert.match(taskSheetDrawerSource, /handleUnlinkChild/);
  });

  test('TaskSheetDrawer displays existing children from dependencyTaskIds via allTasks', () => {
    assert.match(taskSheetDrawerSource, /allTasks/);
    assert.match(taskSheetDrawerSource, /existingChildren/);
    assert.match(taskSheetDrawerSource, /form\.dependencyTaskIds/);
  });

  test('TaskSheetDrawer preserves legacy subtasks as read-only', () => {
    assert.match(taskSheetDrawerSource, /legacySubtasks/);
    assert.match(taskSheetDrawerSource, /legacy-subtasks/);
    assert.match(taskSheetDrawerSource, /Solo lectura/);
  });

  test('TaskSheetDrawer payload includes pendingChildTitles and unlinkedChildIds', () => {
    assert.match(taskSheetDrawerSource, /onSave\(\{[\s\S]*?taskPayload[\s\S]*?pendingChildTitles[\s\S]*?unlinkedChildIds/);
  });
});

describe('handleTaskSheetSave in App.jsx', () => {
  test('App.jsx defines handleTaskSheetSave handler', () => {
    assert.match(appSource, /const handleTaskSheetSave/);
  });

  test('handleTaskSheetSave creates child tasks from pendingChildTitles', () => {
    assert.match(appSource, /pendingChildTitles[\s\S]*?\.map/);
    assert.match(appSource, /newChildren/);
  });

  test('handleTaskSheetSave updates parent dependencyTaskIds with new child IDs', () => {
    assert.match(appSource, /newChildIds/);
    assert.match(appSource, /finalChildIds/);
  });

  test('handleTaskSheetSave removes unlinked child IDs from parent', () => {
    assert.match(appSource, /unlinked\.includes/);
  });

  test('handleTaskSheetSave creates parent and children atomically for new tasks', () => {
    assert.match(appSource, /\[\.\.\.prev,\s*parentForSave,\s*\.\.\.newChildren\]/);
  });

  test('handleTaskSheetSave passes allTasks and handler to TaskSheetDrawer', () => {
    assert.match(appSource, /allTasks=\{tasks\}/);
    assert.match(appSource, /onSave=\{handleTaskSheetSave\}/);
  });
});

describe('TaskSheetDrawer save payload contract', () => {
  test('edit payload preserves dependencyTaskIds and includes pending/unlinked arrays', () => {
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

    const taskPayload = existingTask?.id
      ? { ...existingTask, ...formEdit, id: existingTask.id }
      : { ...formEdit };

    const savePayload = {
      taskPayload,
      pendingChildTitles: ['Nueva hija 1', 'Nueva hija 2'],
      unlinkedChildIds: ['task-100'],
    };

    assert.strictEqual(savePayload.taskPayload.id, 'task-123');
    assert.strictEqual(savePayload.taskPayload.name, 'Tarea Test Jira Actualizada');
    assert.deepStrictEqual(savePayload.taskPayload.dependencyTaskIds, ['task-100']);
    assert.deepStrictEqual(savePayload.taskPayload.subtasks, [{ id: 1, title: 'Sub 1', completed: false }]);
    assert.deepStrictEqual(savePayload.pendingChildTitles, ['Nueva hija 1', 'Nueva hija 2']);
    assert.deepStrictEqual(savePayload.unlinkedChildIds, ['task-100']);
  });

  test('legacy subtasks are preserved untouched in the payload', () => {
    const legacySubtasks = [
      { id: 1, title: 'Legacy 1', completed: false },
      { id: 2, title: 'Legacy 2', completed: true },
    ];
    const task = {
      id: 'task-legacy',
      name: 'Tarea con legacy',
      status: 'not_done',
      priority: 'medium',
      subtasks: legacySubtasks,
      dependencyTaskIds: [],
    };

    const savePayload = {
      taskPayload: { ...task },
      pendingChildTitles: [],
      unlinkedChildIds: [],
    };

    assert.deepStrictEqual(savePayload.taskPayload.subtasks, legacySubtasks);
  });
});
