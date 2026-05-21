import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyStatusFallbackReport } from '../src/dailyStatusFallback.js';

test('buildDailyStatusFallbackReport empty activities', () => {
  const report = buildDailyStatusFallbackReport([], 2);
  assert.match(report, /sin actividad/i);
});

test('buildDailyStatusFallbackReport lists status change comment', () => {
  const report = buildDailyStatusFallbackReport([{
    name: 'Deploy',
    ticketNumber: '',
    currentStatus: 'in_progress',
    createdInWindow: false,
    completedInWindow: false,
    statusChanges: [{
      fromStatus: 'not_done',
      toStatus: 'in_progress',
      comment: 'Arranque sprint',
      at: '2026-05-21T10:00:00.000Z',
    }],
    notes: '',
  }], 2);
  assert.match(report, /Deploy/);
  assert.match(report, /Arranque sprint/);
});
