import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pushUndoTransaction,
  getActiveUndoTransaction,
  performUndo,
  clearUndoTransaction,
  subscribeToUndo,
} from '../src/core/history/undoManager.js';

test('undoManager: registers transaction and triggers rollbackFn on performUndo', () => {
  clearUndoTransaction();
  let rolledBack = false;

  pushUndoTransaction({
    description: 'Tarea eliminada',
    rollbackFn: () => {
      rolledBack = true;
    },
    timeoutMs: 5000,
  });

  const tx = getActiveUndoTransaction();
  assert.ok(tx);
  assert.equal(tx.description, 'Tarea eliminada');

  const success = performUndo();
  assert.equal(success, true);
  assert.equal(rolledBack, true);
  assert.equal(getActiveUndoTransaction(), null);
});

test('undoManager: notifies subscriber on push and performUndo', () => {
  clearUndoTransaction();
  const states = [];
  const unsubscribe = subscribeToUndo((tx) => {
    states.push(tx ? tx.description : null);
  });

  // Listener called immediately on subscribe with null (current state)
  assert.equal(states[0], null);

  pushUndoTransaction({
    description: 'Nota eliminada',
    rollbackFn: () => {},
  });

  assert.equal(states[1], 'Nota eliminada');

  performUndo();
  assert.equal(states[2], null);

  unsubscribe();
});

test('undoManager: clearUndoTransaction clears state without executing rollbackFn', () => {
  clearUndoTransaction();
  let rolledBack = false;

  pushUndoTransaction({
    description: 'Cambio de estado',
    rollbackFn: () => {
      rolledBack = true;
    },
  });

  clearUndoTransaction();
  assert.equal(getActiveUndoTransaction(), null);
  assert.equal(rolledBack, false);
});
