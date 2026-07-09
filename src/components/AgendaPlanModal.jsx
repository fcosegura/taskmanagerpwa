import { useMemo, useState } from 'react';
import { normalizePlannedSlots } from '../plannedSlots.js';
import { uid } from '../utils.jsx';



const fieldLabelStyle = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' };
const inputStyle = {
  width: '100%',
  height: 44,
  boxSizing: 'border-box',
  borderRadius: 'var(--border-radius-md)',
  border: '0.5px solid var(--color-border-secondary)',
  padding: '10px 12px',
  fontSize: 13,
  background: 'var(--color-background-primary)',
};

function hmToMinutes(t) {
  if (typeof t !== 'string' || !t.includes(':')) return NaN;
  const [h, m] = t.split(':').map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

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
  const [timeRangeError, setTimeRangeError] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(tasks) ? tasks : [];
    return list
      .filter((t) => t && typeof t.name === 'string')
      .filter((t) => (t.status || 'not_done') !== 'done')
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 80);
  }, [tasks, query]);

  const isEdit = Boolean(editingTask && editingSlot);

  const handleSubmit = (e) => {
    e.preventDefault();
    const tid = isEdit ? editingTask.id : taskId;
    if (!tid || !form.date) return;

    const startMin = hmToMinutes(form.startTime);
    const endMin = hmToMinutes(form.endTime);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
      setTimeRangeError('La hora de fin debe ser posterior a la de inicio.');
      return;
    }
    setTimeRangeError('');

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
      aria-describedby="agenda-plan-desc"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="liquid-glass-modal"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          maxWidth: 'calc(100% - 32px)',
          borderRadius: 'var(--border-radius-lg)',
          padding: 24,
          color: 'var(--color-text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div id="agenda-plan-title" style={{ fontSize: 18, fontWeight: 700 }}>
              {isEdit ? 'Editar bloque en agenda' : 'Añadir tarea a la agenda'}
            </div>
            <div id="agenda-plan-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {isEdit
                ? 'El horario aquí no cambia la fecha de vencimiento de la tarea.'
                : 'Elige tarea e intervalo; la planificación es solo para esta vista.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {!isEdit && (
          <>
            <label style={{ ...fieldLabelStyle, marginBottom: 14 }}>
              <span style={{ fontWeight: 600 }}>Buscar tarea</span>
              <input
                type="search"
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                placeholder="Nombre..."
                style={{ ...inputStyle, height: 44 }}
              />
            </label>
            <label style={{ ...fieldLabelStyle, marginBottom: 14 }}>
              <span style={{ fontWeight: 600 }}>Tarea</span>
              <select
                value={taskId}
                onChange={(ev) => setTaskId(ev.target.value)}
                required
                style={{ ...inputStyle, appearance: 'none' }}
              >
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
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{editingTask.name}</span>
          </div>
        )}

        <label style={{ ...fieldLabelStyle, marginBottom: 14 }}>
          <span style={{ fontWeight: 600 }}>Día</span>
          <input
            type="date"
            value={form.date}
            onChange={(ev) => setForm((f) => ({ ...f, date: ev.target.value }))}
            required
            style={{ ...inputStyle, appearance: 'none' }}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: timeRangeError ? 8 : 18 }}>
          <label style={fieldLabelStyle}>
            <span style={{ fontWeight: 600 }}>Inicio</span>
            <input
              type="time"
              step={1800}
              value={form.startTime}
              onChange={(ev) => {
                setTimeRangeError('');
                setForm((f) => ({ ...f, startTime: ev.target.value }));
              }}
              required
              style={inputStyle}
            />
          </label>
          <label style={fieldLabelStyle}>
            <span style={{ fontWeight: 600 }}>Fin</span>
            <input
              type="time"
              step={1800}
              value={form.endTime}
              onChange={(ev) => {
                setTimeRangeError('');
                setForm((f) => ({ ...f, endTime: ev.target.value }));
              }}
              required
              style={inputStyle}
              aria-invalid={timeRangeError ? true : undefined}
              aria-describedby={timeRangeError ? 'agenda-time-error' : undefined}
            />
          </label>
        </div>

        {timeRangeError ? (
          <div id="agenda-time-error" role="alert" style={{ fontSize: 12, color: 'var(--color-text-danger)', marginBottom: 14 }}>
            {timeRangeError}
          </div>
        ) : null}

        {isEdit && (
          <button
            type="button"
            onClick={handleRemove}
            style={{
              width: '100%',
              marginBottom: 12,
              borderRadius: 'var(--border-radius-md)',
              border: '0.5px solid var(--color-border-secondary)',
              background: 'var(--color-background-danger)',
              color: 'var(--color-text-danger)',
              padding: '11px 0',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Quitar de agenda
          </button>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              borderRadius: 'var(--border-radius-md)',
              border: '0.5px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-secondary)',
              padding: '11px 0',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            style={{
              flex: 1,
              borderRadius: 'var(--border-radius-md)',
              border: 'none',
              background: 'var(--color-background-info)',
              color: 'var(--color-text-info)',
              fontWeight: 700,
              padding: '11px 0',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
