import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isChildTask } from '../src/kanbanTaskVisibility.js';

function isParentTask(task) {
  return Array.isArray(task?.dependencyTaskIds) && task.dependencyTaskIds.length > 0;
}

function taskMatchesRoleFilter(task, allTasks, roleFilter) {
  if (roleFilter === 'parent') return isParentTask(task);
  if (roleFilter === 'child') return isChildTask(allTasks, task.id);
  return true;
}

const allTasks = [
  { id: 'p1', name: 'Padre', dependencyTaskIds: ['c1'] },
  { id: 'c1', name: 'Hija' },
  { id: 'solo', name: 'Suelta' },
];

describe('kanban task role filter', () => {
  it('parent filter keeps tasks with assigned children', () => {
    assert.equal(taskMatchesRoleFilter(allTasks[0], allTasks, 'parent'), true);
    assert.equal(taskMatchesRoleFilter(allTasks[1], allTasks, 'parent'), false);
    assert.equal(taskMatchesRoleFilter(allTasks[2], allTasks, 'parent'), false);
  });

  it('child filter keeps tasks linked to a parent', () => {
    assert.equal(taskMatchesRoleFilter(allTasks[0], allTasks, 'child'), false);
    assert.equal(taskMatchesRoleFilter(allTasks[1], allTasks, 'child'), true);
    assert.equal(taskMatchesRoleFilter(allTasks[2], allTasks, 'child'), false);
  });

  it('all filter keeps every task', () => {
    allTasks.forEach((task) => {
      assert.equal(taskMatchesRoleFilter(task, allTasks, 'all'), true);
    });
  });
});
