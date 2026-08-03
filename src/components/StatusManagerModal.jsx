import { useState } from 'react';
import { STATUS_KINDS, normalizeStatuses, normalizeStatusDefinition } from '../constants.js';

const STYLING_THEMES = [
  { value: 'neutral', label: 'Neutro', tv: '--color-text-primary', bv: '--color-background-secondary', bov: '--color-border-secondary' },
  { value: 'info', label: 'Información', tv: '--color-text-info', bv: '--color-background-info', bov: '--color-border-info' },
  { value: 'warning', label: 'Advertencia', tv: '--color-text-warning', bv: '--color-background-warning', bov: '--color-border-warning' },
  { value: 'danger', label: 'Peligro', tv: '--color-text-danger', bv: '--color-background-danger', bov: '--color-border-danger' },
  { value: 'success', label: 'Éxito', tv: '--color-text-success', bv: '--color-background-success', bov: '--color-border-success' },
];

const DEFAULT_KEYS = new Set(['not_done', 'in_progress', 'paused', 'blocked', 'done']);

const THEME_TO_KIND_SUGGESTION = {
  neutral: 'backlog',
  info: 'active',
  warning: 'waiting',
  danger: 'blocked',
  success: 'done',
};

function getThemeName(status) {
  if (status.theme && STYLING_THEMES.some((t) => t.value === status.theme)) {
    return status.theme;
  }
  const theme = STYLING_THEMES.find((t) => t.tv === status.tv);
  return theme ? theme.value : 'neutral';
}

function getThemeProps(themeValue) {
  const theme = STYLING_THEMES.find((t) => t.value === themeValue);
  return theme ? { tv: theme.tv, bv: theme.bv, bov: theme.bov, theme: themeValue } : { ...STYLING_THEMES[0], theme: 'neutral' };
}

