import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getHiddenKanbanTaskCount,
  getVisibleKanbanTasks,
  KANBAN_COLLAPSED_TASK_LIMIT,
  sortKanbanTasksByRecency,
} from '../src/kanbanTaskLimit.js';

test('Kanban shows the five most recently completed tasks first', () => {
  const tasks = Array.from({ length: 7 }, (_, index) => ({
    id: String(index + 1),
    completedAt: `2026-07-0${index + 1}T10:00:00.000Z`,
  }));

  const ordered = sortKanbanTasksByRecency(tasks, 'done');
  assert.deepEqual(getVisibleKanbanTasks(ordered, false).map((task) => task.id), ['7', '6', '5', '4', '3']);
  assert.equal(getHiddenKanbanTaskCount(ordered, false), 2);
});

test('Kanban orders active tasks by their latest arrival to the current status', () => {
  const tasks = [
    { id: 'old', statusLog: [{ id: '1', fromStatus: 'not_done', toStatus: 'in_progress', comment: 'Inicio', at: '2026-07-01T10:00:00.000Z' }] },
    { id: 'latest', statusLog: [{ id: '2', fromStatus: 'not_done', toStatus: 'in_progress', comment: 'Inicio', at: '2026-07-03T10:00:00.000Z' }] },
    { id: 'returned', statusLog: [
      { id: '3', fromStatus: 'not_done', toStatus: 'in_progress', comment: 'Primera vez', at: '2026-07-02T10:00:00.000Z' },
      { id: '4', fromStatus: 'paused', toStatus: 'in_progress', comment: 'Retomada', at: '2026-07-04T10:00:00.000Z' },
    ] },
  ];

  assert.deepEqual(sortKanbanTasksByRecency(tasks, 'in_progress').map((task) => task.id), ['returned', 'latest', 'old']);
});

test('expanded Kanban column shows every task', () => {
  const tasks = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));

  assert.equal(KANBAN_COLLAPSED_TASK_LIMIT, 5);
  assert.deepEqual(getVisibleKanbanTasks(tasks, true), tasks);
  assert.equal(getHiddenKanbanTaskCount(tasks, true), 0);
});
