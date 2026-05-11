import { useState } from 'react';
import { EVENT_COLORS } from '../constants.js';

function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0;
  const [h, m] = t.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export default function EventModal({ event, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(event);
  const [recurrenceEndType, setRecurrenceEndType] = useState(() => {
    if (event?.recurrenceCount) return 'count';
    if (event?.recurrenceUntil) return 'until';
    return 'never';
  });

  const handleChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const setAllDay = (allDay) => {
    setForm((p) => ({
      ...p,
      allDay,
      endDate: allDay ? p.endDate : p.startDate,
      ...(allDay
        ? { startTime: '', endTime: '' }
        : { startTime: p.startTime || '09:00', endTime: p.endTime || '10:00' }),
    }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startDate) return;

    let finalForm = { ...form, allDay: form.allDay !== false };

    if (finalForm.allDay) {
      finalForm.startTime = '';
      finalForm.endTime = '';
      finalForm.endDate = finalForm.endDate || finalForm.startDate;
    } else {
      finalForm.endDate = finalForm.startDate;
      let st = form.startTime || '09:00';
      let et = form.endTime || '10:00';
      if (timeToMinutes(et) < timeToMinutes(st)) [st, et] = [et, st];
      finalForm.startTime = st;
      finalForm.endTime = et;
    }

    if (finalForm.endDate < finalForm.startDate) finalForm.endDate = finalForm.startDate;
    const recurrenceFrequency = ['none', 'daily', 'weekly', 'monthly'].includes(finalForm.recurrenceFrequency)
      ? finalForm.recurrenceFrequency
      : 'none';
    const parsedInterval = Number.parseInt(String(finalForm.recurrenceInterval ?? '1'), 10);
    const recurrenceInterval = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 1;
    finalForm.recurrenceFrequency = recurrenceFrequency;
    finalForm.recurrenceInterval = recurrenceFrequency === 'none' ? 1 : recurrenceInterval;
    if (recurrenceFrequency === 'none' || recurrenceEndType === 'never') {
      finalForm.recurrenceUntil = '';
      finalForm.recurrenceCount = null;
    } else if (recurrenceEndType === 'until') {
      finalForm.recurrenceUntil = finalForm.recurrenceUntil || '';
      finalForm.recurrenceCount = null;
    } else {
      finalForm.recurrenceUntil = '';
      const parsedCount = Number.parseInt(String(finalForm.recurrenceCount ?? ''), 10);
      finalForm.recurrenceCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;
    }
    onSave(finalForm);
  };

  return (
    <form className="liquid-glass-modal" onSubmit={onSubmit} style={{ width: 'min(420px, 100%)', maxWidth: 'calc(100% - 32px)', borderRadius: 'var(--border-radius-lg)', padding: 24, color: 'var(--color-text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{event.id ? 'Editar evento' : 'Nuevo evento'}</div>
        <button type="button" onClick={onClose} aria-label="Cerrar modal" style={{ border: 'none', background: 'transparent', color: 'var(--color-text-primary)', opacity: 0.55, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>

      <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>
        Título del evento
        <input value={form.title} onChange={(e) => handleChange('title', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: 10, fontSize: 13 }} />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={form.allDay !== false}
          onChange={(e) => setAllDay(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--color-background-info)' }}
        />
        <span style={{ fontWeight: 500 }}>Todo el día</span>
      </label>

      {form.allDay !== false ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
            <span style={{ fontWeight: 600 }}>Fecha inicio</span>
            <input type="date" value={form.startDate} onChange={(e) => handleChange('startDate', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
            <span style={{ fontWeight: 600 }}>Fecha fin</span>
            <input type="date" value={form.endDate || ''} min={form.startDate} onChange={(e) => handleChange('endDate', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
          </label>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
            <span style={{ fontWeight: 600 }}>Fecha</span>
            <input type="date" value={form.startDate} onChange={(e) => handleChange('startDate', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
              <span style={{ fontWeight: 600 }}>Hora inicio</span>
              <input type="time" value={form.startTime || '09:00'} onChange={(e) => handleChange('startTime', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
              <span style={{ fontWeight: 600 }}>Hora fin</span>
              <input type="time" value={form.endTime || '10:00'} onChange={(e) => handleChange('endTime', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)' }} />
            </label>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: 6 }}>Color</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {EVENT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => handleChange('color', c)} style={{ width: 36, height: 36, borderRadius: 999, background: c, border: form.color === c ? '3px solid var(--color-background-primary)' : '3px solid transparent', boxShadow: `0 0 0 1px ${form.color === c ? c : 'var(--color-border-tertiary)'}`, cursor: 'pointer' }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
          <span style={{ fontWeight: 600 }}>Repetir</span>
          <select
            value={form.recurrenceFrequency || 'none'}
            onChange={(e) => {
              const frequency = e.target.value;
              handleChange('recurrenceFrequency', frequency);
              if (frequency === 'none') {
                setRecurrenceEndType('never');
                handleChange('recurrenceUntil', '');
                handleChange('recurrenceCount', null);
                handleChange('recurrenceInterval', 1);
              }
            }}
            style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)' }}
          >
            <option value="none">No repetir</option>
            <option value="daily">Todos los días</option>
            <option value="weekly">Todas las semanas</option>
            <option value="monthly">Todos los meses</option>
          </select>
        </label>

        {(form.recurrenceFrequency || 'none') !== 'none' && (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
              <span style={{ fontWeight: 600 }}>Cada cuánto</span>
              <input
                type="number"
                min="1"
                value={form.recurrenceInterval || 1}
                onChange={(e) => handleChange('recurrenceInterval', e.target.value)}
                style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
              <span style={{ fontWeight: 600 }}>Finaliza</span>
              <select
                value={recurrenceEndType}
                onChange={(e) => setRecurrenceEndType(e.target.value)}
                style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)' }}
              >
                <option value="never">Nunca</option>
                <option value="until">En fecha</option>
                <option value="count">Tras repeticiones</option>
              </select>
            </label>

            {recurrenceEndType === 'until' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
                <span style={{ fontWeight: 600 }}>Repetir hasta</span>
                <input
                  type="date"
                  value={form.recurrenceUntil || ''}
                  min={form.startDate}
                  onChange={(e) => handleChange('recurrenceUntil', e.target.value)}
                  style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)' }}
                />
              </label>
            )}

            {recurrenceEndType === 'count' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-primary)' }}>
                <span style={{ fontWeight: 600 }}>Número de repeticiones</span>
                <input
                  type="number"
                  min="1"
                  value={form.recurrenceCount || 1}
                  onChange={(e) => handleChange('recurrenceCount', e.target.value)}
                  style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)' }}
                />
              </label>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button type="button" onClick={onDelete} disabled={!onDelete} style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: onDelete ? 'var(--color-background-danger)' : 'var(--color-background-secondary)', color: onDelete ? 'var(--color-text-danger)' : 'var(--color-text-secondary)', padding: '11px 0', cursor: onDelete ? 'pointer' : 'not-allowed' }}>Eliminar</button>
        <button type="submit" style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: 'none', background: 'var(--color-background-info)', color: 'var(--color-text-info)', fontWeight: 700, padding: '11px 0', cursor: 'pointer' }}>Guardar</button>
      </div>
    </form>
  );
}
