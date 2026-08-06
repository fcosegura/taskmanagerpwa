import { useState } from 'react';
import { PRIORITY } from '../constants.js';

const modalStyle = {
  width: 'min(380px, 100%)',
  maxWidth: 'calc(100% - 32px)',
  borderRadius: 'var(--border-radius-lg)',
  padding: 18,
  color: 'var(--color-text-primary)',
};

const cancelButtonStyle = {
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
};

export default function SettingsModal({
  focusPriorityLevels,
  onSaveFocusPriorities,
  density = 'comfortable',
  onToggleDensity,
  noteAiPrefs,
  onSaveNoteAiPrefs,
  onClose,
}) {
  const [showFocusPriority, setShowFocusPriority] = useState(false);
  const [showNoteAi, setShowNoteAi] = useState(false);

  const noteAiItems = [
    { key: 'autotag', label: 'Etiquetas automáticas' },
    { key: 'summary', label: 'Resumen automático' },
    { key: 'entities', label: 'Extracción de entidades' },
    { key: 'classification', label: 'Clasificación automática' },
    { key: 'related', label: 'Panel de notas relacionadas' },
    { key: 'taskSuggestions', label: 'Sugerencias de tareas' },
    { key: 'semanticSearch', label: 'Búsqueda semántica' },
  ];

  return (
    <>
      <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div
          className="liquid-glass-modal"
          role="dialog"
          aria-labelledby="settings-modal-title"
          onClick={(e) => e.stopPropagation()}
          style={modalStyle}
        >
          <div id="settings-modal-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>
            Configuración
          </div>

          {/* Selector de Densidad Visual (Manifiesto v4.0) */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Densidad de Interfaz</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => onToggleDensity && onToggleDensity('comfortable')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: density === 'comfortable' ? '2px solid var(--color-accent)' : '1px solid var(--color-border-tertiary)',
                  background: density === 'comfortable' ? 'var(--color-accent-subtle, rgba(59, 130, 246, 0.1))' : 'var(--color-background-secondary)',
                  color: density === 'comfortable' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🌿 Cómodo
              </button>
              <button
                type="button"
                onClick={() => onToggleDensity && onToggleDensity('compact')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: density === 'compact' ? '2px solid var(--color-accent)' : '1px solid var(--color-border-tertiary)',
                  background: density === 'compact' ? 'var(--color-accent-subtle, rgba(59, 130, 246, 0.1))' : 'var(--color-background-secondary)',
                  color: density === 'compact' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ⚡ Compacto
              </button>
            </div>
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
              marginBottom: 10,
            }}
          >
            <span>Prioridades en modo focus</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {focusPriorityLevels.length} seleccionadas
            </span>
          </button>

          {onSaveNoteAiPrefs && (
            <button
              type="button"
              onClick={() => setShowNoteAi(true)}
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
              <span>Organización automática de notas</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Ajustar</span>
            </button>
          )}

          <button type="button" onClick={onClose} style={cancelButtonStyle}>
            Cerrar
          </button>
        </div>
      </div>

      {showFocusPriority && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowFocusPriority(false); }}>
          <div
            className="liquid-glass-modal"
            role="dialog"
            aria-labelledby="focus-priority-title"
            onClick={(e) => e.stopPropagation()}
            style={modalStyle}
          >
            <div id="focus-priority-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
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
            <button type="button" onClick={() => setShowFocusPriority(false)} style={cancelButtonStyle}>
              Volver
            </button>
          </div>
        </div>
      )}

      {showNoteAi && onSaveNoteAiPrefs && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowNoteAi(false); }}>
          <div
            className="liquid-glass-modal"
            role="dialog"
            aria-labelledby="note-ai-prefs-title"
            onClick={(e) => e.stopPropagation()}
            style={modalStyle}
          >
            <div id="note-ai-prefs-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              Organización automática de notas
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              Desactiva cualquier sugerencia que no quieras ver. El análisis en segundo plano sigue siendo no bloqueante.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {noteAiItems.map((item) => {
                const active = noteAiPrefs?.[item.key] !== false;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSaveNoteAiPrefs({
                        ...noteAiPrefs,
                        [item.key]: !active,
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: active ? '2px solid var(--color-accent)' : '1px solid var(--color-border-tertiary)',
                      background: active ? 'var(--color-accent-subtle, rgba(59,130,246,0.1))' : 'var(--color-background-secondary)',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: 11 }}>{active ? 'ON' : 'OFF'}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setShowNoteAi(false)} style={cancelButtonStyle}>
              Volver
            </button>
          </div>
        </div>
      )}
    </>
  );
}
