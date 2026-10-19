import { STATUS } from '../constants.js';

export default function StatusChangeCommentModal({
  taskName,
  fromStatus,
  toStatus,
  onConfirm,
  onClose,
  statuses = STATUS,
}) {
  const statusLabel = (value) => {
    return statuses.find((item) => item.v === value)?.label || value || '—';
  };
  const handleSubmit = (event) => {
    event.preventDefault();
    const comment = event.currentTarget.elements.comment?.value?.trim();
    if (!comment) return;
    onConfirm(comment);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="liquid-glass-modal"
        role="dialog"
        aria-labelledby="status-comment-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          maxWidth: 'calc(100% - 32px)',
          borderRadius: 'var(--border-radius-lg)',
          padding: 18,
          color: 'var(--color-text-primary)',
        }}
      >
        <div id="status-comment-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
          Comentario de cambio de estado
        </div>
        {taskName && (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
            {taskName}
          </div>
        )}
        <div style={{ marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{statusLabel(fromStatus)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-secondary)' }}>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
          <strong style={{ color: 'var(--color-text-primary)' }}>{statusLabel(toStatus)}</strong>
        </div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="status-comment-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Comentario (obligatorio)
          </label>
          <textarea
            id="status-comment-input"
            name="comment"
            required
            minLength={1}
            rows={4}
            autoFocus
            placeholder="¿Qué cambió y por qué?"
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              resize: 'vertical',
              borderRadius: 10,
              border: '1px solid var(--color-border-tertiary)',
              padding: '10px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--color-border-tertiary)',
                background: 'var(--color-background-secondary)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--color-background-info)',
                color: 'var(--color-text-info)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
