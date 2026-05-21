import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { indexTasksByDate } from '../src/calendarTaskIndex.js';

describe('indexTasksByDate', () => {
  it('indexes tasks on start date', () => {
    const tByDate = indexTasksByDate([{ id: '1', name: 'A', date: '2026-05-10', status: 'not_done' }]);
    assert.equal(tByDate['2026-05-10']?.length, 1);
    assert.equal(tByDate['2026-05-10'][0].calendarDateRole, 'start');
  });

  it('indexes tasks on end date when different from start', () => {
    const tByDate = indexTasksByDate([
      { id: '1', name: 'A', date: '2026-05-10', endDate: '2026-05-15', status: 'not_done' },
    ]);
    assert.equal(tByDate['2026-05-10']?.length, 1);
    assert.equal(tByDate['2026-05-15']?.length, 1);
    assert.equal(tByDate['2026-05-15'][0].calendarDateRole, 'end');
  });

  it('does not duplicate when start and end are the same day', () => {
    const tByDate = indexTasksByDate([
      { id: '1', name: 'A', date: '2026-05-10', endDate: '2026-05-10', status: 'not_done' },
    ]);
    assert.equal(tByDate['2026-05-10']?.length, 1);
    assert.equal(tByDate['2026-05-15'], undefined);
  });

  it('shows only end marker when task has end date but no start date', () => {
    const tByDate = indexTasksByDate([
      { id: '1', name: 'A', date: '', endDate: '2026-05-20', status: 'not_done' },
    ]);
    assert.equal(tByDate['2026-05-20']?.length, 1);
    assert.equal(tByDate['2026-05-20'][0].calendarDateRole, 'end');
  });
});
