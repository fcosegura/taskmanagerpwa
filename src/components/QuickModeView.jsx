import { useMemo, useRef, useState } from 'react';
import { PRIORITY, STATUS, normalizeStatuses } from '../constants.js';
import { recommendNextFocusTask } from '../focusRecommendation.js';
import { getStatusInfo } from '../statusHelpers.js';
import { applyJiraAutofillFromUrl } from '../jiraTicket.js';
import './QuickModeView.css';

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function QuickModeView({
  todayTasks = [],
  overdueTasks = [],
  upcomingTasks = [],
  todayEvents = [],
  focusTasks = [],
  statuses = STATUS,
  nextFocusAllowedStatuses,
  onToggleComplete,
  onCreateTask,
  onSwitchToFull,
}) {
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(now), [now]);
  const todayDateFormatted = useMemo(() => now.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  }), [now]);

  const [name, setName] = useState('');
  const [date, setDate] = useState(todayStr);
  const [priority, setPriority] = useState('medium');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const nameInputRef = useRef(null);

  const normalizedStatuses = useMemo(() => normalizeStatuses(statuses), [statuses]);
  const statusMap = useMemo(
    () => normalizedStatuses.reduce((acc, s) => { acc[s.v] = s; return acc; }, {}),
    [normalizedStatuses],
  );

  const recommendation = useMemo(() => {
    const combined = [];
    const seen = new Set();
    [overdueTasks, todayTasks, focusTasks].forEach((list) => {
      (list || []).forEach((t) => {
        if (t && t.id && !seen.has(t.id)) { seen.add(t.id); combined.push(t); }
      });
    });
    return recommendNextFocusTask({
      tasks: combined,
      today: todayStr,
      now,
      statuses: normalizedStatuses,
      allowedStatuses: nextFocusAllowedStatuses,
    });
  }, [overdueTasks, todayTasks, focusTasks, todayStr, now, normalizedStatuses, nextFocusAllowedStatuses]);

  const nextFocusTask = recommendation.task;
  const recommendationReason = recommendation.reason;

  const upcomingTaskGroups = useMemo(() => {
    const groups = new Map();
    upcomingTasks.forEach((task) => {
      if (!groups.has(task.date)) groups.set(task.date, []);
      groups.get(task.date).push(task);
    });
    return [...groups.entries()];
  }, [upcomingTasks]);

  const formatUpcomingDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  };

  const handleUrlChange = (value) => {
    setUrl(value);
    const next = applyJiraAutofillFromUrl(
      { name, category, priority, ticketNumber, url: value },
      value,
    );
    setName(next.name || '');
    setCategory(next.category || '');
    setPriority(next.priority || 'medium');
    setTicketNumber(next.ticketNumber || '');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (onCreateTask) onCreateTask({ name: trimmed, date, priority, url, category, ticketNumber });
    setName('');
    setDate(todayStr);
    setPriority('medium');
    setUrl('');
    setCategory('');
    setTicketNumber('');
    nameInputRef.current?.focus();
  };

  const renderTaskCard = (task, { overdue = false } = {}) => {
    const sInfo = getStatusInfo(task.status, statusMap);
    return (
      <div key={task.id} className={`today-task-card material-elevated${overdue ? ' overdue' : ''}`}>
        <button
          type="button"
          className="task-checkbox task-checkbox-animated"
          onClick={() => onToggleComplete && onToggleComplete(task.id)}
          aria-label={`Completar ${task.name}`}
        />
        <span className="task-card-body">
          <span className="task-title">{task.name}</span>
          <span className="task-card-sub">
            {sInfo && (
              <span
                className={`status-pill status-${task.status}`}
                style={{
                  color: sInfo.tv ? `var(${sInfo.tv})` : undefined,
                  backgroundColor: sInfo.bv ? `var(${sInfo.bv})` : undefined,
                  borderColor: sInfo.bov ? `var(${sInfo.bov})` : undefined
                }}
              >
                {sInfo.label || sInfo.l || task.status}
              </span>
            )}
            {task.category && <span className="category-pill">{task.category}</span>}
            {task.time && <span className="time-pill"><span aria-hidden="true">⏰ </span>{task.time}</span>}
            {overdue && <span className="overdue-tag">Venció {task.date}</span>}
          </span>
        </span>
      </div>
    );
  };

  return (
    <div className="quick-mode-shell" data-density="compact">
      <main className="quick-mode-card material-elevated">
        <header className="quick-mode-header">
          <div className="quick-mode-header-text">
            <span className="eyebrow">Hoy</span>
            <h1 className="quick-mode-date">{todayDateFormatted}</h1>
          </div>
          <button
            type="button"
            className="ghost-button compact quick-mode-full-link"
            onClick={() => onSwitchToFull && onSwitchToFull()}
          >
            Versión completa →
          </button>
        </header>

        <section className="quick-mode-section">
          <h2 className="quick-mode-section-title"><span aria-hidden="true">🎯 </span>Siguiente foco</h2>
          {nextFocusTask ? (
            <div className="today-task-card material-elevated quick-mode-focus-card">
              <button
                type="button"
                className="task-checkbox task-checkbox-animated"
                onClick={() => onToggleComplete && onToggleComplete(nextFocusTask.id)}
                aria-label={`Completar ${nextFocusTask.name}`}
              />
              <span className="task-card-body">
                <span className="task-title">{nextFocusTask.name}</span>
                {recommendationReason && <span className="next-focus-reason-pill">{recommendationReason}</span>}
              </span>
            </div>
          ) : (
            <div className="quick-mode-empty">Sin foco pendiente. ¡Todo al día!</div>
          )}
        </section>

        <section className="quick-mode-section">
          <h2 className="quick-mode-section-title"><span aria-hidden="true">➕ </span>Añadir tarea</h2>
          <form className="quick-mode-form" onSubmit={handleSubmit}>
            <input
              ref={nameInputRef}
              id="quick-task-name"
              type="text"
              className="quick-mode-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Qué tienes que hacer?"
              aria-label="Nombre de la tarea"
              required
            />
            <input
              type="date"
              className="quick-mode-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Fecha"
            />
            <input
              type="text"
              inputMode="url"
              className="quick-mode-input"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://..."
              aria-label="URL"
            />
            <input
              type="text"
              className="quick-mode-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Categoría"
              aria-label="Categoría"
            />
            <div className="quick-mode-priority" role="group" aria-label="Prioridad">
              {PRIORITY.map((p) => (
                <button
                  key={p.v}
                  type="button"
                  className={`quick-mode-priority-pill${priority === p.v ? ' active' : ''}`}
                  aria-pressed={priority === p.v}
                  onClick={() => setPriority(p.v)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button type="submit" className="primary-button quick-mode-add">Añadir</button>
          </form>
        </section>

        <section className="quick-mode-section">
          <h2 className="quick-mode-section-title">Tareas de hoy ({todayTasks.length})</h2>
          {todayTasks.length === 0 ? (
            <div className="quick-mode-empty">Sin tareas para hoy.</div>
          ) : (
            <div className="today-tasks-list">{todayTasks.map((task) => renderTaskCard(task))}</div>
          )}
        </section>

        {overdueTasks.length > 0 && (
          <section className="quick-mode-section">
            <h2 className="quick-mode-section-title quick-mode-section-title--warning">Atrasadas ({overdueTasks.length})</h2>
            <div className="today-tasks-list">
              {overdueTasks.map((task) => renderTaskCard(task, { overdue: true }))}
            </div>
          </section>
        )}

        <section className="quick-mode-section">
          <h2 className="quick-mode-section-title">Próximas tareas ({upcomingTasks.length})</h2>
          {upcomingTaskGroups.length === 0 ? (
            <div className="quick-mode-empty">No hay tareas en los próximos días laborables.</div>
          ) : (
            <div className="upcoming-task-groups">
              {upcomingTaskGroups.map(([dateStr, tasksForDate]) => (
                <div key={dateStr} className="upcoming-task-group">
                  <h4>{formatUpcomingDate(dateStr)}</h4>
                  <div className="today-tasks-list">{tasksForDate.map((task) => renderTaskCard(task))}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="quick-mode-section">
          <h2 className="quick-mode-section-title">Agenda y eventos</h2>
          {todayEvents.length === 0 ? (
            <div className="quick-mode-empty">Sin eventos hoy.</div>
          ) : (
            <div className="today-events-list">
              {todayEvents.map((evt, idx) => {
                const timeBadge = evt.allDay ? 'Todo el día' : (evt.startTime || evt.time || 'Todo el día');
                const eventTitle = evt.title || evt.name || 'Evento';
                return (
                  <div key={evt.id || idx} className="today-event-card material-elevated">
                    <span className="event-time-badge">{timeBadge}</span>
                    <span className="event-title">{eventTitle}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
