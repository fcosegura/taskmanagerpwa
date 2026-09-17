import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStatusWithChildCascade,
  getChildIdsForParent,
  shouldCascadeStatusToChildren,
} from '../src/taskStatusCascade.js';

const parent = {
  id: 'p1',
  name: 'Parent',
  status: 'in_progress',
  dependencyTaskIds: ['c1', 'c2'],
};

const child1 = { id: 'c1', name: 'Child 1', status: 'not_done' };
const child2 = { id: 'c2', name: 'Child 2', status: 'in_progress' };
const other = { id: 'x1', name: 'Other', status: 'not_done' };

describe('shouldCascadeStatusToChildren', () => {
  it('cascades blocked, paused, and done', () => {
    assert.equal(shouldCascadeStatusToChildren('blocked'), true);
    assert.equal(shouldCascadeStatusToChildren('paused'), true);
    assert.equal(shouldCascadeStatusToChildren('done'), true);
  });

  it('does not cascade not_done or in_progress', () => {
    assert.equal(shouldCascadeStatusToChildren('not_done'), false);
    assert.equal(shouldCascadeStatusToChildren('in_progress'), false);
  });
});

describe('applyStatusWithChildCascade', () => {
  it('updates children when parent moves to blocked', () => {
    const tasks = [parent, child1, child2, other];
    const result = applyStatusWithChildCascade(tasks, 'p1', 'blocked');
    assert.equal(result.find((t) => t.id === 'p1').status, 'blocked');
    assert.equal(result.find((t) => t.id === 'c1').status, 'blocked');
    assert.equal(result.find((t) => t.id === 'c2').status, 'blocked');
    assert.equal(result.find((t) => t.id === 'x1').status, 'not_done');
  });

  it('updates children when parent moves to done and sets completedAt', () => {
    const tasks = [parent, child1, child2];
    const result = applyStatusWithChildCascade(tasks, 'p1', 'done');
    assert.equal(result.find((t) => t.id === 'p1').status, 'done');
    assert.ok(result.find((t) => t.id === 'p1').completedAt);
    assert.equal(result.find((t) => t.id === 'c1').status, 'done');
    assert.ok(result.find((t) => t.id === 'c1').completedAt);
  });

  it('only updates parent for in_progress', () => {
    const tasks = [parent, child1, child2];
    const result = applyStatusWithChildCascade(tasks, 'p1', 'in_progress');
    assert.equal(result.find((t) => t.id === 'p1').status, 'in_progress');
    assert.equal(result.find((t) => t.id === 'c1').status, 'not_done');
    assert.equal(result.find((t) => t.id === 'c2').status, 'in_progress');
  });

  it('cascades recursively to grandchildren (A6)', () => {
    const tasks = [
      { id: 'p', status: 'in_progress', dependencyTaskIds: ['c'] },
      { id: 'c', status: 'not_done', dependencyTaskIds: ['g'] },
      { id: 'g', status: 'not_done' },
    ];
    const result = applyStatusWithChildCascade(tasks, 'p', 'done');
    assert.equal(result.find((t) => t.id === 'c').status, 'done');
    assert.equal(result.find((t) => t.id === 'g').status, 'done');
    assert.ok(result.find((t) => t.id === 'c').completedAt);
    assert.ok(result.find((t) => t.id === 'g').completedAt);
  });

  it('is cycle-safe when dependencies loop (A6)', () => {
    const tasks = [
      { id: 'a', status: 'in_progress', dependencyTaskIds: ['b'] },
      { id: 'b', status: 'not_done', dependencyTaskIds: ['a'] },
    ];
    const result = applyStatusWithChildCascade(tasks, 'a', 'blocked');
    assert.equal(result.find((t) => t.id === 'a').status, 'blocked');
    assert.equal(result.find((t) => t.id === 'b').status, 'blocked');
  });
});

describe('getChildIdsForParent', () => {
  it('returns unique dependency ids', () => {
    assert.deepEqual(getChildIdsForParent(parent), ['c1', 'c2']);
  });
});
