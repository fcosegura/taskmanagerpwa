import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { getStatusInfo } from '../src/statusHelpers.js';

const statusMap = {
  not_done: { v: 'not_done', label: 'Sin iniciar', tv: '--color-text-primary' },
};

describe('getStatusInfo', () => {
  test('returns null for empty or falsy status keys', () => {
    assert.strictEqual(getStatusInfo('', statusMap), null);
    assert.strictEqual(getStatusInfo(undefined, statusMap), null);
    assert.strictEqual(getStatusInfo(null, statusMap), null);
  });

  test('returns the mapped definition when the status exists', () => {
    assert.strictEqual(getStatusInfo('not_done', statusMap), statusMap.not_done);
  });

  test('falls back to a formatted label with the info theme for unknown statuses', () => {
    assert.deepEqual(getStatusInfo('custom_review', statusMap), {
      v: 'custom_review',
      label: 'Custom Review',
      tv: '--color-text-info',
      bv: '--color-background-info',
      bov: '--color-border-info',
    });
  });

  test('does not throw and still formats the label when no map is provided', () => {
    assert.deepEqual(getStatusInfo('in_progress'), {
      v: 'in_progress',
      label: 'In Progress',
      tv: '--color-text-info',
      bv: '--color-background-info',
      bov: '--color-border-info',
    });
  });
});
