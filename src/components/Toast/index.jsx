const TYPE_ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

export function ToastContainer({ toasts, onDismiss, onAction }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item toast-${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-item-icon" aria-hidden="true">{TYPE_ICONS[toast.type] || 'ℹ'}</span>
          <span className="toast-item-message">{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className="toast-item-action"
              onClick={() => {
                if (typeof onAction === 'function') onAction(toast);
              }}
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            className="toast-item-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;