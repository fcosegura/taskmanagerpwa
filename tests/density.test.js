import test from 'node:test';
import assert from 'node:assert/strict';

test('density mode: normalizes comfortable and compact values correctly', () => {
  const normalizeDensity = (value) => {
    return value === 'compact' ? 'compact' : 'comfortable';
  };

  assert.equal(normalizeDensity('comfortable'), 'comfortable');
  assert.equal(normalizeDensity('compact'), 'compact');
  assert.equal(normalizeDensity('invalid'), 'comfortable');
  assert.equal(normalizeDensity(null), 'comfortable');
});
