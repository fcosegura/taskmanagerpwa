import { PRIORITY } from '../constants.js';

export default function PriorityPickerModal({ task, onSelect, onClose }) {
  if (!task) return null;
  const current = task.priority;
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="liquid-glass-modal"
        role="dialog"
        aria-labelledby="priority-picker-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(280px, 100%)',
          maxWidth: 'calc(100% - 32px)',
          borderRadius: 'var(--border-radius-lg)',
          padding: 18,
          color: 'var(--color-text-primary)',
        }}
      >
        <div id="priority-picker-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
          Prioridad
        </div>
        {task.name && (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.name}>
            {task.name}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PRIORITY.map((item) => {
            const active = item.v === current;
            return (
              <button
                key={item.v}
                type="button"
                onClick={() => onSelect(item.v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: active ? `2px solid var(${item.bov})` : '1px solid var(--color-border-tertiary)',
                  background: `var(${item.bv})`,
                  color: `var(${item.tv})`,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>{item.label}</span>
                {active && <span style={{ fontSize: 11, opacity: 0.85 }}>Actual</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 14,
            width: '100%',
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid var(--color-border-tertiary)',
            background: 'var(--color-background-secondary)',
            color: 'var(--color-text-secondary)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
