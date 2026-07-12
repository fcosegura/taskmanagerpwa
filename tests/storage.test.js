import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTask, normalizeDataPayload } from '../src/storage.js';

test('isValidTask validates standard task', () => {
  const task = {
    id: '1',
    name: 'Test Task',
    status: 'in_progress',
    priority: 'medium',
    subtasks: [],
    plannedSlots: []
  };
  assert.equal(isValidTask(task), true);
});

test('isValidTask validates task with custom status', () => {
  const task = {
    id: '1',
    name: 'Test Task',
    status: 'custom_qa_status',
    priority: 'medium',
    subtasks: [],
    plannedSlots: []
  };
  assert.equal(isValidTask(task), true);
});

test('isValidTask rejects task with empty status', () => {
  const task = {
    id: '1',
    name: 'Test Task',
    status: '',
    priority: 'medium',
    subtasks: [],
    plannedSlots: []
  };
  assert.equal(isValidTask(task), false);
});

test('normalizeDataPayload preserves custom status tasks', () => {
  const payload = {
    tasks: [
      {
        id: '1',
        name: 'Task 1',
        status: 'custom_status',
        priority: 'high',
        subtasks: [],
        plannedSlots: []
      }
    ],
    boardNotes: [],
    events: []
  };
  const normalized = normalizeDataPayload(payload);
  assert.equal(normalized.tasks.length, 1);
  assert.equal(normalized.tasks[0].status, 'custom_status');
});
