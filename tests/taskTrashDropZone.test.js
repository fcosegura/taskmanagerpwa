import test from 'node:test';
import assert from 'node:assert/strict';
import { countOpenChildTasks } from '../src/taskTrashHelpers.js';

test('countOpenChildTasks: returns 0 when parent has no dependencies', () => {
  assert.equal(countOpenChildTasks({ id: 'p', dependencyTaskIds: [] }, [{ id: 'a', status: 'not_done' }]), 0);
  assert.equal(countOpenChildTasks({ id: 'p' }, [{ id: 'a', status: 'not_done' }]), 0);
});

test('countOpenChildTasks: counts only non-done children', () => {
  const parent = { id: 'p', dependencyTaskIds: ['c1', 'c2', 'c3'] };
  const tasks = [
    { id: 'c1', status: 'not_done' },
    { id: 'c2', status: 'done' },
    { id: 'c3', status: 'in_progress' },
  ];
  assert.equal(countOpenChildTasks(parent, tasks), 2);
});

test('countOpenChildTasks: ignores missing child ids', () => {
  const parent = { id: 'p', dependencyTaskIds: ['gone', 'c1'] };
  const tasks = [{ id: 'c1', status: 'done' }];
  assert.equal(countOpenChildTasks(parent, tasks), 0);
});
