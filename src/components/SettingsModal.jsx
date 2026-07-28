import { useState } from 'react';
import { PRIORITY } from '../constants.js';

export default function SettingsModal({ focusPriorityLevels, onSaveFocusPriorities, onClose }) {
  const [showFocusPriority, setShowFocusPriority] = useState(false);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="liquid-glass-modal"
        role="dialog"
        aria-labelledby="settings-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(380px, 100%)',
          maxWidth: 'calc(100% - 32px)',
          borderRadius: 'var(--border-radius-lg)',
          padding: 18,
          color: 'var(--color-text-primary)',
        }}
      >
        {!showFocusPriority && (
          <>
            <div id="settings-modal-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>
              Configuración
            </div>
            <button
              type="button"
              onClick={() => setShowFocusPriority(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--color-border-tertiary)',
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>Prioridades en modo focus</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                {focusPriorityLevels.length} seleccionadas
              </span>
            </button>
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
              Cerrar
            </button>
          </>
        )}

        {showFocusPriority && (
          <div
            className="nested-focus-priority-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowFocusPriority(false);
              }
            }}
          >
            <div className="nested-modal-content">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                Prioridades en modo focus
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
                Selecciona qué niveles de prioridad mostrar al activar el modo focus.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PRIORITY.map((item) => {
                  const active = focusPriorityLevels.includes(item.v);
                  return (
                    <button
                      key={item.v}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? focusPriorityLevels.filter((v) => v !== item.v)
                          : [...focusPriorityLevels, item.v];
                        onSaveFocusPriorities(next);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: active ? `2px solid var(${item.bov})` : '1px solid var(--color-border-tertiary)',
                        background: active ? `var(${item.bv})` : 'var(--color-background-secondary)',
                        color: active ? `var(${item.tv})` : 'var(--color-text-secondary)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        opacity: 1,
                      }}
                    >
                      <span>{item.label}</span>
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: active ? '2px solid var(--color-text-primary)' : '2px solid var(--color-border-tertiary)',
                          background: active ? 'var(--color-text-primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          color: active ? 'var(--color-background-primary)' : 'transparent',
                        }}
                      >
                        {active ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowFocusPriority(false)}
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
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}