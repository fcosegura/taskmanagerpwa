import test from 'node:test';
import assert from 'node:assert/strict';
import { appendStatusLogEntry, normalizeStatusLog, MAX_STATUS_LOG_ENTRIES } from '../src/statusLog.js';

test('appendStatusLogEntry adds valid entry', () => {
  const task = { id: '1', status: 'not_done', statusLog: [] };
  const next = appendStatusLogEntry(task, {
    fromStatus: 'not_done',
    toStatus: 'in_progress',
    comment: 'Empecé el trabajo',
    at: '2026-05-20T10:00:00.000Z',
  });
  assert.equal(next.statusLog.length, 1);
  assert.equal(next.statusLog[0].comment, 'Empecé el trabajo');
});

test('normalizeStatusLog drops invalid entries', () => {
  const raw = [
    { id: 'a', fromStatus: 'not_done', toStatus: 'in_progress', comment: 'ok', at: '2026-05-20T10:00:00.000Z' },
    { id: 'b', toStatus: 'bad', comment: 'x', at: '2026-05-20T10:00:00.000Z' },
  ];
  assert.equal(normalizeStatusLog(raw).length, 1);
});

test('appendStatusLogEntry caps history length', () => {
  let task = { id: '1', status: 'not_done', statusLog: [] };
  for (let i = 0; i < MAX_STATUS_LOG_ENTRIES + 5; i += 1) {
    task = appendStatusLogEntry(task, {
      fromStatus: 'not_done',
      toStatus: 'in_progress',
      comment: `c${i}`,
      at: new Date(2026, 0, 1, 0, i).toISOString(),
    });
  }
  assert.equal(task.statusLog.length, MAX_STATUS_LOG_ENTRIES);
});
