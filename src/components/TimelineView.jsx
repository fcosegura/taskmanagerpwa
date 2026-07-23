import { useState, useMemo } from 'react';
import './TimelineView.css';

export default function TimelineView({
  tasks = [],
  statuses = [],
  onOpenTaskPreview,
}) {
  const [selectedTaskIds, setSelectedTaskIds] = useState(() => {
    // By default, select all active tasks (not done) on load
    return new Set(tasks.filter(t => t.status !== 'done').map(t => t.id));
  });

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest) or 'asc' (oldest)
  const [expandedSections, setExpandedSections] = useState({ active: true, completed: true });

  // Group and filter tasks for the sidebar
  const { activeTasks, completedTasks } = useMemo(() => {
    const active = [];
    const completed = [];

    tasks.forEach(t => {
      const name = t.name || '';
      const matchesSearch = name.toLowerCase().includes(sidebarSearch.toLowerCase());
      if (matchesSearch) {
        if (t.status === 'done') {
          completed.push(t);
        } else {
          active.push(t);
        }
      }
    });

    return { activeTasks: active, completedTasks: completed };
  }, [tasks, sidebarSearch]);

  const toggleTaskSelection = (id) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allVisibleIds = [...activeTasks, ...completedTasks].map(t => t.id);
    setSelectedTaskIds(new Set(allVisibleIds));
  };

  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusObj = (v) => {
    return statuses.find(s => s.v === v) || { 
      v, 
      label: v === 'not_done' ? 'Sin iniciar' : v, 
      tv: '--color-text-primary', 
      bv: '--color-background-secondary', 
      bov: '--color-border-secondary' 
    };
  };

  // Compile, filter and sort timeline events
  const timelineEvents = useMemo(() => {
    const events = [];

    tasks.forEach(task => {
      if (!task || !task.id) return;
      if (!selectedTaskIds.has(task.id)) return;

      const taskName = task.name || '';

      // 1. Synthesize creation event
      const creationDate = task.createdAt || task.created_at;
      if (creationDate) {
        events.push({
          id: `${task.id}-created`,
          taskId: task.id,
          taskName,
          category: task.category,
          type: 'created',
          at: creationDate,
          toStatus: 'not_done', // Default initial status
        });
      }

      // 2. Gather status changes
      if (Array.isArray(task.statusLog)) {
        task.statusLog.forEach(log => {
          if (!log) return;
          events.push({
            id: log.id || `${task.id}-${log.at}-${log.toStatus}`,
            taskId: task.id,
            taskName,
            category: task.category,
            type: 'status_change',
            fromStatus: log.fromStatus,
            toStatus: log.toStatus,
            comment: log.comment,
            at: log.at,
          });
        });
      }
    });

    // Filter events
    return events
      .filter(event => {
        // Timeline text search
        const taskName = event.taskName || '';
        const comment = event.comment || '';
        const matchesText = 
          taskName.toLowerCase().includes(timelineSearch.toLowerCase()) || 
          comment.toLowerCase().includes(timelineSearch.toLowerCase());
        
        if (!matchesText) return false;

        // Timeline status filter
        if (timelineFilter === 'all') return true;
        if (timelineFilter === 'created') return event.type === 'created';
        
        return event.type === 'status_change' && event.toStatus === timelineFilter;
      })
      .sort((a, b) => {
        const dateA = new Date(a.at).getTime();
        const dateB = new Date(b.at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [tasks, selectedTaskIds, timelineSearch, timelineFilter, sortOrder]);

  // Date Formatter Helper
  const formatEventDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const now = new Date();
    const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return `Hoy, ${timeStr}`;
    } else if (isYesterday) {
      return `Ayer, ${timeStr}`;
    } else {
      const day = date.getDate();
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      
      if (year === now.getFullYear()) {
        return `${day} ${month}, ${timeStr}`;
      } else {
        return `${day} ${month} ${year}, ${timeStr}`;
      }
    }
  };

  // Node Icon Helper
  const renderNodeIcon = (type, toStatus) => {
    if (type === 'created') {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      );
    }
    
    switch (toStatus) {
      case 'done':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'blocked':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      case 'in_progress':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
          </svg>
        );
      case 'paused':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
            <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
          </svg>
        );
      default:
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
    }
  };

  return (
    <div className="timeline-container">
      {/* ── Sidebar: Task Selector ── */}
      <aside className="timeline-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
            Seleccionar Tareas
          </h2>
          
          <div className="sidebar-search-wrapper">
            <span className="sidebar-search-icon">⌕</span>
            <input
              type="text"
              className="sidebar-search-input"
              placeholder="Filtrar tareas..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />
          </div>

          <div className="sidebar-actions">
            <button type="button" className="sidebar-btn" onClick={handleSelectAll}>Todas</button>
            <button type="button" className="sidebar-btn" onClick={handleClearSelection}>Ninguna</button>
          </div>
        </div>

        <div className="sidebar-sections">
          {/* Active Tasks Section */}
          <div className="sidebar-section">
            <div className="sidebar-section-title" onClick={() => toggleSection('active')} style={{ cursor: 'pointer' }}>
              <span>Tareas Activas {expandedSections.active ? '▼' : '▶'}</span>
              <span className="sidebar-section-count">{activeTasks.length}</span>
            </div>
            
            {expandedSections.active && (
              <div className="sidebar-task-list">
                {activeTasks.length === 0 ? (
                  <div style={{ padding: '8px', fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                    Sin tareas activas
                  </div>
                ) : (
                  activeTasks.map(t => {
                    const isSelected = selectedTaskIds.has(t.id);
                    const statusObj = getStatusObj(t.status);
                    return (
                      <div
                        key={t.id}
                        className={`sidebar-task-item${isSelected ? ' selected' : ''}`}
                        onClick={() => toggleTaskSelection(t.id)}
                      >
                        <div className="task-item-checkbox" />
                        <div className="task-item-content">
                          <span className="task-item-name" title={t.name}>{t.name}</span>
                          <div className="task-item-meta">
                            {t.category && <span className="task-item-category">{t.category}</span>}
                            <span 
                              style={{ 
                                fontSize: '10px', 
                                color: `var(${statusObj.tv})`, 
                                background: `var(${statusObj.bv})`,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: '700'
                              }}
                            >
                              {statusObj.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Completed Tasks Section */}
          <div className="sidebar-section">
            <div className="sidebar-section-title" onClick={() => toggleSection('completed')} style={{ cursor: 'pointer' }}>
              <span>Tareas Completadas {expandedSections.completed ? '▼' : '▶'}</span>
              <span className="sidebar-section-count">{completedTasks.length}</span>
            </div>

            {expandedSections.completed && (
              <div className="sidebar-task-list">
                {completedTasks.length === 0 ? (
                  <div style={{ padding: '8px', fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                    Sin tareas completadas
                  </div>
                ) : (
                  completedTasks.map(t => {
                    const isSelected = selectedTaskIds.has(t.id);
                    return (
                      <div
                        key={t.id}
                        className={`sidebar-task-item completed${isSelected ? ' selected' : ''}`}
                        onClick={() => toggleTaskSelection(t.id)}
                      >
                        <div className="task-item-checkbox" />
                        <div className="task-item-content">
                          <span className="task-item-name" title={t.name}>{t.name}</span>
                          <div className="task-item-meta">
                            {t.category && <span className="task-item-category">{t.category}</span>}
                            <span 
                              style={{ 
                                fontSize: '10px', 
                                color: 'var(--color-text-success)', 
                                background: 'var(--color-background-success)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontWeight: '700'
                              }}
                            >
                              Completado
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Panel: Timeline ── */}
      <main className="timeline-content-panel">
        <div className="timeline-toolbar">
          <div className="toolbar-left">
            <div className="timeline-search-wrapper">
              <input
                type="text"
                className="timeline-search-input"
                placeholder="Buscar en el historial..."
                value={timelineSearch}
                onChange={(e) => setTimelineSearch(e.target.value)}
              />
            </div>
            
            <select
              className="timeline-filter-select"
              value={timelineFilter}
              onChange={(e) => setTimelineFilter(e.target.value)}
            >
              <option value="all">Todos los eventos</option>
              <option value="created">Solo creadas</option>
              {statuses.map(s => (
                <option key={s.v} value={s.v}>Cambios a: {s.label}</option>
              ))}
            </select>
          </div>

          <div className="toolbar-right">
            <button
              type="button"
              className="timeline-sort-btn"
              title={sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            >
              {sortOrder === 'desc' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              )}
            </button>
            
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', background: 'var(--color-background-secondary)', padding: '6px 12px', borderRadius: '20px' }}>
              {selectedTaskIds.size} seleccionadas
            </div>
          </div>
        </div>

        {selectedTaskIds.size === 0 ? (
          <div className="timeline-empty-state">
            <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3 className="empty-state-title">Ninguna tarea seleccionada</h3>
            <p className="empty-state-desc">
              Selecciona una o más tareas de la barra lateral para visualizar de forma gráfica su historial de cambios y flujo de estados.
            </p>
          </div>
        ) : timelineEvents.length === 0 ? (
          <div className="timeline-empty-state">
            <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
            <h3 className="empty-state-title">Sin eventos registrados</h3>
            <p className="empty-state-desc">
              Las tareas seleccionadas no registran eventos de cambio de estado o creación que coincidan con los filtros de búsqueda establecidos.
            </p>
          </div>
        ) : (
          <div className="timeline-list">
            {timelineEvents.map(event => {
              const toStatusObj = getStatusObj(event.toStatus);
              const fromStatusObj = event.fromStatus ? getStatusObj(event.fromStatus) : null;
              
              return (
                <div key={event.id} className="timeline-item">
                  {/* Desktop Timestamp */}
                  <div className="timeline-item-time">
                    {formatEventDate(event.at)}
                  </div>
                  
                  {/* Central Node Dot */}
                  <div className={`timeline-item-node ${event.type === 'created' ? 'created' : event.toStatus}`}>
                    {renderNodeIcon(event.type, event.toStatus)}
                  </div>

                  {/* Card Event Description */}
                  <div className="timeline-item-card">
                    <div className="card-header">
                      <div className="card-title-area">
                        <span 
                          className="card-task-name"
                          onClick={() => onOpenTaskPreview?.({ id: event.taskId })}
                          title="Ver detalles de la tarea"
                        >
                          {event.taskName}
                        </span>
                        <div className="card-meta">
                          {event.category && <span className="task-item-category">{event.category}</span>}
                          {/* Mobile Timestamp */}
                          <span className="card-time-mobile">
                            {formatEventDate(event.at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="card-body">
                      {event.type === 'created' ? (
                        <div className="status-transition-flow">
                          <span 
                            className="status-badge" 
                            style={{ 
                              color: 'var(--color-text-primary)', 
                              background: 'var(--color-background-secondary)',
                              borderColor: 'var(--color-border-secondary)',
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            }}
                          >
                            Tarea Creada
                          </span>
                          <span className="transition-arrow">➔</span>
                          <span 
                            className="status-badge"
                            style={{ 
                              color: `var(${toStatusObj.tv})`, 
                              background: `var(${toStatusObj.bv})`,
                              borderColor: `var(${toStatusObj.bov})`,
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            }}
                          >
                            {toStatusObj.label}
                          </span>
                        </div>
                      ) : (
                        <div className="status-transition-flow">
                          <span 
                            className="status-badge"
                            style={{ 
                              color: fromStatusObj ? `var(${fromStatusObj.tv})` : 'var(--color-text-secondary)', 
                              background: fromStatusObj ? `var(${fromStatusObj.bv})` : 'var(--color-background-secondary)',
                              borderColor: fromStatusObj ? `var(${fromStatusObj.bov})` : 'var(--color-border-secondary)',
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            }}
                          >
                            {fromStatusObj ? fromStatusObj.label : 'Sin iniciar'}
                          </span>
                          <span className="transition-arrow">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </span>
                          <span 
                            className="status-badge"
                            style={{ 
                              color: `var(${toStatusObj.tv})`, 
                              background: `var(${toStatusObj.bv})`,
                              borderColor: `var(${toStatusObj.bov})`,
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            }}
                          >
                            {toStatusObj.label}
                          </span>
                        </div>
                      )}

                      {event.comment && (
                        <div 
                          className="comment-bubble" 
                          style={{ 
                            borderLeftColor: `var(${toStatusObj.bov})` 
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="comment-text">“{event.comment}”</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
