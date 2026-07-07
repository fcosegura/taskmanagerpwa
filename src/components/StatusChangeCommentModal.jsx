import { STATUS } from '../constants.js';

function statusLabel(value) {
  return STATUS.find((item) => item.v === value)?.label || value || '—';
}

export default function StatusChangeCommentModal({
  taskName,
  fromStatus,
  toStatus,
  onConfirm,
  onClose,
}) {
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
        <div style={{ fontSize: 13, marginBottom: 14, color: 'var(--color-text-secondary)' }}>
          {statusLabel(fromStatus)} → <strong style={{ color: 'var(--color-text-primary)' }}>{statusLabel(toStatus)}</strong>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Comentario (obligatorio)
          </label>
          <textarea
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
