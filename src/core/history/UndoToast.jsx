import { useState, useEffect } from 'react';
import { subscribeToUndo, performUndo, clearUndoTransaction } from './undoManager';

export function UndoToast() {
  const [activeTx, setActiveTx] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToUndo((tx) => {
      setActiveTx(tx);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeTx) return;

    const handleKeyDown = (e) => {
      // Catch Cmd+Z or Ctrl+Z to undo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        // Prevent default browser undo if we have an active transaction
        e.preventDefault();
        performUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTx]);

  if (!activeTx) return null;

  return (
    <div
      className="undo-toast-container"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="undo-toast-card">
        <span className="undo-toast-icon">↩</span>
        <span className="undo-toast-message">{activeTx.description}</span>
        <button
          type="button"
          className="undo-toast-btn"
          onClick={() => performUndo()}
        >
          Deshacer <kbd className="undo-toast-kbd">⌘Z</kbd>
        </button>
        <button
          type="button"
          className="undo-toast-close"
          onClick={() => clearUndoTransaction()}
          aria-label="Cerrar notificación"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default UndoToast;
