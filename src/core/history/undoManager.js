/**
 * src/core/history/undoManager.js
 * Decoupled transactional Undo Manager for Task Manager PWA.
 * Manages operation rollbacks without leaking UX logic into storage.js or bloating App.jsx.
 */

let activeTransaction = null;
let expireTimer = null;
const listeners = new Set();

const AUTO_EXPIRE_MS = 6000;

/**
 * Subscribes a listener function to undo state changes.
 * @param {Function} listener
 * @returns {Function} Unsubscribe function
 */
export function subscribeToUndo(listener) {
  listeners.add(listener);
  // Send immediate state on subscription
  listener(activeTransaction);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(activeTransaction);
    } catch (err) {
      console.error('Error in undo listener:', err);
    }
  });
}

/**
 * Registers an undoable transaction with a rollback operation.
 * @param {Object} tx
 * @param {string} [tx.id]
 * @param {string} tx.description - Human readable label (e.g., "Tarea eliminada")
 * @param {Function} tx.rollbackFn - Function to execute when undo is triggered
 * @param {number} [tx.timeoutMs] - Custom timeout in ms (default 6000ms)
 */
export function pushUndoTransaction({ id = String(Date.now()), description, rollbackFn, timeoutMs = AUTO_EXPIRE_MS }) {
  if (expireTimer) {
    clearTimeout(expireTimer);
    expireTimer = null;
  }

  if (typeof rollbackFn !== 'function') {
    console.warn('pushUndoTransaction requires a rollbackFn function');
    return;
  }

  activeTransaction = {
    id,
    description: description || 'Acción realizada',
    rollbackFn,
    createdAt: Date.now(),
    expiresAt: Date.now() + timeoutMs,
    timeoutMs,
  };

  notifyListeners();

  expireTimer = setTimeout(() => {
    activeTransaction = null;
    expireTimer = null;
    notifyListeners();
  }, timeoutMs);
}

/**
 * Gets the current active transaction, or null if none.
 */
export function getActiveUndoTransaction() {
  return activeTransaction;
}

/**
 * Triggers undo for the active transaction if available.
 * Executes the rollback function atonomously and clears state.
 */
export function performUndo() {
  if (!activeTransaction || typeof activeTransaction.rollbackFn !== 'function') {
    return false;
  }

  const tx = activeTransaction;
  if (expireTimer) {
    clearTimeout(expireTimer);
    expireTimer = null;
  }
  activeTransaction = null;
  notifyListeners();

  try {
    tx.rollbackFn();
    return true;
  } catch (err) {
    console.error('Failed to execute undo rollback:', err);
    return false;
  }
}

/**
 * Clears the active transaction manually without executing rollback.
 */
export function clearUndoTransaction() {
  if (expireTimer) {
    clearTimeout(expireTimer);
    expireTimer = null;
  }
  if (activeTransaction) {
    activeTransaction = null;
    notifyListeners();
  }
}
