import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { STATUS } from '../src/constants.js';
import {
  getDefaultNextFocusAllowedStatuses,
  loadNextFocusAllowedStatuses,
  saveNextFocusAllowedStatuses,
  STORAGE_KEY,
} from '../src/nextFocusStatusPrefs.js';
import { recommendNextFocusTask } from '../src/focusRecommendation.js';

describe('Next focus allowed statuses prefs', () => {
  test('defaults to all non-terminal statuses', () => {
    const defaults = getDefaultNextFocusAllowedStatuses(STATUS);
    assert.deepEqual(defaults, ['not_done', 'in_progress', 'paused', 'blocked']);
  });

  test('loads and saves allowed statuses from storage', () => {
    const storage = {
      data: {},
      getItem(key) { return this.data[key] ?? null; },
      setItem(key, value) { this.data[key] = value; },
    };

    saveNextFocusAllowedStatuses(['not_done', 'in_progress'], storage);
    assert.strictEqual(storage.data[STORAGE_KEY], JSON.stringify(['not_done', 'in_progress']));

    const loaded = loadNextFocusAllowedStatuses(STATUS, storage);
    assert.deepEqual(loaded, ['not_done', 'in_progress']);
  });

  test('allows empty allowlist in storage', () => {
    const storage = {
      data: { [STORAGE_KEY]: JSON.stringify([]) },
      getItem(key) { return this.data[key] ?? null; },
      setItem(key, value) { this.data[key] = value; },
    };

    const loaded = loadNextFocusAllowedStatuses(STATUS, storage);
    assert.deepEqual(loaded, []);
  });

  test('filters unknown status keys when loading', () => {
    const storage = {
      data: { [STORAGE_KEY]: JSON.stringify(['not_done', 'removed_status']) },
      getItem(key) { return this.data[key] ?? null; },
      setItem(key, value) { this.data[key] = value; },
    };

    const loaded = loadNextFocusAllowedStatuses(STATUS, storage);
    assert.deepEqual(loaded, ['not_done']);
  });
});

describe('Focus recommendation allowedStatuses filter', () => {
  const todayStr = '2026-08-03';
  const fakeNow = new Date('2026-08-03T12:00:00Z');

  test('excludes tasks whose status is not in allowedStatuses', () => {
    const tasks = [
      { id: 't-blocked', name: 'Bloqueada', date: todayStr, status: 'blocked', priority: 'critical' },
      { id: 't-open', name: 'Abierta', date: todayStr, status: 'not_done', priority: 'medium' },
    ];

    const res = recommendNextFocusTask({
      tasks,
      today: todayStr,
      now: fakeNow,
      allowedStatuses: ['not_done', 'in_progress'],
    });

    assert.strictEqual(res.task.id, 't-open');
  });

  test('returns no recommendation when allowedStatuses is empty', () => {
    const tasks = [
      { id: 't-open', name: 'Abierta', date: todayStr, status: 'not_done', priority: 'medium' },
    ];

    const res = recommendNextFocusTask({
      tasks,
      today: todayStr,
      now: fakeNow,
      allowedStatuses: [],
    });

    assert.strictEqual(res.task, null);
    assert.strictEqual(res.reasonCode, 'none');
  });
});
