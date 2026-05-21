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
  assert.match(report, /Hoy \/ En curso/);
});

test('buildDailyStatusFallbackReport puts done tasks under Hecho not En curso', () => {
  const report = buildDailyStatusFallbackReport([{
    name: 'Legacy done',
    currentStatus: 'done',
    completedInWindow: false,
    createdInWindow: false,
    statusChanges: [{
      fromStatus: 'in_progress',
      toStatus: 'in_progress',
      comment: 'comentario reciente',
      at: '2026-05-21T10:00:00.000Z',
    }],
    notes: '',
  }], 2);
  const hechoIdx = report.indexOf('## Hecho');
  const cursoIdx = report.indexOf('## Hoy / En curso');
  const legacyIdx = report.indexOf('Legacy done');
  assert.ok(hechoIdx >= 0 && cursoIdx > hechoIdx);
  assert.ok(legacyIdx > hechoIdx && legacyIdx < cursoIdx);
});
