import { useState, useRef, useEffect } from 'react';
import { STATUS, PRIORITY } from '../constants.js';
import { isJiraCategory, applyJiraAutofillFromUrl, normalizeTicketNumber, applyTicketNumberToTaskName } from '../jiraTicket.js';
import { useModalDialog } from '../hooks/useModalDialog.js';
import { isChildTaskStatusAllowed } from '../childTaskStatusPrefs.js';
import { IconButton } from './ui/index.jsx';

export default function TaskSheetDrawer({
  isOpen,
  task = null,
  categories = [],
  allTasks = [],
  onSave,
  onDelete,
  onClose,
  statuses = STATUS,
  childTaskAllowedStatuses
}) {
  const titleInputRef = useRef(null);
  const dialogRef = useModalDialog({
    isOpen,
    onClose,
    initialFocusRef: titleInputRef
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
    };
  }, []);

  const [form, setForm] = useState(() => ({
    name: task?.name || '',
    category: task?.category || '',
    status: task?.status || 'not_done',
    priority: task?.priority || 'medium',
    date: task?.date || task?.dueDate || '',
    time: task?.time || task?.dueTime || '',
    endDate: task?.endDate || '',
    completedAt: task?.completedAt || '',
    hideInKanbanDone: task?.hideInKanbanDone ?? false,
    notes: task?.notes || '',
    url: task?.url || '',
    ticketNumber: task?.ticketNumber || '',
    subtasks: Array.isArray(task?.subtasks) ? task.subtasks : [],
    dependencyTaskIds: Array.isArray(task?.dependencyTaskIds) ? task.dependencyTaskIds : []
  }));

  const parentTasks = task?.id
    ? allTasks.filter((candidate) => (candidate.dependencyTaskIds || []).includes(task.id))
    : [];

  const selectedChildIds = Array.isArray(form.dependencyTaskIds) ? form.dependencyTaskIds : [];
  const availableChildTasks = allTasks.filter((candidate) => (
    candidate.id !== task?.id &&
    !parentTasks.some((parentTask) => parentTask.id === candidate.id) &&
    (selectedChildIds.includes(candidate.id) || isChildTaskStatusAllowed(candidate.status, childTaskAllowedStatuses)) &&
    (candidate.status !== 'done' || selectedChildIds.includes(candidate.id))
  ));

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => {
      let next = { ...prev, [field]: value };
      if (field === 'url' && value) {
        next = applyJiraAutofillFromUrl(next, value);
      }
      if (field !== 'name') {
        const ticket = normalizeTicketNumber(next.ticketNumber || '');
        if (ticket) {
          const nextName = applyTicketNumberToTaskName(next.name || '', ticket);
          if (nextName !== (next.name || '').trim()) next = { ...next, name: nextName };
        }
      }
      return next;
    });
  };

  const toggleChildTask = (childId) => {
    setForm((prev) => {
      const current = Array.isArray(prev.dependencyTaskIds) ? prev.dependencyTaskIds : [];
      const exists = current.includes(childId);
      return {
        ...prev,
        dependencyTaskIds: exists
          ? current.filter((id) => id !== childId)
          : [...current, childId]
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = task?.id
      ? { ...task, ...form, id: task.id }
      : { ...form };
    onSave({ taskPayload: payload });
    onClose();
  };

  return (
    <div
      className="sheet-drawer-overlay dialog-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-sheet-drawer-heading"
    >
      <div
        ref={dialogRef}
        className="sheet-drawer-card material-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-drawer-header">
          <h2 id="task-sheet-drawer-heading">{task?.id ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
          <IconButton onClick={onClose} label="Cerrar" className="close-btn">
            ✕
          </IconButton>
        </div>

        <form onSubmit={handleSubmit} className="sheet-drawer-body">
          <div className="form-group">
            <label htmlFor="task-name-input">Nombre de la tarea</label>
            <input
              ref={titleInputRef}
              id="task-name-input"
              type="text"
              className="sheet-input-title"
              placeholder="¿Qué hay que hacer?"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="task-status-select">Estado</label>
              <select
                id="task-status-select"
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label || s.l}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="task-priority-select">Prioridad</label>
              <select
                id="task-priority-select"
                value={form.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
              >
                {PRIORITY.map(({ v, label }) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="task-duedate-input">Fecha límite</label>
              <input
                id="task-duedate-input"
                type="date"
                value={form.date}
                onChange={(e) => handleChange('date', e.target.value)}
              />
            </div>

            <div className="form-group flex-1">
              <label htmlFor="task-duetime-input">Hora</label>
              <input
                id="task-duetime-input"
                type="time"
                value={form.time}
                onChange={(e) => handleChange('time', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="task-category-input">Categoría / Proyecto</label>
              <input
                id="task-category-input"
                type="text"
                placeholder="Ej. Trabajo, Personal, Jira..."
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {isJiraCategory(form.category) && (
              <div className="form-group flex-1">
                <label htmlFor="task-ticket-input">Ticket Jira</label>
                <input
                  id="task-ticket-input"
                  type="text"
                  placeholder="PROJ-1234"
                  value={form.ticketNumber}
                  onChange={(e) => handleChange('ticketNumber', e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="task-url-input">URL / Enlace externo</label>
            <input
              id="task-url-input"
              type="url"
              placeholder="https://..."
              value={form.url}
              onChange={(e) => handleChange('url', e.target.value)}
            />
          </div>

          <div className="form-group form-group-spaced">
            <label htmlFor="task-notes-input">Notas & Descripción</label>
            <textarea
              id="task-notes-input"
              rows={3}
              placeholder="Detalles adicionales..."
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          <div className="form-group subtasks-group">
            <label>Tareas hijas ({form.dependencyTaskIds.length})</label>
            {parentTasks.length > 0 ? (
              <div className="empty-state-card" style={{ padding: '16px', gap: '8px', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
                <div className="empty-icon" style={{ fontSize: '24px' }}>🔗</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  Esta tarea es hija de: {parentTasks.map((parentTask) => parentTask.name).join(', ')}.
                  Solo la tarea padre puede elegir sus hijas.
                </div>
              </div>
            ) : availableChildTasks.length === 0 ? (
              <div className="empty-state-card" style={{ padding: '16px', gap: '8px', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
                <div className="empty-icon" style={{ fontSize: '24px' }}>🗂️</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  No hay tareas abiertas disponibles para vincular.
                </div>
              </div>
            ) : (
              <div className="subtasks-list">
                {availableChildTasks.map((candidate) => {
                  const checked = form.dependencyTaskIds.includes(candidate.id);
                  return (
                    <label key={candidate.id} className="subtask-item dependency-task-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChildTask(candidate.id)}
                      />
                      <span>{candidate.name || '(sin nombre)'}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="subtask-hint">Elige tareas ya creadas para vincularlas como hijas.</p>
          </div>

          <div className="sheet-drawer-footer">
            {task?.id && onDelete && (
              <button
                type="button"
                className="ghost-button danger"
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    deleteTimeoutRef.current = setTimeout(() => setConfirmDelete(false), 3000);
                  } else {
                    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
                    onDelete(task.id);
                    onClose();
                  }
                }}
                style={{
                  background: confirmDelete ? 'var(--color-error)' : 'transparent',
                  color: confirmDelete ? '#ffffff' : 'var(--color-text-danger)',
                  borderColor: confirmDelete ? 'var(--color-error)' : 'rgba(194, 65, 75, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                {confirmDelete ? '¿Seguro?' : 'Eliminar'}
              </button>
            )}
            <div className="right-actions">
              <button type="button" className="ghost-button" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="primary-button">
                {task?.id ? 'Guardar Cambios' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
