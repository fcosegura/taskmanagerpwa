import { useState } from 'react';
import { STATUS } from '../constants.js';
import { uid, fmtDate, parseDateTimeFromDescription, parseDescriptionDateResult, cleanDescriptionSegment } from '../utils.jsx';
import { parseTaskWithAI } from '../storage.js';

export default function TaskModal({ task, categories, allTasks = [], onSave, onDelete, onClose }) {
  const parentTasks = allTasks.filter((candidate) => (candidate.dependencyTaskIds || []).includes(task.id));
  const isChildTask = parentTasks.length > 0;
  const availableDependencyTasks = allTasks.filter((candidate) => (
    candidate.id !== task.id &&
    candidate.status !== 'done' &&
    !parentTasks.some((parentTask) => parentTask.id === candidate.id)
  ));
  const [form, setForm] = useState({
    ...task,
    name: task.name || '',
    url: task.url || '',
    notes: task.notes || '',
    subtasks: task.subtasks || [],
    dependencyTaskIds: task.dependencyTaskIds || [],
    category: task.category || '',
    time: task.time || '',
    hideInKanbanDone: Boolean(task.hideInKanbanDone)
  });
  const [showAdvanced, setShowAdvanced] = useState(Boolean(task.id));
  const [dragSubtaskIndex, setDragSubtaskIndex] = useState(null);
  const [hoverSubtaskIndex, setHoverSubtaskIndex] = useState(null);
  const [subtaskText, setSubtaskText] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');

  const handleNameChange = (value) => {
    setForm((prev) => ({ ...prev, name: value }));
  };

  const fillDateTime = () => {
    const preview = parseDateTimeFromDescription(form.name || '');
    if (!preview) return;
    const result = parseDescriptionDateResult(form.name || '');
    let cleaned = cleanDescriptionSegment(form.name, result?.text || '');
    if (!result?.text || cleaned === form.name.trim()) {
      cleaned = cleaned.replace(/(?:\b(?:a|al|a la|a las|el|la|en|para)\b.*)$/i, '').replace(/\s{2,}/g, ' ').trim();
    }
    setForm((prev) => ({ ...prev, name: cleaned || form.name.trim(), date: preview.date, time: preview.time || prev.time }));
  };

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const toggleDependency = (dependencyId) => {
    setForm((prev) => {
      const current = Array.isArray(prev.dependencyTaskIds) ? prev.dependencyTaskIds : [];
      const exists = current.includes(dependencyId);
      return {
        ...prev,
        dependencyTaskIds: exists
          ? current.filter((id) => id !== dependencyId)
          : [...current, dependencyId]
      };
    });
  };

  const handleAISuggest = async () => {
    const text = (form.name || '').trim();
    if (!text || aiLoading) return;
    setAiLoading(true);
    setAiFeedback('');
    try {
      const { task: parsed, source } = await parseTaskWithAI(text);
      if (!parsed) throw new Error('No hubo sugerencias válidas.');
      const due = typeof parsed.dueDate === 'string' ? new Date(parsed.dueDate) : null;
      const hasValidDue = due instanceof Date && !Number.isNaN(due.getTime());
      const localParsed = parseDateTimeFromDescription(text);
      const localResult = parseDescriptionDateResult(text);
      let localCleaned = cleanDescriptionSegment(text, localResult?.text || '');
      if (!localResult?.text || localCleaned === text.trim()) {
        localCleaned = localCleaned.replace(/(?:\b(?:a|al|a la|a las|el|la|en|para)\b.*)$/i, '').replace(/\s{2,}/g, ' ').trim();
      }
      const aiTitle = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : '';
      const finalName = aiTitle || localCleaned || text;
      const suggestedCategory = Array.isArray(parsed.tags) && parsed.tags.length > 0 ? String(parsed.tags[0]) : '';
      setForm((prev) => ({
        ...prev,
        name: finalName,
        date: hasValidDue
          ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
          : (localParsed?.date || prev.date),
        time: hasValidDue
          ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`
          : (localParsed?.time || prev.time),
        priority: ['low', 'medium', 'high', 'critical'].includes(parsed.priority) ? parsed.priority : prev.priority,
        category: prev.category || suggestedCategory,
      }));
      if (!newCategory && suggestedCategory) setNewCategory(suggestedCategory);
      setAiFeedback(source === 'ai' ? 'Sugerencia IA aplicada.' : 'Sugerencia local aplicada.');
    } catch (error) {
      setAiFeedback(error.message || 'No se pudo generar sugerencia.');
    } finally {
      setAiLoading(false);
    }
  };

  const addSubtask = () => {
    const text = subtaskText?.trim();
    if (!text) return;
    setForm((prev) => ({ ...prev, subtasks: [...(prev.subtasks || []), { id: uid(), text, done: false }] }));
    setSubtaskText('');
  };

  const toggleSubtask = (id) => {
    setForm((prev) => ({ ...prev, subtasks: prev.subtasks.map((st) => st.id === id ? { ...st, done: !st.done } : st) }));
  };

  const removeSubtask = (id) => {
    setForm((prev) => ({ ...prev, subtasks: prev.subtasks.filter((st) => st.id !== id) }));
  };
  const reorderSubtasks = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    setForm((prev) => {
      const subtasks = [...(prev.subtasks || [])];
      if (fromIndex < 0 || fromIndex >= subtasks.length || toIndex < 0 || toIndex >= subtasks.length) return prev;
      const [moved] = subtasks.splice(fromIndex, 1);
      subtasks.splice(toIndex, 0, moved);
      return { ...prev, subtasks };
    });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.name.trim()) return;
    const category = newCategory.trim() || form.category || '';
    const parsed = parseDateTimeFromDescription(form.name);
    const finalForm = { ...form, category, date: form.date || parsed?.date || '', time: form.time || parsed?.time || '' };
    onSave(finalForm);
  };

  const preview = parseDateTimeFromDescription(form.name || '');
  const previewLabel = preview ? `Se creará para: ${fmtDate(preview.date)}${preview.time ? ` · ${preview.time}` : ''}` : null;

  return (
    <form className="liquid-glass-modal" onSubmit={onSubmit} style={{ width: 'min(420px, 100%)', maxWidth: 'calc(100% - 32px)', borderRadius: 'var(--border-radius-lg)', padding: 24, color: 'var(--color-text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{task.id ? 'Editar tarea' : 'Nueva tarea'}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {task.id ? 'Actualiza los detalles de la tarea.' : 'Crea una tarea nueva rápidamente.'}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar modal" style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>

      <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Nombre
        <input value={form.name} onChange={(e) => handleNameChange(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: 10, fontSize: 13 }} />
      </label>
      <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        URL
        <input type="url" value={form.url || ''} onChange={(e) => handleChange('url', e.target.value)} placeholder="https://..." style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: 10, fontSize: 13 }} />
      </label>
      <label style={{ display: 'block', marginBottom: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Notas
        <textarea value={form.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: 10, fontSize: 13, resize: 'vertical' }} />
      </label>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleAISuggest}
          disabled={!form.name?.trim() || aiLoading}
          style={{
            border: 'none',
            background: form.name?.trim() && !aiLoading ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
            color: form.name?.trim() && !aiLoading ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
            borderRadius: '999px',
            padding: '7px 12px',
            cursor: form.name?.trim() && !aiLoading ? 'pointer' : 'not-allowed',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          {aiLoading ? 'Sugiriendo...' : 'Sugerir con IA'}
        </button>
        {aiFeedback && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{aiFeedback}</span>}
      </div>

      {previewLabel && (
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'var(--color-text-secondary)', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 'var(--border-radius-md)', padding: '10px 12px' }}>
          <span>{previewLabel}</span>
          <button type="button" onClick={fillDateTime} style={{ border: 'none', background: 'rgba(37,99,235,0.12)', color: 'var(--color-accent)', borderRadius: '999px', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Autofill</button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAdvanced((prev) => !prev)}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--color-accent)',
          fontSize: 12,
          fontWeight: 700,
          padding: 0,
          marginBottom: 14,
          cursor: 'pointer'
        }}
      >
        {showAdvanced ? 'Ocultar opciones avanzadas' : 'Mostrar opciones avanzadas'}
      </button>

      {showAdvanced && (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Categoría</span>
          <select value={form.category} onChange={(e) => { handleChange('category', e.target.value); setNewCategory(''); }} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }}>
            <option value="">Selecciona categoría</option>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Nueva categoría</span>
          <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nombre de categoría" style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)' }} />
        </label>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
        Elige una categoría existente o escribe una nueva; la nueva categoría reemplazará la selección.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 14, alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Subtarea</span>
          <input value={subtaskText} onChange={(e) => setSubtaskText(e.target.value)} placeholder="Añadir nueva subtarea" style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)' }} />
        </label>
        <button type="button" onClick={addSubtask} disabled={!subtaskText.trim()} style={{ height: 44, minWidth: 100, borderRadius: 'var(--border-radius-md)', border: 'none', background: subtaskText.trim() ? 'var(--color-background-info)' : 'var(--color-background-secondary)', color: subtaskText.trim() ? 'var(--color-text-info)' : 'var(--color-text-secondary)', fontWeight: 700, cursor: subtaskText.trim() ? 'pointer' : 'not-allowed' }}>Añadir</button>
      </div>

      {form.subtasks?.length > 0 && (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, maxHeight: 180, overflowY: 'auto' }}
          onDragOver={(e) => {
            e.preventDefault();
            if (hoverSubtaskIndex === null || hoverSubtaskIndex > form.subtasks.length) {
              setHoverSubtaskIndex(form.subtasks.length);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragSubtaskIndex === null) return;
            reorderSubtasks(dragSubtaskIndex, form.subtasks.length);
            setDragSubtaskIndex(null);
            setHoverSubtaskIndex(null);
          }}
          onDragLeave={() => setHoverSubtaskIndex(null)}
        >
          {form.subtasks.map((st, index) => (
            <div key={st.id}>
              {hoverSubtaskIndex === index && (
                <div className="subtask-drop-indicator" style={{ marginBottom: 6 }} />
              )}
              <div
                draggable
                onDragStart={() => setDragSubtaskIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (hoverSubtaskIndex !== index) setHoverSubtaskIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSubtaskIndex === null || dragSubtaskIndex === index) return;
                  reorderSubtasks(dragSubtaskIndex, index);
                  setDragSubtaskIndex(null);
                  setHoverSubtaskIndex(null);
                }}
                onDragEnd={() => {
                  setDragSubtaskIndex(null);
                  setHoverSubtaskIndex(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--border-radius-md)',
                  background: dragSubtaskIndex === index ? 'rgba(23, 107, 135, 0.08)' : 'var(--color-background-secondary)',
                  border: '0.5px solid var(--color-border-tertiary)'
                }}
              >
                <span title="Arrastra para reordenar" style={{ color: 'var(--color-text-secondary)', cursor: 'grab', fontSize: 13 }}>⋮⋮</span>
                <button type="button" onClick={() => toggleSubtask(st.id)} aria-label={st.done ? 'Marcar subtarea como pendiente' : 'Marcar subtarea como completa'} style={{ width: 26, height: 26, borderRadius: 999, border: '1px solid var(--color-border-tertiary)', background: st.done ? 'var(--color-background-success)' : 'var(--color-background-primary)', color: st.done ? 'var(--color-text-success)' : 'var(--color-text-secondary)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                  {st.done ? '✓' : '○'}
                </button>
                <div style={{ flex: 1, fontSize: 13, color: st.done ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', textDecoration: st.done ? 'line-through' : 'none' }}>{st.text}</div>
                <button type="button" onClick={() => removeSubtask(st.id)} aria-label="Eliminar subtarea" style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            </div>
          ))}
          {hoverSubtaskIndex === form.subtasks.length && (
            <div className="subtask-drop-indicator" />
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Fecha inicio</span>
          <input type="date" value={form.date} onChange={(e) => handleChange('date', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Fecha fin</span>
          <input type="date" value={form.endDate || ''} min={form.date} onChange={(e) => handleChange('endDate', e.target.value)} style={{ width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>Hora</span>
          <input type="time" value={form.time} onChange={(e) => handleChange('time', e.target.value)} style={{ width: '90px', height: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }} />
        </label>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <span style={{ fontWeight: 500 }}>Estado</span>
        <select value={form.status} onChange={(e) => handleChange('status', e.target.value)} style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', padding: '10px 12px', fontSize: 13, background: 'var(--color-background-primary)', appearance: 'none' }}>
          {STATUS.map((option) => <option key={option.v} value={option.v}>{option.label}</option>)}
        </select>
      </label>
      {form.status === 'done' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 12, color: 'var(--color-text-secondary)', userSelect: 'none', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(form.hideInKanbanDone)}
            onChange={(e) => handleChange('hideInKanbanDone', e.target.checked)}
            style={{ width: 16, height: 16, margin: 0 }}
          />
          Hide en columna Completado de Kanban
        </label>
      )}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          Dependencias (esta tarea depende de)
        </div>
        {isChildTask ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            Esta tarea es hija de: {parentTasks.map((parentTask) => parentTask.name).join(', ')}.
            Solo la tarea padre puede elegir sus hijas.
          </div>
        ) : availableDependencyTasks.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            No hay tareas abiertas disponibles para depender.
          </div>
        ) : (
          <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)' }}>
            {availableDependencyTasks.map((candidate) => {
              const checked = (form.dependencyTaskIds || []).includes(candidate.id);
              return (
                <label key={candidate.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDependency(candidate.id)}
                    style={{ width: 14, height: 14, margin: 0 }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {onDelete ? (
          <button type="button" onClick={onDelete} style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', padding: '11px 0', cursor: 'pointer' }}>Eliminar</button>
        ) : (
          <button type="button" onClick={onClose} style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', padding: '11px 0', cursor: 'pointer' }}>Cancelar</button>
        )}
        <button type="submit" style={{ flex: 1, borderRadius: 'var(--border-radius-md)', border: 'none', background: 'var(--color-background-info)', color: 'var(--color-text-info)', fontWeight: 700, padding: '11px 0', cursor: 'pointer' }}>Guardar</button>
      </div>
    </form>
  );
}
