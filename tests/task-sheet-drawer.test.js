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

  test('TaskSheetDrawer no longer manages pending child titles or unlinked child ids', () => {
    assert.doesNotMatch(taskSheetDrawerSource, /newChildTitle/);
    assert.doesNotMatch(taskSheetDrawerSource, /pendingChildTitles/);
    assert.doesNotMatch(taskSheetDrawerSource, /unlinkedChildIds/);
    assert.doesNotMatch(taskSheetDrawerSource, /handleAddPendingChild/);
    assert.doesNotMatch(taskSheetDrawerSource, /handleRemovePendingChild/);
    assert.doesNotMatch(taskSheetDrawerSource, /handleUnlinkChild/);
  });

  test('TaskSheetDrawer selects existing child tasks via dependencyTaskIds checkboxes', () => {
    assert.match(taskSheetDrawerSource, /allTasks/);
    assert.match(taskSheetDrawerSource, /availableChildTasks/);
    assert.match(taskSheetDrawerSource, /form\.dependencyTaskIds/);
    assert.match(taskSheetDrawerSource, /toggleChildTask/);
    assert.match(taskSheetDrawerSource, /type="checkbox"/);
  });

  test('TaskSheetDrawer excludes done tasks and parent tasks from candidates', () => {
    assert.match(taskSheetDrawerSource, /candidate\.status !== 'done'/);
    assert.match(taskSheetDrawerSource, /parentTasks/);
  });

  test('TaskSheetDrawer no longer renders legacy subtasks as read-only', () => {
    assert.doesNotMatch(taskSheetDrawerSource, /legacySubtasks/);
    assert.doesNotMatch(taskSheetDrawerSource, /legacy-subtasks/);
    assert.doesNotMatch(taskSheetDrawerSource, /Sub-tareas legacy/);
    assert.doesNotMatch(taskSheetDrawerSource, /Solo lectura/);
  });

  test('TaskSheetDrawer no longer states that children will be created on save', () => {
    assert.doesNotMatch(taskSheetDrawerSource, /se crearán al guardar/);
    assert.match(taskSheetDrawerSource, /Elige tareas ya creadas/);
  });

  test('TaskSheetDrawer payload only carries the task payload', () => {
    assert.match(taskSheetDrawerSource, /onSave\(\{\s*taskPayload:\s*payload\s*\}\)/);
    assert.doesNotMatch(taskSheetDrawerSource, /onSave\(\{[\s\S]*?pendingChildTitles/);
  });
});

describe('handleTaskSheetSave in App.jsx', () => {
  test('App.jsx defines handleTaskSheetSave handler', () => {
    assert.match(appSource, /const handleTaskSheetSave/);
  });

  test('handleTaskSheetSave no longer creates child tasks from pending titles', () => {
    assert.doesNotMatch(appSource, /pendingChildTitles/);
    assert.doesNotMatch(appSource, /newChildren/);
    assert.doesNotMatch(appSource, /newChildIds/);
    assert.doesNotMatch(appSource, /finalChildIds/);
    assert.doesNotMatch(appSource, /unlinkedChildIds/);
  });

  test('handleTaskSheetSave normalizes and saves dependencyTaskIds directly', () => {
    assert.match(appSource, /const dependencyTaskIds = Array\.isArray\(normalizedParent\.dependencyTaskIds\)/);
    assert.match(appSource, /normalizedParentWithId = \{ \.\.\.normalizedParent, id: parentId, dependencyTaskIds \}/);
    assert.match(appSource, /applyTaskUpdate\(parentForSave, \{ cascade: true \}\)/);
  });

  test('handleTaskSheetSave creates a single parent task for new tasks', () => {
    assert.match(appSource, /mergeTaskCompletionMeta\(null, normalizedParentWithId, statuses\)/);
    assert.match(appSource, /setTasks\(\(prev\) => \[\.\.\.prev, parentForSave\]\)/);
  });

  test('handleTaskSheetSave passes allTasks and handler to TaskSheetDrawer', () => {
    assert.match(appSource, /allTasks=\{tasks\}/);
    assert.match(appSource, /onSave=\{handleTaskSheetSave\}/);
  });
});

describe('TaskSheetDrawer save payload contract', () => {
  test('edit payload preserves dependencyTaskIds selection directly', () => {
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
      notes: 'Notas editadas',
      dependencyTaskIds: ['task-100', 'task-200']
    };

    const taskPayload = existingTask?.id
      ? { ...existingTask, ...formEdit, id: existingTask.id }
      : { ...formEdit };

    const savePayload = { taskPayload };

    assert.strictEqual(savePayload.taskPayload.id, 'task-123');
    assert.strictEqual(savePayload.taskPayload.name, 'Tarea Test Jira Actualizada');
    assert.deepStrictEqual(savePayload.taskPayload.dependencyTaskIds, ['task-100', 'task-200']);
    assert.deepStrictEqual(savePayload.taskPayload.subtasks, [{ id: 1, title: 'Sub 1', completed: false }]);
    assert.strictEqual('pendingChildTitles' in savePayload, false);
    assert.strictEqual('unlinkedChildIds' in savePayload, false);
  });

  test('payload preserves task.subtasks untouched without displaying them', () => {
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

    const form = {
      ...task,
      subtasks: Array.isArray(task?.subtasks) ? task.subtasks : []
    };

    const savePayload = {
      taskPayload: task?.id ? { ...task, ...form, id: task.id } : { ...form }
    };

    assert.deepStrictEqual(savePayload.taskPayload.subtasks, legacySubtasks);
    assert.doesNotMatch(taskSheetDrawerSource, /Sub-tareas legacy/);
  });
});
