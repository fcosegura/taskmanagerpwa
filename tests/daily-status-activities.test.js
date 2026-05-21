import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectDailyStatusActivities,
  clampDailyStatusDays,
  dailyStatusWindowMs,
  partitionDailyStatusActivities,
  statusChangesForDailyReport,
} from '../src/dailyStatusActivities.js';

test('clampDailyStatusDays defaults to 2 and caps at 7', () => {
  assert.equal(clampDailyStatusDays(undefined), 2);
  assert.equal(clampDailyStatusDays(99), 7);
  assert.equal(clampDailyStatusDays(3), 3);
});

test('collectDailyStatusActivities includes task with status change in window', () => {
  const now = new Date('2026-05-21T15:00:00');
  const tasks = [{
    id: 't1',
    name: 'API',
    status: 'in_progress',
    priority: 'medium',
    createdAt: '2026-05-01T10:00:00.000Z',
    statusLog: [{
      id: 'e1',
      fromStatus: 'not_done',
      toStatus: 'in_progress',
      comment: 'Inicio',
      at: '2026-05-21T09:00:00.000Z',
    }],
  }];
  const { activities, days } = collectDailyStatusActivities(tasks, 2, now);
  assert.equal(days, 2);
  assert.equal(activities.length, 1);
  assert.equal(activities[0].statusChanges.length, 1);
});

test('collectDailyStatusActivities includes newly created task', () => {
  const now = new Date('2026-05-21T12:00:00');
  const tasks = [{
    id: 't2',
    name: 'Nueva',
    status: 'not_done',
    priority: 'low',
    createdAt: '2026-05-21T08:00:00.000Z',
    statusLog: [],
  }];
  const { activities } = collectDailyStatusActivities(tasks, 2, now);
  assert.equal(activities.length, 1);
  assert.equal(activities[0].createdInWindow, true);
});

test('collectDailyStatusActivities excludes stale task', () => {
  const now = new Date('2026-05-21T12:00:00');
  const tasks = [{
    id: 't3',
    name: 'Vieja',
    status: 'not_done',
    priority: 'low',
    createdAt: '2026-04-01T08:00:00.000Z',
    statusLog: [],
    completedAt: '',
  }];
  const { activities } = collectDailyStatusActivities(tasks, 2, now);
  assert.equal(activities.length, 0);
});

test('dailyStatusWindowMs spans N local days', () => {
  const now = new Date('2026-05-21T12:00:00');
  const { startMs, endMs, days } = dailyStatusWindowMs(2, now);
  assert.equal(days, 2);
  assert.ok(startMs < endMs);
});

test('statusChangesForDailyReport hides in_progress steps when task is done', () => {
  const item = {
    currentStatus: 'done',
    statusChanges: [
      { id: '1', fromStatus: 'not_done', toStatus: 'in_progress', comment: 'a', at: '2026-05-21T10:00:00.000Z' },
      { id: '2', fromStatus: 'in_progress', toStatus: 'done', comment: 'b', at: '2026-05-21T11:00:00.000Z' },
    ],
  };
  assert.equal(statusChangesForDailyReport(item).length, 1);
  assert.equal(statusChangesForDailyReport(item)[0].toStatus, 'done');
});

test('partitionDailyStatusActivities puts done tasks in doneInPeriod not activeNow', () => {
  const { doneInPeriod, activeNow } = partitionDailyStatusActivities([{
    name: 'Vieja hecha',
    currentStatus: 'done',
    completedInWindow: false,
    createdInWindow: false,
    statusChanges: [{
      id: '1',
      fromStatus: 'in_progress',
      toStatus: 'in_progress',
      comment: 'sigue',
      at: '2026-05-21T09:00:00.000Z',
    }],
  }]);
  assert.equal(activeNow.length, 0);
  assert.equal(doneInPeriod.length, 1);
});
