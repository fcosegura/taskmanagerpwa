import test from 'node:test';
import assert from 'node:assert/strict';
import { isCompletedAtWithinKanbanRange, startOfLocalIsoWeekMs, mergeTaskCompletionMeta } from '../src/kanbanDoneRange.js';

test('isCompletedAtWithinKanbanRange: all always passes', () => {
  assert.equal(isCompletedAtWithinKanbanRange('', 'all'), true);
  assert.equal(isCompletedAtWithinKanbanRange('invalid', 'all'), true);
});

test('isCompletedAtWithinKanbanRange: rejects missing ISO when filtered', () => {
  assert.equal(isCompletedAtWithinKanbanRange('', 'week'), false);
  assert.equal(isCompletedAtWithinKanbanRange(null, 'month'), false);
});

test('week window uses Monday start (local)', () => {
  const now = new Date('2026-05-13T12:00:00'); // Wednesday
  const weekStart = startOfLocalIsoWeekMs(now);
  assert.equal(isCompletedAtWithinKanbanRange(new Date(weekStart).toISOString(), 'week', now), true);
  assert.equal(isCompletedAtWithinKanbanRange(new Date(weekStart - 86_400_000).toISOString(), 'week', now), false);
});

test('two_weeks is rolling 14 local days', () => {
  const now = new Date('2026-05-13T15:00:00');
  const lower = new Date(now);
  lower.setHours(0, 0, 0, 0);
  lower.setDate(lower.getDate() - 13);
  assert.equal(isCompletedAtWithinKanbanRange(lower.toISOString(), 'two_weeks', now), true);
  lower.setDate(lower.getDate() - 1);
  assert.equal(isCompletedAtWithinKanbanRange(lower.toISOString(), 'two_weeks', now), false);
});

test('mergeTaskCompletionMeta clears when leaving done', () => {
  const a = { id: '1', status: 'done', completedAt: '2026-01-01T00:00:00.000Z' };
  const b = mergeTaskCompletionMeta(a, { ...a, status: 'not_done' });
  assert.equal(b.completedAt, '');
});

test('mergeTaskCompletionMeta stamps when entering done', () => {
  const prev = { id: '1', status: 'not_done', completedAt: '' };
  const next = mergeTaskCompletionMeta(prev, { ...prev, status: 'done' });
  assert.ok(typeof next.completedAt === 'string' && next.completedAt.length > 10);
});
