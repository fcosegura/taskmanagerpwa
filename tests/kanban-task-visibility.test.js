import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findParentTask,
  isChildTask,
  shouldShowTaskInKanbanDoneColumn,
  isTaskHiddenByCollapse,
} from '../src/kanbanTaskVisibility.js';
import { STATUS } from '../src/constants.js';

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

  it('hides a done child when the parent has a custom terminal status (M-F4)', () => {
    const customStatuses = [
      ...STATUS,
      { v: 'shipped', label: 'Enviado', kind: 'done', isTerminal: true, canBeFocused: false, sortWeight: 0 },
    ];
    const customTasks = [
      { id: 'p', status: 'shipped', dependencyTaskIds: ['c'] },
      { id: 'c', status: 'done' },
    ];
    assert.equal(shouldShowTaskInKanbanDoneColumn(customTasks[1], customTasks, customStatuses), false);
  });
});

describe('isTaskHiddenByCollapse (M-F5)', () => {
  it('hides a task when an ancestor is collapsed, shows it when expanded', () => {
    const parentByChild = new Map([['child', 'parent']]);
    assert.equal(isTaskHiddenByCollapse('child', parentByChild, new Set()), true);
    assert.equal(isTaskHiddenByCollapse('child', parentByChild, new Set(['parent'])), false);
    assert.equal(isTaskHiddenByCollapse('root', parentByChild, new Set()), false);
  });

  it('does not hang on cyclic ancestry and keeps the task visible', () => {
    const parentByChild = new Map([['a', 'b'], ['b', 'a']]);
    assert.equal(isTaskHiddenByCollapse('a', parentByChild, new Set(['a', 'b'])), false);
  });
});

describe('isChildTask', () => {
  it('detects child tasks', () => {
    assert.equal(isChildTask(tasks, 'c1'), true);
    assert.equal(isChildTask(tasks, 'p1'), false);
  });
});
