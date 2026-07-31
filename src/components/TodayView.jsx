import { useMemo } from 'react';
import { toDateStr } from '../utils.jsx';
import { PRIORITY } from '../constants.js';

export default function TodayView({
  tasks = [],
  events = [],
  onSelectTask,
  onToggleComplete,
  onOpenCreateTask,
  onNavigateToView
}) {
  const todayStr = useMemo(() => toDateStr(new Date()), []);

  const todayDateFormatted = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }, []);

  const { todayTasks, overdueTasks, completedToday, nextRecommendedTask } = useMemo(() => {
    const todayList = [];
    const overdueList = [];
    let completedCount = 0;

    tasks.forEach((task) => {
      const isDone = task.status === 'done';
      if (isDone) {
        if (task.completedAt && task.completedAt.startsWith(todayStr)) {
          completedCount++;
        }
        return;
      }

      if (task.dueDate) {
        if (task.dueDate === todayStr) {
          todayList.push(task);
        } else if (task.dueDate < todayStr) {
          overdueList.push(task);
        }
      } else if (task.priority === PRIORITY.HIGH || task.priority === PRIORITY.URGENT) {
        todayList.push(task);
      }
    });

    // Sort today's tasks by priority and time
    todayList.sort((a, b) => {
      const pMap = { urgent: 4, high: 3, medium: 2, low: 1 };
      const pA = pMap[a.priority] || 0;
      const pB = pMap[b.priority] || 0;
      if (pA !== pB) return pB - pA;
      return (a.dueTime || '23:59').localeCompare(b.dueTime || '23:59');
    });

    const nextTask = todayList[0] || overdueList[0] || null;

    return {
      todayTasks: todayList,
      overdueTasks: overdueList,
      completedToday: completedCount,
      nextRecommendedTask: nextTask
    };
  }, [tasks, todayStr]);

  const todayEvents = useMemo(() => {
    return (events[todayStr] || []).sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  }, [events, todayStr]);

  return (
    <div className="today-view-container fade-in">
      {/* Welcome & Productivity Overview */}
      <div className="today-header-banner material-elevated">
        <div className="today-welcome-text">
          <span className="eyebrow">Resumen del Día</span>
          <h1 className="today-date-title">{todayDateFormatted}</h1>
          <p className="today-subtitle">
            {todayTasks.length === 0 && overdueTasks.length === 0
              ? '✨ No tienes tareas pendientes para hoy. ¡Excelente trabajo!'
              : `Tienes ${todayTasks.length} tarea${todayTasks.length === 1 ? '' : 's'} programada${todayTasks.length === 1 ? '' : 's'} hoy${overdueTasks.length > 0 ? ` y ${overdueTasks.length} atrasada${overdueTasks.length === 1 ? '' : 's'}` : ''}.`}
          </p>
        </div>

        <div className="today-quick-stats">
          <div className="today-stat-pill">
            <span className="today-stat-value">{todayTasks.length}</span>
            <span className="today-stat-label">Para Hoy</span>
          </div>
          <div className={`today-stat-pill ${overdueTasks.length > 0 ? 'warning' : ''}`}>
            <span className="today-stat-value">{overdueTasks.length}</span>
            <span className="today-stat-label">Atrasadas</span>
          </div>
          <div className="today-stat-pill success">
            <span className="today-stat-value">{completedToday}</span>
            <span className="today-stat-label">Hechas Hoy</span>
          </div>
        </div>
      </div>

      {/* Next Priority Focus Section */}
      {nextRecommendedTask && (
        <div className="today-next-focus material-floating">
          <div className="next-focus-badge">
            <span>🎯 Siguiente Foco Recomendado</span>
          </div>
          <div className="next-focus-content">
            <div className="next-focus-main">
              <h3 className="next-focus-title">{nextRecommendedTask.name}</h3>
              {nextRecommendedTask.description && (
                <p className="next-focus-desc">{nextRecommendedTask.description}</p>
              )}
              <div className="next-focus-meta">
                {nextRecommendedTask.category && (
                  <span className="category-pill">{nextRecommendedTask.category}</span>
                )}
                {nextRecommendedTask.dueTime && (
                  <span className="time-pill">⏰ {nextRecommendedTask.dueTime}</span>
                )}
              </div>
            </div>
            <div className="next-focus-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => onToggleComplete && onToggleComplete(nextRecommendedTask.id)}
              >
                ✓ Completar
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => onSelectTask && onSelectTask(nextRecommendedTask)}
              >
                Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Today's Tasks & Today's Events */}
      <div className="today-grid">
        {/* Today's Tasks Column */}
        <section className="today-tasks-section material-base">
          <div className="section-header">
            <h2>Tareas de Hoy ({todayTasks.length})</h2>
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => onOpenCreateTask && onOpenCreateTask()}
            >
              + Nueva Tarea
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div className="empty-state-card">
              <span className="empty-icon">🎉</span>
              <p>No hay tareas pendientes para el día de hoy.</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => onOpenCreateTask && onOpenCreateTask()}
              >
                Crear Tarea
              </button>
            </div>
          ) : (
            <div className="today-tasks-list">
              {todayTasks.map((task) => (
                <div key={task.id} className="today-task-card material-elevated">
                  <button
                    type="button"
                    className="task-checkbox"
                    onClick={() => onToggleComplete && onToggleComplete(task.id)}
                    aria-label={`Completar ${task.name}`}
                  />
                  <div
                    className="task-card-body"
                    onClick={() => onSelectTask && onSelectTask(task)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectTask && onSelectTask(task)}
                  >
                    <span className="task-title">{task.name}</span>
                    <div className="task-card-sub">
                      {task.category && <span className="category-pill">{task.category}</span>}
                      {task.dueTime && <span className="time-pill">⏰ {task.dueTime}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {overdueTasks.length > 0 && (
            <div className="overdue-subblock">
              <h3>⚠️ Tareas Atrasadas ({overdueTasks.length})</h3>
              <div className="today-tasks-list">
                {overdueTasks.map((task) => (
                  <div key={task.id} className="today-task-card material-elevated overdue">
                    <button
                      type="button"
                      className="task-checkbox"
                      onClick={() => onToggleComplete && onToggleComplete(task.id)}
                      aria-label={`Completar ${task.name}`}
                    />
                    <div
                      className="task-card-body"
                      onClick={() => onSelectTask && onSelectTask(task)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="task-title">{task.name}</span>
                      <span className="overdue-tag">Venció {task.dueDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Agenda / Events Column */}
        <section className="today-events-section material-base">
          <div className="section-header">
            <h2>Agenda & Eventos</h2>
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => onNavigateToView && onNavigateToView('calendar')}
            >
              Ver Calendario →
            </button>
          </div>

          {todayEvents.length === 0 ? (
            <div className="empty-state-card">
              <span className="empty-icon">📅</span>
              <p>Sin eventos ni reuniones en la agenda de hoy.</p>
            </div>
          ) : (
            <div className="today-events-list">
              {todayEvents.map((evt, idx) => (
                <div key={evt.id || idx} className="today-event-card material-elevated">
                  <span className="event-time-badge">{evt.time || 'Todo el día'}</span>
                  <div className="event-info">
                    <span className="event-title">{evt.title || evt.name}</span>
                    {evt.description && <span className="event-desc">{evt.description}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
