import test from 'node:test';
import assert from 'node:assert/strict';
import {
  organizeKanbanColumnOrder,
  orderVisibleColumnsByFullOrder,
  insertStatusUsingFullOrder,
  applyVisibleOrderToFullOrder,
  kanbanColumnOrderStorageKey,
} from '../src/kanbanColumnOrganize.js';
import { STATUS } from '../src/constants.js';

const customActive = { v: 'review', label: 'Review', kind: 'active' };
const customBacklog = { v: 'ideas', label: 'Ideas', kind: 'backlog' };
const customWaiting = { v: 'waiting_client', label: 'Espera cliente', kind: 'waiting' };

test('kanbanColumnOrderStorageKey appends _order', () => {
  assert.equal(
    kanbanColumnOrderStorageKey('taskmanager_kanban_visible_columns_work'),
    'taskmanager_kanban_visible_columns_work_order',
  );
});

test('anchors: not_done leftmost, done rightmost, in_progress after not_done', () => {
  const order = organizeKanbanColumnOrder(STATUS, {
    done: 9,
    blocked: 4,
    paused: 3,
    in_progress: 1,
    not_done: 2,
  });
  assert.equal(order[0], 'not_done');
  assert.equal(order[1], 'in_progress');
  assert.equal(order[order.length - 1], 'done');
  assert.ok(order.indexOf('blocked') < order.indexOf('paused'));
});

test('blocked is left of paused even when paused has more items', () => {
  const order = organizeKanbanColumnOrder(STATUS, {
    paused: 20,
    blocked: 1,
    not_done: 1,
    in_progress: 1,
    done: 1,
  });
  assert.ok(order.indexOf('blocked') < order.indexOf('paused'));
});

test('custom active with items ranks above other custom with items', () => {
  const statuses = [...STATUS, customBacklog, customActive, customWaiting];
  const order = organizeKanbanColumnOrder(statuses, {
    not_done: 1,
    in_progress: 1,
    ideas: 10,
    review: 2,
    waiting_client: 8,
    done: 1,
  });
  assert.ok(order.indexOf('review') < order.indexOf('ideas'));
  assert.ok(order.indexOf('review') < order.indexOf('waiting_client'));
  assert.ok(order.indexOf('ideas') < order.indexOf('blocked'));
});

test('custom with items ranked by count within the same tier', () => {
  const statuses = [...STATUS, customActive, { v: 'qa', label: 'QA', kind: 'active' }];
  const order = organizeKanbanColumnOrder(statuses, {
    not_done: 1,
    in_progress: 1,
    review: 2,
    qa: 9,
    done: 0,
  });
  assert.ok(order.indexOf('qa') < order.indexOf('review'));
});

test('fixed with items outrank custom with items (except pause/blocked)', () => {
  const statuses = [...STATUS, customActive];
  const order = organizeKanbanColumnOrder(statuses, {
    not_done: 1,
    in_progress: 1,
    review: 50,
    blocked: 40,
    paused: 40,
    done: 1,
  });
  assert.ok(order.indexOf('in_progress') < order.indexOf('review'));
  assert.ok(order.indexOf('review') < order.indexOf('blocked'));
  assert.ok(order.indexOf('blocked') < order.indexOf('paused'));
});

test('empty custom columns go before blocked when customs have no items in other tiers', () => {
  const statuses = [...STATUS, customBacklog];
  const order = organizeKanbanColumnOrder(statuses, {
    not_done: 1,
    in_progress: 2,
    ideas: 0,
    blocked: 1,
    done: 1,
  });
  assert.ok(order.indexOf('ideas') < order.indexOf('blocked'));
  assert.ok(order.indexOf('in_progress') < order.indexOf('ideas'));
});

test('empty custom sits after custom-with-items and before blocked', () => {
  const statuses = [...STATUS, customActive, customBacklog];
  const order = organizeKanbanColumnOrder(statuses, {
    not_done: 1,
    in_progress: 1,
    review: 3,
    ideas: 0,
    done: 0,
  });
  assert.deepEqual(
    order.filter((v) => ['review', 'ideas', 'blocked', 'paused', 'done'].includes(v)),
    ['review', 'ideas', 'blocked', 'paused', 'done'],
  );
});

test('orderVisibleColumnsByFullOrder keeps only visible ids', () => {
  const ordered = orderVisibleColumnsByFullOrder(
    ['done', 'not_done', 'blocked'],
    ['not_done', 'in_progress', 'blocked', 'paused', 'done'],
  );
  assert.deepEqual(ordered, ['not_done', 'blocked', 'done']);
});

test('insertStatusUsingFullOrder inserts using saved full order', () => {
  const full = ['not_done', 'in_progress', 'review', 'blocked', 'paused', 'done'];
  const next = insertStatusUsingFullOrder(['not_done', 'done'], 'review', full);
  assert.deepEqual(next, ['not_done', 'review', 'done']);
});

test('applyVisibleOrderToFullOrder updates visible slots only', () => {
  const full = ['not_done', 'in_progress', 'review', 'blocked', 'paused', 'done'];
  const next = applyVisibleOrderToFullOrder(full, ['done', 'not_done', 'blocked']);
  assert.deepEqual(next, ['done', 'in_progress', 'review', 'not_done', 'paused', 'blocked']);
});
