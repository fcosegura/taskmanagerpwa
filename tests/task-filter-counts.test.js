import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countTasksWithParentStatusDedup,
  countTasksByStatus,
} from '../src/taskFilterCounts.js';

describe('countTasksWithParentStatusDedup', () => {
  it('counts parent and child with same blocked status as one', () => {
    const tasks = [
      { id: 'p', status: 'blocked', dependencyTaskIds: ['c'] },
      { id: 'c', status: 'blocked' },
    ];
    assert.equal(
      countTasksWithParentStatusDedup(tasks, (t) => t.status === 'blocked'),
      1,
    );
  });

  it('counts parent and child independently when statuses differ', () => {
    const tasks = [
      { id: 'p', status: 'blocked', dependencyTaskIds: ['c'] },
      { id: 'c', status: 'in_progress' },
    ];
    assert.equal(
      countTasksWithParentStatusDedup(tasks, (t) => t.status === 'blocked'),
      1,
    );
    assert.equal(
      countTasksWithParentStatusDedup(tasks, (t) => t.status === 'in_progress'),
      1,
    );
    assert.equal(
      countTasksWithParentStatusDedup(tasks, (t) => t.status !== 'done'),
      2,
    );
  });

  it('collapses multiple children that share parent status', () => {
    const tasks = [
      { id: 'p', status: 'done', dependencyTaskIds: ['c1', 'c2'] },
      { id: 'c1', status: 'done' },
      { id: 'c2', status: 'done' },
    ];
    assert.equal(
      countTasksWithParentStatusDedup(tasks, (t) => t.status === 'done'),
      1,
    );
  });

  it('counts child when parent does not match the filter', () => {
    const tasks = [
      { id: 'p', status: 'done', dependencyTaskIds: ['c'] },
      { id: 'c', status: 'blocked' },
    ];
    assert.equal(
      countTasksWithParentStatusDedup(tasks, (t) => t.status === 'blocked'),
      1,
    );
  });

  it('dedupes activas when parent and child share status', () => {
    const tasks = [
      { id: 'p', status: 'not_done', dependencyTaskIds: ['c'] },
      { id: 'c', status: 'not_done' },
    ];
    assert.equal(
      countTasksWithParentStatusDedup(tasks, (t) => t.status !== 'done'),
      1,
    );
  });

  it('dedupes hoy metric when parent and child match and share status', () => {
    const today = '2026-05-22';
    const tasks = [
      { id: 'p', status: 'blocked', date: today, dependencyTaskIds: ['c'] },
      { id: 'c', status: 'blocked', date: today },
    ];
    const isTodayOpen = (t) => t.date === today && t.status !== 'done';
    assert.equal(countTasksWithParentStatusDedup(tasks, isTodayOpen), 1);
  });

  it('counts hoy independently when statuses differ', () => {
    const today = '2026-05-22';
    const tasks = [
      { id: 'p', status: 'not_done', date: today, dependencyTaskIds: ['c'] },
      { id: 'c', status: 'blocked', date: today },
    ];
    const isTodayOpen = (t) => t.date === today && t.status !== 'done';
    assert.equal(countTasksWithParentStatusDedup(tasks, isTodayOpen), 2);
  });
});

describe('countTasksByStatus', () => {
  it('returns per-status counts with deduplication', () => {
    const tasks = [
      { id: 'p', status: 'blocked', dependencyTaskIds: ['c'] },
      { id: 'c', status: 'blocked' },
      { id: 'solo', status: 'blocked' },
    ];
    assert.equal(countTasksByStatus(tasks, 'blocked'), 2);
  });
});
