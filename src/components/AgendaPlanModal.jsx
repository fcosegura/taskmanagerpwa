import { useMemo, useState } from 'react';
import { uid } from '../utils.jsx';
import { normalizePlannedSlots } from '../plannedSlots.js';

function slotToForm(slot) {
  return {
    date: slot?.date || '',
    startTime: slot?.startTime || '09:00',
    endTime: slot?.endTime || '10:00',
  };
}

export default function AgendaPlanModal({
  tasks,
  onClose,
  onSaveSlots,
  editingTask,
  editingSlot,
  initialDateStr = '',
}) {
  const [taskId, setTaskId] = useState(editingTask?.id || '');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(() => ({
    ...slotToForm(editingSlot),
    date: editingSlot?.date || initialDateStr || '',
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(tasks) ? tasks : [];
    return list
      .filter((t) => t && typeof t.name === 'string')
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 80);
  }, [tasks, query]);

  const isEdit = Boolean(editingTask && editingSlot);

  const handleSubmit = (e) => {
    e.preventDefault();
    const tid = isEdit ? editingTask.id : taskId;
    if (!tid || !form.date) return;
    const nextSlot = {
      id: isEdit ? editingSlot.id : uid(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
    };

    if (isEdit) {
      const merged = (editingTask.plannedSlots || []).map((s) => (s.id === editingSlot.id ? nextSlot : s));
      onSaveSlots(editingTask.id, normalizePlannedSlots(merged));
    } else {
      const task = tasks.find((t) => t.id === tid);
      if (!task) return;
      const merged = [...(task.plannedSlots || []), nextSlot];
      onSaveSlots(tid, normalizePlannedSlots(merged));
    }
    onClose();
  };

  const handleRemove = () => {
    if (!isEdit) return;
    const merged = (editingTask.plannedSlots || []).filter((s) => s.id !== editingSlot.id);
    onSaveSlots(editingTask.id, normalizePlannedSlots(merged));
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-labelledby="agenda-plan-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="agenda-plan-modal"
        style={{
          width: 'min(420px, calc(100% - 32px))',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--color-background-primary)',
          borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--shadow-card)',
          padding: 20,
          color: 'var(--color-text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 id="agenda-plan-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {isEdit ? 'Editar bloque en agenda' : 'Añadir tarea a la agenda'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ghost-button" style={{ fontSize: 20, lineHeight: 1 }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          {!isEdit && (
            <>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Buscar tarea</span>
                <input
                  type="search"
                  className="text-input"
                  value={query}
                  onChange={(ev) => setQuery(ev.target.value)}
                  placeholder="Nombre..."
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Tarea</span>
                <select className="text-input" value={taskId} onChange={(ev) => setTaskId(ev.target.value)} required>
                  <option value="">— Elegir —</option>
                  {filtered.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {isEdit && (
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              <strong style={{ color: 'var(--color-text-primary)' }}>{editingTask.name}</strong>
            </div>
          )}

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Día</span>
            <input
              type="date"
              className="text-input"
              value={form.date}
              onChange={(ev) => setForm((f) => ({ ...f, date: ev.target.value }))}
              required
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Inicio</span>
              <input
                type="time"
                step={1800}
                className="text-input"
                value={form.startTime}
                onChange={(ev) => setForm((f) => ({ ...f, startTime: ev.target.value }))}
                required
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Fin</span>
              <input
                type="time"
                step={1800}
                className="text-input"
                value={form.endTime}
                onChange={(ev) => setForm((f) => ({ ...f, endTime: ev.target.value }))}
                required
              />
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            {isEdit && (
              <button type="button" className="ghost-button" onClick={handleRemove} style={{ marginRight: 'auto', color: 'var(--color-text-danger)' }}>
                Quitar de agenda
              </button>
            )}
            <button type="button" className="ghost-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
