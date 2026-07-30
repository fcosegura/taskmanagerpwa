import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getHiddenKanbanTaskCount,
  getVisibleKanbanTasks,
  KANBAN_COLLAPSED_TASK_LIMIT,
} from '../src/kanbanTaskLimit.js';

test('collapsed Kanban column shows its five most recent tasks', () => {
  const tasks = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));

  assert.deepEqual(getVisibleKanbanTasks(tasks, false), tasks.slice(-KANBAN_COLLAPSED_TASK_LIMIT));
  assert.equal(getHiddenKanbanTaskCount(tasks, false), 2);
});

test('expanded Kanban column shows every task', () => {
  const tasks = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));

  assert.deepEqual(getVisibleKanbanTasks(tasks, true), tasks);
  assert.equal(getHiddenKanbanTaskCount(tasks, true), 0);
});