export default function StatusManagerModal({ statuses, onSave, onClose }) {
  const [localStatuses, setLocalStatuses] = useState(() => normalizeStatuses(statuses));
  const [newLabel, setNewLabel] = useState('');
  const [newTheme, setNewTheme] = useState('neutral');
  const [newKind, setNewKind] = useState('backlog');
  const [errorMsg, setErrorMsg] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;

    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    let v = `custom_${slug}`;
    if (!slug) {
      setErrorMsg('El nombre del estado debe contener letras o números.');
      return;
    }

    let counter = 1;
    while (localStatuses.some((s) => s.v === v)) {
      v = `custom_${slug}_${counter}`;
      counter++;
    }

    const themeProps = getThemeProps(newTheme);
    const kindMeta = STATUS_KINDS.find((k) => k.value === newKind) || STATUS_KINDS[0];
    const newStatus = normalizeStatusDefinition({
      v,
      label,
      ...themeProps,
      kind: newKind,
      isTerminal: kindMeta.isTerminal,
      canBeFocused: kindMeta.canBeFocused,
      sortWeight: kindMeta.sortWeight,
    });

    setLocalStatuses([...localStatuses, newStatus]);
    setNewLabel('');
    setNewTheme('neutral');
    setNewKind('backlog');
    setErrorMsg('');
  };

  const handleNewThemeChange = (themeValue) => {
    setNewTheme(themeValue);
    const suggestedKind = THEME_TO_KIND_SUGGESTION[themeValue];
    if (suggestedKind) {
      setNewKind(suggestedKind);
    }
  };

  const handleUpdateLabel = (index, val) => {
    const updated = [...localStatuses];
    updated[index] = { ...updated[index], label: val };
    setLocalStatuses(updated);
  };

  const handleUpdateTheme = (index, themeValue) => {
    const updated = [...localStatuses];
    const themeProps = getThemeProps(themeValue);
    updated[index] = {
      ...updated[index],
      ...themeProps
    };
    setLocalStatuses(updated);
  };

  const handleUpdateKind = (index, kindValue) => {
    const statusToUpdate = localStatuses[index];
    if (DEFAULT_KEYS.has(statusToUpdate.v)) return; // Protection: standard status kind cannot be changed

    const updated = [...localStatuses];
    const kindMeta = STATUS_KINDS.find((k) => k.value === kindValue) || STATUS_KINDS[0];
    updated[index] = normalizeStatusDefinition({
      ...updated[index],
      kind: kindValue,
      isTerminal: kindMeta.isTerminal,
      canBeFocused: kindMeta.canBeFocused,
      sortWeight: kindMeta.sortWeight,
    });
    setLocalStatuses(updated);
  };

  const handleDelete = (index) => {
    const statusToDelete = localStatuses[index];
    if (DEFAULT_KEYS.has(statusToDelete.v)) return; // Protection
    const updated = localStatuses.filter((_, i) => i !== index);
    setLocalStatuses(updated);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    // Validate that labels are not empty
    if (localStatuses.some((s) => !s.label.trim())) {
      setErrorMsg('Todos los estados deben tener una etiqueta válida.');
      return;
    }
    onSave(localStatuses);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="liquid-glass-modal"
        role="dialog"
        aria-labelledby="status-manager-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(580px, 100%)',
          maxWidth: 'calc(100% - 32px)',
          borderRadius: 'var(--border-radius-lg)',
          padding: 24,
          color: 'var(--color-text-primary)',
          maxHeight: 'min(90vh, 700px)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <div id="status-manager-title" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          Gestionar Estados
        </div>

        {errorMsg && (
          <div style={{ padding: '8px 12px', background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', borderRadius: 'var(--border-radius-md)', fontSize: 12, marginBottom: 12, border: '0.5px solid var(--color-border-danger)' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {localStatuses.map((status, index) => {
              const isDefault = DEFAULT_KEYS.has(status.v);
              const currentThemeName = getThemeName(status);
              return (
                <div
                  key={status.v}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 8,
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--color-border-tertiary)',
                    background: 'var(--color-background-secondary)',
                    flexWrap: 'wrap'
                  }}
                >
                  {/* Color preview chip */}
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: `var(${status.bv})`,
                      border: `1.5px solid var(${status.bov})`
                    }}
                  />

                  {/* Label Input */}
                  <input
                    type="text"
                    value={status.label}
                    onChange={(e) => handleUpdateLabel(index, e.target.value)}
                    placeholder="Nombre del estado"
                    style={{
                      flex: '1 1 140px',
                      minWidth: 120,
                      height: 36,
                      borderRadius: 6,
                      border: '0.5px solid var(--color-border-secondary)',
                      padding: '0 8px',
                      fontSize: 13,
                      background: 'var(--color-background-primary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />

                  {/* Theme Select */}
                  <select
                    value={currentThemeName}
                    onChange={(e) => handleUpdateTheme(index, e.target.value)}
                    aria-label={`Tema de ${status.label}`}
                    style={{
                      height: 36,
                      borderRadius: 6,
                      border: '0.5px solid var(--color-border-secondary)',
                      padding: '0 8px',
                      fontSize: 13,
                      background: 'var(--color-background-primary)',
                      color: 'var(--color-text-primary)',
                      minWidth: 90
                    }}
                  >
                    {STYLING_THEMES.map((theme) => (
                      <option key={theme.value} value={theme.value}>
                        {theme.label}
                      </option>
                    ))}
                  </select>

                  {/* Kind (Category) Select */}
                  <select
                    value={status.kind || 'backlog'}
                    onChange={(e) => handleUpdateKind(index, e.target.value)}
                    disabled={isDefault}
                    aria-label={`Categoría semántica de ${status.label}`}
                    style={{
                      height: 36,
                      borderRadius: 6,
                      border: '0.5px solid var(--color-border-secondary)',
                      padding: '0 8px',
                      fontSize: 13,
                      background: 'var(--color-background-primary)',
                      color: 'var(--color-text-primary)',
                      minWidth: 100,
                      opacity: isDefault ? 0.7 : 1,
                      cursor: isDefault ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {STATUS_KINDS.map((kindOption) => (
                      <option key={kindOption.value} value={kindOption.value}>
                        {kindOption.label}
                      </option>
                    ))}
                  </select>

                  {/* Delete button or default tag */}
                  {isDefault ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        padding: '4px 6px',
                        background: 'var(--color-border-tertiary)',
                        borderRadius: 4,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      fijo
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      aria-label={`Eliminar estado ${status.label}`}
                      style={{
                        height: 36,
                        width: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6,
                        border: 'none',
                        background: 'var(--color-background-danger)',
                        color: 'var(--color-text-danger)',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add new status section */}
        <form
          onSubmit={handleAdd}
          style={{
            borderTop: '1px solid var(--color-border-tertiary)',
            paddingTop: 12,
            marginBottom: 16,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nuevo estado..."
            required
            style={{
              flex: '1 1 140px',
              minWidth: 120,
              height: 38,
              borderRadius: 'var(--border-radius-md)',
              border: '0.5px solid var(--color-border-secondary)',
              padding: '0 10px',
              fontSize: 13,
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)'
            }}
          />

          <select
            value={newTheme}
            onChange={(e) => handleNewThemeChange(e.target.value)}
            aria-label="Tema visual del nuevo estado"
            style={{
              height: 38,
              borderRadius: 'var(--border-radius-md)',
              border: '0.5px solid var(--color-border-secondary)',
              padding: '0 8px',
              fontSize: 13,
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
              minWidth: 90
            }}
          >
            {STYLING_THEMES.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>

          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value)}
            aria-label="Categoría semántica del nuevo estado"
            style={{
              height: 38,
              borderRadius: 'var(--border-radius-md)',
              border: '0.5px solid var(--color-border-secondary)',
              padding: '0 8px',
              fontSize: 13,
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
              minWidth: 100
            }}
          >
            {STATUS_KINDS.map((kindOption) => (
              <option key={kindOption.value} value={kindOption.value}>
                {kindOption.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="ghost-button"
            style={{
              height: 38,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
              fontSize: 13,
              borderColor: 'var(--color-border-primary)'
            }}
          >
            Añadir
          </button>
        </form>

        {/* Modal Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--color-border-tertiary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleFormSubmit}
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--border-radius-md)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700
            }}
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

