import { useState } from 'react';
import { STATUS, PRIORITY } from '../constants.js';
import { isJiraCategory, extractJiraTicketFromUrl, getJiraTaskDefaultsFromUrl } from '../jiraTicket.js';

export default function TaskSheetDrawer({
  isOpen,
  task = null,
  categories = [],
  onSave,
  onDelete,
  onClose,
  statuses = STATUS
}) {
  const [form, setForm] = useState(() => ({
    name: task?.name || '',
    category: task?.category || '',
    status: task?.status || 'not_done',
    priority: task?.priority || 'medium',
    dueDate: task?.dueDate || task?.date || '',
    dueTime: task?.dueTime || task?.time || '',
    notes: task?.notes || '',
    url: task?.url || '',
    ticketNumber: task?.ticketNumber || '',
    subtasks: task?.subtasks || [],
    dependencyTaskIds: task?.dependencyTaskIds || []
  }));

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'url' && value) {
        const ticketFromUrl = extractJiraTicketFromUrl(value);
        if (ticketFromUrl && !next.ticketNumber) {
          next.ticketNumber = ticketFromUrl;
        }
        const jiraDefaults = getJiraTaskDefaultsFromUrl(value);
        if (jiraDefaults && !next.category) {
          next.category = jiraDefaults.category;
        }
      }
      return next;
    });
  };

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    setForm((prev) => ({
      ...prev,
      subtasks: [...prev.subtasks, { id: Date.now(), title: newSubtaskTitle.trim(), completed: false }]
    }));
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subId) => {
    setForm((prev) => ({
      ...prev,
      subtasks: prev.subtasks.map((st) => (st.id === subId ? { ...st, completed: !st.completed } : st))
    }));
  };

  const handleRemoveSubtask = (subId) => {
    setForm((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((st) => st.id !== subId)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <div className="sheet-drawer-overlay dialog-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet-drawer-card material-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-drawer-header">
          <h2>{task?.id ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
          <button type="button" className="icon-button close-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="sheet-drawer-body">
          {/* Main Title Input */}
          <div className="form-group">
            <label htmlFor="task-name-input">Nombre de la tarea</label>
            <input
              id="task-name-input"
              type="text"
              className="sheet-input-title"
              placeholder="¿Qué hay que hacer?"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Status & Priority Row */}
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
                    {s.l}
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
                <option value={PRIORITY.URGENT}>Urgente</option>
                <option value={PRIORITY.HIGH}>Alta</option>
                <option value={PRIORITY.MEDIUM}>Media</option>
                <option value={PRIORITY.LOW}>Baja</option>
              </select>
            </div>
          </div>

          {/* Dates & Times */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="task-duedate-input">Fecha límite</label>
              <input
                id="task-duedate-input"
                type="date"
                value={form.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
              />
            </div>

            <div className="form-group flex-1">
              <label htmlFor="task-duetime-input">Hora</label>
              <input
                id="task-duetime-input"
                type="time"
                value={form.dueTime}
                onChange={(e) => handleChange('dueTime', e.target.value)}
              />
            </div>
          </div>

          {/* Category & Ticket Number */}
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

          {/* URL & Link */}
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

          {/* Description & Notes */}
          <div className="form-group">
            <label htmlFor="task-notes-input">Notas & Descripción</label>
            <textarea
              id="task-notes-input"
              rows={3}
              placeholder="Detalles adicionales..."
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          {/* Subtasks Section */}
          <div className="form-group subtasks-group">
            <label>Sub-tareas ({form.subtasks.length})</label>
            <div className="subtasks-list">
              {form.subtasks.map((st) => (
                <div key={st.id} className="subtask-item">
                  <input
                    type="checkbox"
                    checked={Boolean(st.completed)}
                    onChange={() => handleToggleSubtask(st.id)}
                  />
                  <span className={st.completed ? 'completed' : ''}>{st.title}</span>
                  <button
                    type="button"
                    className="subtask-delete"
                    onClick={() => handleRemoveSubtask(st.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="add-subtask-row">
              <input
                type="text"
                placeholder="Añadir sub-tarea..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask(e)}
              />
              <button type="button" className="ghost-button compact" onClick={handleAddSubtask}>
                + Añadir
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sheet-drawer-footer">
            {task?.id && onDelete && (
              <button
                type="button"
                className="ghost-button danger"
                onClick={() => {
                  onDelete(task.id);
                  onClose();
                }}
              >
                Eliminar
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
