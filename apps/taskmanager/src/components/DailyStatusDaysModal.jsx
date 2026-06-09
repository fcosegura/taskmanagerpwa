import { useState } from 'react';
import { clampDailyStatusDays } from '../dailyStatusActivities.js';

const DEFAULT_DAYS = 2;
const MAX_DAYS = 7;

export default function DailyStatusDaysModal({ onConfirm, onClose }) {
  const [days, setDays] = useState(String(DEFAULT_DAYS));

  const handleSubmit = (event) => {
    event.preventDefault();
    onConfirm(clampDailyStatusDays(days));
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="liquid-glass-modal"
        role="dialog"
        aria-labelledby="daily-status-days-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(360px, 100%)',
          maxWidth: 'calc(100% - 32px)',
          borderRadius: 'var(--border-radius-lg)',
          padding: 18,
          color: 'var(--color-text-primary)',
        }}
      >
        <div id="daily-status-days-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          Daily Status
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          ¿Cuántos días de actividad quieres incluir? (máximo {MAX_DAYS})
        </p>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Días
          </label>
          <input
            type="number"
            min={1}
            max={MAX_DAYS}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            style={{
              width: '100%',
              borderRadius: 10,
              border: '1px solid var(--color-border-tertiary)',
              padding: '10px 12px',
              fontSize: 14,
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
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
              Generar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
