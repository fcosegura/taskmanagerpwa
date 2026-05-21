export default function DailyStatusResultModal({ report, source, onClose }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report || '');
    } catch {
      // ignore
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="liquid-glass-modal"
        role="dialog"
        aria-labelledby="daily-status-result-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxWidth: 'calc(100% - 32px)',
          maxHeight: 'min(80vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--border-radius-lg)',
          padding: 18,
          color: 'var(--color-text-primary)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div id="daily-status-result-title" style={{ fontSize: 16, fontWeight: 700 }}>
            Daily Status
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {source === 'ai' ? 'IA' : 'Resumen automático'}
          </span>
        </div>
        <pre
          style={{
            flex: 1,
            overflow: 'auto',
            margin: 0,
            padding: 12,
            borderRadius: 10,
            background: 'var(--color-background-secondary)',
            fontSize: 13,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit',
          }}
        >
          {report}
        </pre>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--color-border-tertiary)',
              background: 'var(--color-background-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Copiar
          </button>
          <button
            type="button"
            onClick={onClose}
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
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
