import { useMemo } from 'react';
import { STATUS, normalizeStatuses } from '../constants.js';
import { getDisplayDescription } from '../todayViewHelpers.js';
import { recommendNextFocusTask } from '../focusRecommendation.js';

export default function TodayView({
  todayTasks = [],
  overdueTasks = [],
  allTasks = [],
  todayEvents = [],
  completedTodayCount = 0,
  onSelectTask,
  onToggleComplete,
  onOpenCreateTask,
  onNavigateToView,
  statuses = STATUS,
  onChangeStatus,
}) {
  const normalizedStatuses = useMemo(() => normalizeStatuses(statuses), [statuses]);

  const statusMap = useMemo(() => {
    return normalizedStatuses.reduce((acc, s) => {
      acc[s.v] = s;
      return acc;
    }, {});
  }, [normalizedStatuses]);

  const getStatusInfo = (statusKey) => {
    if (!statusKey) return null;
    if (statusMap[statusKey]) return statusMap[statusKey];
    const formattedLabel = statusKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
    return {
      v: statusKey,
      label: formattedLabel,
      tv: '--color-text-info',
      bv: '--color-background-info',
      bov: '--color-border-info'
    };
  };

  const todayDateFormatted = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }, []);

  const sortedTodayTasks = useMemo(() => {
    const pMap = { critical: 4, urgent: 4, high: 3, medium: 2, low: 1 };
    return [...todayTasks].sort((a, b) => {
      const pA = pMap[a.priority] || 0;
      const pB = pMap[b.priority] || 0;
      if (pA !== pB) return pB - pA;
      return (a.time || '23:59').localeCompare(b.time || '23:59');
    });
  }, [todayTasks]);

  const sortedTodayEvents = useMemo(() => {
    return [...todayEvents].sort((a, b) => {
      const timeA = a.startTime || a.time || '00:00';
      const timeB = b.startTime || b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [todayEvents]);

  const recommendation = useMemo(() => {
    const combinedTasks = [];
    const seenIds = new Set();
    const addTasks = (list) => {
      if (Array.isArray(list)) {
        for (const t of list) {
          if (t && t.id && !seenIds.has(t.id)) {
            seenIds.add(t.id);
            combinedTasks.push(t);
          }
        }
      }
    };
    addTasks(overdueTasks);
    addTasks(todayTasks);
    addTasks(allTasks);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    return recommendNextFocusTask({
      tasks: combinedTasks,
      today: todayStr,
      now,
      statuses: normalizedStatuses,
    });
  }, [allTasks, todayTasks, overdueTasks, normalizedStatuses]);

  const nextRecommendedTask = recommendation.task;
  const recommendationReason = recommendation.reason;
  const displayDescription = useMemo(() => getDisplayDescription(nextRecommendedTask), [nextRecommendedTask]);

  return (
    <div className="today-view-container fade-in">
      {/* Welcome & Productivity Overview */}
      <div className="today-header-banner material-elevated">
        <div className="today-welcome-text">
          <span className="eyebrow">Resumen del Día</span>
          <h1 className="today-date-title">{todayDateFormatted}</h1>
          <p className="today-subtitle">
            {todayTasks.length === 0 && overdueTasks.length === 0
              ? <><span aria-hidden="true">✨ </span>No tienes tareas pendientes para hoy. ¡Excelente trabajo!</>
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
            <span className="today-stat-value">{completedTodayCount}</span>
            <span className="today-stat-label">Hechas Hoy</span>
          </div>
        </div>
      </div>

      {/* Next Priority Focus Section */}
      {nextRecommendedTask && (
        <div className="today-next-focus material-floating">
          <div className="next-focus-badge-wrapper">
            <div className="next-focus-badge">
              <span><span aria-hidden="true">🎯 </span>Siguiente Foco Recomendado</span>
            </div>
            {recommendationReason && (
              <span className="next-focus-reason-pill">
                {recommendationReason}
              </span>
            )}
          </div>

          <div className="next-focus-content">
            <div className="next-focus-main">
              <h3 className="next-focus-title">{nextRecommendedTask.name}</h3>
              {displayDescription ? (
                <p className="next-focus-desc">{displayDescription}</p>
              ) : null}
              <div className="next-focus-meta">
                {nextRecommendedTask.category && (
                  <span className="category-pill">{nextRecommendedTask.category}</span>
                )}
                {nextRecommendedTask.time && (
                  <span className="time-pill"><span aria-hidden="true">⏰ </span>{nextRecommendedTask.time}</span>
                )}
              </div>
            </div>

            <div className="next-focus-actions">
              <select
                className="next-focus-status-select"
                value={nextRecommendedTask.status}
                onChange={(e) => onChangeStatus && onChangeStatus(nextRecommendedTask.id, e.target.value)}
                aria-label={`Cambiar estado de ${nextRecommendedTask.name}`}
              >
                {normalizedStatuses.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="primary-button"
                onClick={() => onToggleComplete && onToggleComplete(nextRecommendedTask.id)}
              >
                <span aria-hidden="true">✓ </span>Completar
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
              <span className="empty-icon" aria-hidden="true">🎉</span>
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
              {sortedTodayTasks.map((task) => {
                const sInfo = getStatusInfo(task.status);
                return (
                  <div key={task.id} className="today-task-card material-elevated">
                    <button
                      type="button"
                      className="task-checkbox task-checkbox-animated"
                      onClick={() => onToggleComplete && onToggleComplete(task.id)}
                      aria-label={`Completar ${task.name}`}
                    />
                    <button
                      type="button"
                      className="task-card-body"
                      onClick={() => onSelectTask && onSelectTask(task)}
                    >
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
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {overdueTasks.length > 0 && (
            <div className="overdue-subblock">
              <h3><span aria-hidden="true">⚠️ </span>Tareas Atrasadas ({overdueTasks.length})</h3>
              <div className="today-tasks-list">
                {overdueTasks.map((task) => {
                  const sInfo = getStatusInfo(task.status);
                  return (
                    <div key={task.id} className="today-task-card material-elevated overdue">
                      <button
                        type="button"
                        className="task-checkbox task-checkbox-animated"
                        onClick={() => onToggleComplete && onToggleComplete(task.id)}
                        aria-label={`Completar ${task.name}`}
                      />
                      <button
                        type="button"
                        className="task-card-body"
                        onClick={() => onSelectTask && onSelectTask(task)}
                      >
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
                          <span className="overdue-tag">Venció {task.date}</span>
                        </span>
                      </button>
                    </div>
                  );
                })}
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

          {sortedTodayEvents.length === 0 ? (
            <div className="empty-state-card">
              <span className="empty-icon" aria-hidden="true">📅</span>
              <p>Sin eventos ni reuniones en la agenda de hoy.</p>
            </div>
          ) : (
            <div className="today-events-list">
              {sortedTodayEvents.map((evt, idx) => {
                const timeBadge = evt.allDay ? 'Todo el día' : (evt.startTime || evt.time || 'Todo el día');
                const eventTitle = evt.title || evt.name || 'Evento';
                return (
                  <div key={evt.id || idx} className="today-event-card material-elevated">
                    <span className="event-time-badge">{timeBadge}</span>
                    <div className="event-info">
                      <span className="event-title">{eventTitle}</span>
                      {evt.description && <span className="event-desc">{evt.description}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
