import test from 'node:test';
import assert from 'node:assert/strict';
import { compareTasksForTaskList } from '../src/taskSorter.js';

test('compareTasksForTaskList active Jira vs active non-Jira', () => {
  const a = { id: '1', status: 'not_done', category: 'Jira Core', priority: 'medium' };
  const b = { id: '2', status: 'not_done', category: 'Personal', priority: 'medium' };
  
  // Jira task should go first (return negative)
  assert.ok(compareTasksForTaskList(a, b) < 0);
  assert.ok(compareTasksForTaskList(b, a) > 0);
});

test('compareTasksForTaskList active vs blocked/paused', () => {
  const active = { id: '1', status: 'in_progress', category: 'Personal', priority: 'critical' };
  const blocked = { id: '2', status: 'blocked', category: 'Jira Core', priority: 'critical' };
  const paused = { id: '3', status: 'paused', category: 'Jira Core', priority: 'critical' };

  // Active should go first (return negative) even if the blocked/paused tasks are Jira and have high priority
  assert.ok(compareTasksForTaskList(active, blocked) < 0);
  assert.ok(compareTasksForTaskList(active, paused) < 0);
});

test('compareTasksForTaskList blocked/paused vs done', () => {
  const blocked = { id: '1', status: 'blocked', category: 'Personal', priority: 'low' };
  const paused = { id: '2', status: 'paused', category: 'Personal', priority: 'low' };
  const done = { id: '3', status: 'done', category: 'Jira Core', priority: 'critical' };

  // Blocked/paused should go before done (return negative)
  assert.ok(compareTasksForTaskList(blocked, done) < 0);
  assert.ok(compareTasksForTaskList(paused, done) < 0);
});

test('compareTasksForTaskList priority within same group', () => {
  const a = { id: '1', status: 'not_done', category: 'Personal', priority: 'critical' };
  const b = { id: '2', status: 'not_done', category: 'Personal', priority: 'medium' };

  // Critical priority goes first
  assert.ok(compareTasksForTaskList(a, b) < 0);
  assert.ok(compareTasksForTaskList(b, a) > 0);
});
