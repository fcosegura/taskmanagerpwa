import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { STATUS } from '../src/constants.js';
import {
  getDefaultChildTaskAllowedStatuses,
  loadChildTaskAllowedStatuses,
  saveChildTaskAllowedStatuses,
  isChildTaskStatusAllowed,
  STORAGE_KEY,
} from '../src/childTaskStatusPrefs.js';

function createStorage(initial = {}) {
  return {
    data: { ...initial },
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) { this.data[key] = value; },
  };
}

describe('Child task allowed statuses prefs', () => {
  test('defaults to all non-terminal statuses', () => {
    const defaults = getDefaultChildTaskAllowedStatuses(STATUS);
    assert.deepEqual(defaults, ['not_done', 'in_progress', 'paused', 'blocked']);
  });

  test('loads and saves allowed statuses from storage', () => {
    const storage = createStorage();

    saveChildTaskAllowedStatuses(['not_done', 'in_progress'], storage);
    assert.strictEqual(storage.data[STORAGE_KEY], JSON.stringify(['not_done', 'in_progress']));

    const loaded = loadChildTaskAllowedStatuses(STATUS, storage);
    assert.deepEqual(loaded, ['not_done', 'in_progress']);
  });

  test('allows empty allowlist in storage', () => {
    const storage = createStorage({ [STORAGE_KEY]: JSON.stringify([]) });

    const loaded = loadChildTaskAllowedStatuses(STATUS, storage);
    assert.deepEqual(loaded, []);
  });

  test('filters unknown status keys when loading', () => {
    const storage = createStorage({ [STORAGE_KEY]: JSON.stringify(['not_done', 'removed_status']) });

    const loaded = loadChildTaskAllowedStatuses(STATUS, storage);
    assert.deepEqual(loaded, ['not_done']);
  });

  test('falls back to defaults on corrupt storage', () => {
    const storage = createStorage({ [STORAGE_KEY]: '{not json' });

    const loaded = loadChildTaskAllowedStatuses(STATUS, storage);
    assert.deepEqual(loaded, getDefaultChildTaskAllowedStatuses(STATUS));
  });
});

describe('isChildTaskStatusAllowed', () => {
  test('honors the allowlist', () => {
    assert.strictEqual(isChildTaskStatusAllowed('blocked', ['not_done', 'in_progress']), false);
    assert.strictEqual(isChildTaskStatusAllowed('not_done', ['not_done', 'in_progress']), true);
  });

  test('treats a missing allowlist as no filter', () => {
    assert.strictEqual(isChildTaskStatusAllowed('blocked', undefined), true);
    assert.strictEqual(isChildTaskStatusAllowed('done', null), true);
  });

  test('excludes every status when the allowlist is empty', () => {
    assert.strictEqual(isChildTaskStatusAllowed('not_done', []), false);
  });
});
