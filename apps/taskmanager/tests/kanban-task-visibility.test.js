import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findParentTask,
  isChildTask,
  shouldShowTaskInKanbanDoneColumn,
} from '../src/kanbanTaskVisibility.js';

const tasks = [
  { id: 'p1', name: 'Parent', status: 'done', dependencyTaskIds: ['c1', 'c2'] },
  { id: 'c1', name: 'Child 1', status: 'done' },
  { id: 'c2', name: 'Child 2', status: 'in_progress' },
  { id: 'solo', name: 'Solo', status: 'done' },
];

describe('kanban done column visibility', () => {
  it('finds parent by dependencyTaskIds', () => {
    assert.equal(findParentTask(tasks, 'c1')?.id, 'p1');
    assert.equal(findParentTask(tasks, 'solo'), null);
  });

  it('hides done child when parent is done', () => {
    assert.equal(shouldShowTaskInKanbanDoneColumn(tasks[1], tasks), false);
  });

  it('shows done child when parent is not done', () => {
    const parentOpen = [
      { id: 'p', status: 'in_progress', dependencyTaskIds: ['c'] },
      { id: 'c', status: 'done' },
    ];
    assert.equal(shouldShowTaskInKanbanDoneColumn(parentOpen[1], parentOpen), true);
  });

  it('shows standalone and parent tasks in done column', () => {
    assert.equal(shouldShowTaskInKanbanDoneColumn(tasks[0], tasks), true);
    assert.equal(shouldShowTaskInKanbanDoneColumn(tasks[3], tasks), true);
  });

  it('shows in-progress child in done column when parent is done but child not done', () => {
    assert.equal(shouldShowTaskInKanbanDoneColumn(tasks[2], tasks), false);
    const parentDoneChildOpen = [
      { id: 'p', status: 'done', dependencyTaskIds: ['c'] },
      { id: 'c', status: 'in_progress' },
    ];
    assert.equal(shouldShowTaskInKanbanDoneColumn(parentDoneChildOpen[1], parentDoneChildOpen), false);
  });
});

describe('isChildTask', () => {
  it('detects child tasks', () => {
    assert.equal(isChildTask(tasks, 'c1'), true);
    assert.equal(isChildTask(tasks, 'p1'), false);
  });
});
