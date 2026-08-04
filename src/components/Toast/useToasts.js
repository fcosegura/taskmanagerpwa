import { useCallback, useRef, useState } from 'react';

let toastSeq = 0;

/**
 * useToasts — unified toast queue for the app.
 *
 * Replaces the scattered `setBackupMessage` + `setTimeout` pairs with a single
 * stateful queue supporting success/error/info/warning types, auto-dismiss,
 * an optional action button and manual dismiss.
 */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const { type = 'info', duration = 4200, actionLabel = '' } = options;
    const id = `toast-${++toastSeq}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, actionLabel }]);
    if (duration > 0) {
      timersRef.current.set(id, window.setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration));
    }
    return id;
  }, []);

  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  return { toasts, showToast, dismiss, clearToasts };
}