import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS, PRIORITY } from '../constants.js';
import { fmtDate, isCompletedAtWithinKanbanRange } from '../utils.jsx';
import { isChildTask, shouldShowTaskInKanbanDoneColumn } from '../kanbanTaskVisibility.js';
import { getHiddenKanbanTaskCount, getVisibleKanbanTasks, sortKanbanTasksByRecency } from '../kanbanTaskLimit.js';
import CopyTicketButton from './CopyTicketButton.jsx';
import { CategoryPill } from './shared/index.jsx';

const KANBAN_DONE_RANGE_OPTIONS = [
  { key: 'week', label: 'Semana actual' },
  { key: 'two_weeks', label: '2 semanas' },
  { key: 'month', label: '1 mes' },
  { key: 'all', label: 'Todas' },
];

const DONE_RANGE_ALLOWED = new Set(KANBAN_DONE_RANGE_OPTIONS.map((o) => o.key));

const KANBAN_TASK_ROLE_OPTIONS = [
  { key: 'all', label: 'Todas' },
  { key: 'parent', label: 'Epic / Principal' },
  { key: 'child', label: 'Sub-tareas' },
];

const TASK_ROLE_ALLOWED = new Set(KANBAN_TASK_ROLE_OPTIONS.map((o) => o.key));

function taskMatchesRoleFilter(task, allTasks, roleFilter) {
  if (roleFilter === 'parent') return !isChildTask(allTasks, task.id);
  if (roleFilter === 'child') return isChildTask(allTasks, task.id);
  return true;
}

function readDoneRangeFromStorage(storageKey) {
  if (!storageKey) return 'week';
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw && DONE_RANGE_ALLOWED.has(raw)) return raw;
  } catch {
    // ignore
  }
  return 'week';
}

function parseStoredVisibleColumns(raw, allowedValues) {
  const allowed = new Set(allowedValues);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const filtered = parsed.filter((v) => typeof v === 'string' && allowed.has(v));
    if (filtered.length === 0) return null;
    return filtered;
  } catch {
    return null;
  }
}

function readVisibleFromStorage(storageKey, allowedValues) {
  if (!storageKey) return [...allowedValues];
  const parsed = parseStoredVisibleColumns(localStorage.getItem(storageKey), allowedValues);
  if (!parsed) return [...allowedValues];
  const allowedSet = new Set(allowedValues);
  return parsed.filter((v) => allowedSet.has(v));
}

function KanbanTaskCard({
  task,
  allTasks,
  onEditTask,
  onOpenTaskPreview,
  onOpenPriorityPicker,
  onDragStart,
  onDragEnd,
  isDragOver = false,
  dragMode = null,
  isChild = false,
  isDragging = false,
  isLanding = false,
}) {
  const priority = PRIORITY.find((item) => item.v === task.priority) || PRIORITY[1];
  const childTasks = allTasks.filter((candidate) => (task.dependencyTaskIds || []).includes(candidate.id));
  const parentTasks = allTasks.filter((candidate) => (candidate.dependencyTaskIds || []).includes(task.id));
  const hasParentTask = parentTasks.length > 0;
  const hasChildTasks = childTasks.length > 0;
  const isLinkDropTarget = isDragOver && dragMode === 'link';

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((st) => st.completed).length;

  const cardClassName = [
    'kanban-task-card',
    'material-elevated',
    isChild ? 'kanban-task-card--child' : '',
    isDragging ? 'kanban-task-card--dragging' : '',
    isLanding ? 'kanban-task-card--landing' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      draggable
      className={cardClassName}
      onDragStart={(event) => onDragStart(event, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => (onOpenTaskPreview ?? onEditTask)?.(task)}
      style={{
        borderRadius: isChild ? 10 : 12,
        cursor: 'grab',
        border: isLinkDropTarget ? '2px solid var(--color-accent)' : undefined,
      }}
    >
      <div className="kanban-task-card-handle">
        <div
          title="Arrastra desde aquí para mover o crear dependencia"
          className="kanban-task-card-handle-label"
        >
          <span className="kanban-task-card-handle-icon">⋮⋮</span>
          <span>Arrastrar</span>
        </div>
      </div>

      {isDragOver && (
        <div style={{ fontSize: 10, fontWeight: 700, color: dragMode === 'link' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
          {dragMode === 'link' ? 'Soltar para crear dependencia' : 'Soltar para mover'}
        </div>
      )}

      <div className="kanban-task-card-title">
        {task.name}
      </div>

      {task.date && (
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {fmtDate(task.date)}{task.time ? ` · ${task.time}` : ''}
        </div>
      )}

      {(childTasks.length > 0 || parentTasks.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {hasChildTasks && (
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
              Depende de: {childTasks.map((ct) => ct.name).join(', ')}
            </div>
          )}
          {hasParentTask && (
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
              Parte de: {parentTasks.map((pt) => pt.name).join(', ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {onOpenPriorityPicker ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPriorityPicker(task);
            }}
            aria-label={`Cambiar prioridad, actualmente ${priority.label}`}
            style={{
              alignSelf: 'flex-start',
              borderRadius: 999,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 700,
              color: `var(${priority.tv})`,
              background: `var(${priority.bv})`,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {priority.label}
          </button>
        ) : (
          <div
            style={{
              alignSelf: 'flex-start',
              borderRadius: 999,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 700,
              color: `var(${priority.tv})`,
              background: `var(${priority.bv})`,
            }}
          >
            {priority.label}
          </div>
        )}

        {subtasks.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', background: 'var(--material-base-bg)', padding: '2px 6px', borderRadius: 999 }}>
            ✓ {completedSubtasks}/{subtasks.length}
          </span>
        )}

        {task.category && <CategoryPill name={task.category} />}
        <CopyTicketButton ticketNumber={task.ticketNumber} />
      </div>
    </div>
  );
}

export default function KanbanView({
  tasks,
  allTasks = [],
  onEditTask,
  onOpenCreateTask,
  onOpenTaskPreview,
  onOpenPriorityPicker,
  onMoveTaskStatus,
  onDropTaskOnTask,
  onDailyStatus,
  dailyStatusLoading = false,
  kanbanColumnsStorageKey = 'taskmanager_kanban_visible_columns_default',
  kanbanDoneRangeStorageKey = 'taskmanager_kanban_done_range_default',
  statuses = STATUS,
}) {
  const statusValues = useMemo(() => statuses.map((s) => s.v), [statuses]);
  const [visibleStatuses, setVisibleStatuses] = useState(() => readVisibleFromStorage(kanbanColumnsStorageKey, statusValues));

  const [prevStatusValues, setPrevStatusValues] = useState(statusValues);

  if (statusValues.length !== prevStatusValues.length || statusValues.some((v, i) => prevStatusValues[i] !== v)) {
    setPrevStatusValues(statusValues);
    setVisibleStatuses((prev) => {
      const allowed = new Set(statusValues);
      const filtered = prev.filter((v) => allowed.has(v));
      const newStatuses = statusValues.filter((v) => !prev.includes(v));
      return [...filtered, ...newStatuses];
    });
  }

  const [doneRange, setDoneRange] = useState(() => readDoneRangeFromStorage(kanbanDoneRangeStorageKey));
  const [taskRoleFilter, setTaskRoleFilter] = useState('all');
  const [expandedStatuses, setExpandedStatuses] = useState(() => new Set());
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const columnsMenuRef = useRef(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragSourceStatus, setDragSourceStatus] = useState(null);
  const [landingTaskId, setLandingTaskId] = useState(null);
  const [hoverStatus, setHoverStatus] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverTaskId, setHoverTaskId] = useState(null);
  const [hoverDragMode, setHoverDragMode] = useState(null);
  const [draggedColumnStatus, setDraggedColumnStatus] = useState(null);
  const [hoverColumnStatus, setHoverColumnStatus] = useState(null);
  const landingTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (landingTimeoutRef.current) clearTimeout(landingTimeoutRef.current);
  }, []);

  const triggerLandingAnimation = (taskId) => {
    if (!taskId) return;
    setLandingTaskId(taskId);
    if (landingTimeoutRef.current) clearTimeout(landingTimeoutRef.current);
    landingTimeoutRef.current = setTimeout(() => {
      setLandingTaskId(null);
      landingTimeoutRef.current = null;
    }, 520);
  };

  const resetDragState = () => {
    setDraggedTaskId(null);
    setDragSourceStatus(null);
    setHoverStatus(null);
    setHoverIndex(null);
    setHoverTaskId(null);
    setHoverDragMode(null);
  };

  useEffect(() => {
    if (!showColumnsMenu) return;
    const onPointerDown = (event) => {
      if (!columnsMenuRef.current?.contains(event.target)) {
        setShowColumnsMenu(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [showColumnsMenu]);

  const toggleColumnVisibility = (statusV) => {
    setVisibleStatuses((prev) => {
      const has = prev.includes(statusV);
      if (has && prev.length <= 1) return prev;
      let next;
      if (has) {
        next = prev.filter((v) => v !== statusV);
      } else {
        next = [...prev, statusV];
      }
      try {
        localStorage.setItem(kanbanColumnsStorageKey, JSON.stringify(next));
      } catch {
        // ignore quota / private mode
      }
      return next;
    });
  };

  const visibleColumns = useMemo(() => {
    const statusMap = new Map(statuses.map((s) => [s.v, s]));
    return visibleStatuses.map((v) => statusMap.get(v)).filter(Boolean);
  }, [visibleStatuses, statuses]);

  const canLinkAsChild = (sourceTaskId, targetTaskId) => {
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return false;
    const sourceTask = allTasks.find((task) => task.id === sourceTaskId);
    const targetTask = allTasks.find((task) => task.id === targetTaskId);
    if (!sourceTask || !targetTask) return false;
    const hasParent = (taskId) => allTasks.some((task) => (
      Array.isArray(task.dependencyTaskIds) &&
      task.dependencyTaskIds.includes(taskId)
    ));
    const sourceHasParent = hasParent(sourceTaskId);
    const sourceHasChildren = Array.isArray(sourceTask.dependencyTaskIds) && sourceTask.dependencyTaskIds.length > 0;
    const targetHasParent = hasParent(targetTaskId);
    const alreadyLinked = (targetTask.dependencyTaskIds || []).includes(sourceTaskId);
    return !sourceHasParent && !sourceHasChildren && !targetHasParent && !alreadyLinked;
  };

  const roleFilteredTasks = useMemo(
    () => tasks.filter((task) => taskMatchesRoleFilter(task, allTasks, taskRoleFilter)),
    [tasks, allTasks, taskRoleFilter],
  );

  const groupedTasks = useMemo(() => (
    statuses.reduce((accumulator, status) => {
      const tasksInStatus = roleFilteredTasks.filter((task) => {
        if (task.status !== status.v) return false;
        if (status.v === 'done' && task.hideInKanbanDone) return false;
        if (status.v === 'done') {
          const completedAt = typeof task.completedAt === 'string' ? task.completedAt : task.completed_at;
          if (!isCompletedAtWithinKanbanRange(completedAt, doneRange)) return false;
          if (!shouldShowTaskInKanbanDoneColumn(task, allTasks)) return false;
        }
        return true;
      });
      accumulator[status.v] = sortKanbanTasksByRecency(tasksInStatus, status.v);
      return accumulator;
    }, {})
  ), [roleFilteredTasks, allTasks, doneRange, statuses]);

  const handleDropOnColumn = (status, targetIndex = null) => {
    if (!draggedTaskId) return;
    const movedTaskId = draggedTaskId;
    const isCrossColumn = dragSourceStatus && dragSourceStatus !== status;
    onMoveTaskStatus?.(draggedTaskId, status, targetIndex);
    if (isCrossColumn) triggerLandingAnimation(movedTaskId);
    resetDragState();
  };

  const toggleColumnTasks = (status) => {
    setExpandedStatuses((previous) => {
      const next = new Set(previous);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  return (
    <section className="kanban-view">
      <div className="kanban-toolbar">
        <label className="kanban-done-range">
          <span className="kanban-done-range-label">Tareas</span>
          <select
            className="kanban-done-range-select"
            value={taskRoleFilter}
            aria-label="Filtrar tareas por rol en el Kanban"
            onChange={(event) => {
              const next = event.target.value;
              if (TASK_ROLE_ALLOWED.has(next)) setTaskRoleFilter(next);
            }}
          >
            {KANBAN_TASK_ROLE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="kanban-done-range">
          <span className="kanban-done-range-label">Completadas</span>
          <select
            className="kanban-done-range-select"
            value={doneRange}
            aria-label="Rango de tiempo para tareas completadas en el Kanban"
            onChange={(event) => {
              const next = event.target.value;
              if (!DONE_RANGE_ALLOWED.has(next)) return;
              setDoneRange(next);
              try {
                localStorage.setItem(kanbanDoneRangeStorageKey, next);
              } catch {
                // ignore
              }
            }}
          >
            {KANBAN_DONE_RANGE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>

        {onDailyStatus && (
          <button
            type="button"
            className="ghost-button"
            onClick={onDailyStatus}
            disabled={dailyStatusLoading}
          >
            {dailyStatusLoading ? 'Generando...' : 'Daily Status'}
          </button>
        )}

        <div className="actions-menu-wrap" ref={columnsMenuRef}>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setShowColumnsMenu((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={showColumnsMenu}
          >
            Columnas
          </button>
          {showColumnsMenu && (
            <div className="header-actions-menu kanban-columns-menu" role="menu">
              {statuses.map((status) => {
                const checked = visibleStatuses.includes(status.v);
                const onlyOne = checked && visibleStatuses.length <= 1;
                return (
                  <label key={status.v} className="kanban-column-toggle">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={onlyOne}
                      onChange={() => toggleColumnVisibility(status.v)}
                    />
                    <span>{status.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="kanban-grid">
        {visibleColumns.map((status) => {
          const columnTasks = groupedTasks[status.v] || [];
          const isExpanded = expandedStatuses.has(status.v);
          const visibleTasks = getVisibleKanbanTasks(columnTasks, isExpanded);
          const hiddenTaskCount = getHiddenKanbanTaskCount(columnTasks, isExpanded);
          const isActiveDrop = hoverStatus === status.v;
          const isSuctionDrop = Boolean(
            draggedTaskId &&
            dragSourceStatus &&
            isActiveDrop &&
            dragSourceStatus !== status.v,
          );
          const isColumnDragTarget = hoverColumnStatus === status.v && draggedColumnStatus;

          return (
            <div
              key={status.v}
              className={[
                'kanban-column',
                'material-base',
                isActiveDrop ? 'active-drop' : '',
                isSuctionDrop ? 'suction-drop' : '',
                isColumnDragTarget ? 'column-drag-target' : '',
              ].filter(Boolean).join(' ')}
              onDragOver={(event) => {
                if (draggedTaskId) {
                  event.preventDefault();
                  if (hoverStatus !== status.v) setHoverStatus(status.v);
                  const columnCount = columnTasks.length;
                  if (hoverIndex === null || hoverIndex > columnCount) setHoverIndex(columnCount);
                } else if (draggedColumnStatus && draggedColumnStatus !== status.v) {
                  event.preventDefault();
                  if (hoverColumnStatus !== status.v) setHoverColumnStatus(status.v);
                }
              }}
              onDragLeave={() => {
                if (hoverStatus === status.v) {
                  setHoverStatus(null);
                  setHoverIndex(null);
                  setHoverTaskId(null);
                  setHoverDragMode(null);
                }
                if (hoverColumnStatus === status.v) {
                  setHoverColumnStatus(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedTaskId) {
                  handleDropOnColumn(status.v, columnTasks.length);
                } else if (draggedColumnStatus && draggedColumnStatus !== status.v) {
                  const fromIndex = visibleStatuses.indexOf(draggedColumnStatus);
                  const toIndex = visibleStatuses.indexOf(status.v);
                  if (fromIndex !== -1 && toIndex !== -1) {
                    const next = [...visibleStatuses];
                    next.splice(fromIndex, 1);
                    next.splice(toIndex, 0, draggedColumnStatus);
                    setVisibleStatuses(next);
                    try {
                      localStorage.setItem(kanbanColumnsStorageKey, JSON.stringify(next));
                    } catch {
                      // ignore
                    }
                  }
                  setDraggedColumnStatus(null);
                  setHoverColumnStatus(null);
                }
              }}
            >
              <div
                className="kanban-column-header"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  setDraggedColumnStatus(status.v);
                }}
                onDragEnd={() => {
                  setDraggedColumnStatus(null);
                  setHoverColumnStatus(null);
                }}
                onDragOver={(event) => {
                  if (draggedColumnStatus && draggedColumnStatus !== status.v) {
                    event.preventDefault();
                    if (hoverColumnStatus !== status.v) {
                      setHoverColumnStatus(status.v);
                    }
                  }
                }}
                onDrop={(event) => {
                  if (draggedColumnStatus && draggedColumnStatus !== status.v) {
                    event.preventDefault();
                    const fromIndex = visibleStatuses.indexOf(draggedColumnStatus);
                    const toIndex = visibleStatuses.indexOf(status.v);
                    if (fromIndex !== -1 && toIndex !== -1) {
                      const next = [...visibleStatuses];
                      next.splice(fromIndex, 1);
                      next.splice(toIndex, 0, draggedColumnStatus);
                      setVisibleStatuses(next);
                      try {
                        localStorage.setItem(kanbanColumnsStorageKey, JSON.stringify(next));
                      } catch {
                        // ignore
                      }
                    }
                    setDraggedColumnStatus(null);
                    setHoverColumnStatus(null);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{status.label}</span>
                  <strong className="kanban-badge">{columnTasks.length}</strong>
                </div>

                {onOpenCreateTask && (
                  <button
                    type="button"
                    className="kanban-column-add-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCreateTask({ status: status.v });
                    }}
                    aria-label={`Añadir tarea en ${status.label}`}
                    title={`Añadir tarea en ${status.label}`}
                  >
                    +
                  </button>
                )}
              </div>

              <div className={`kanban-column-body${isSuctionDrop ? ' suction-pull' : ''}`}>
                {visibleTasks.map((task, index) => (
                  <div key={task.id}>
                    {hoverStatus === status.v && hoverIndex === index && (
                      <div className={`kanban-drop-indicator${isSuctionDrop ? ' suction-slot' : ''}`} />
                    )}
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (hoverStatus !== status.v) setHoverStatus(status.v);
                        if (hoverIndex !== index) setHoverIndex(index);
                        setHoverTaskId(task.id);
                        setHoverDragMode(canLinkAsChild(draggedTaskId, task.id) ? 'link' : 'move');
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const linkedAsChild = onDropTaskOnTask?.(draggedTaskId, task.id);
                        if (linkedAsChild) {
                          resetDragState();
                          return;
                        }
                        handleDropOnColumn(status.v, index);
                      }}
                    >
                      <KanbanTaskCard
                        task={task}
                        allTasks={allTasks}
                        onEditTask={onEditTask}
                        onOpenTaskPreview={onOpenTaskPreview}
                        onOpenPriorityPicker={onOpenPriorityPicker}
                        onDragStart={(event, taskId) => {
                          event.dataTransfer.effectAllowed = 'move';
                          const sourceTask = allTasks.find((item) => item.id === taskId);
                          setDraggedTaskId(taskId);
                          setDragSourceStatus(sourceTask?.status ?? null);
                        }}
                        onDragEnd={resetDragState}
                        isDragOver={hoverTaskId === task.id}
                        dragMode={hoverDragMode}
                        isChild={isChildTask(allTasks, task.id)}
                        isDragging={draggedTaskId === task.id}
                        isLanding={landingTaskId === task.id}
                      />
                    </div>
                  </div>
                ))}
                {hoverStatus === status.v && hoverIndex === columnTasks.length && (
                  <div className={`kanban-drop-indicator${isSuctionDrop ? ' suction-slot' : ''}`} />
                )}
                {hiddenTaskCount > 0 && (
                  <button
                    type="button"
                    className="kanban-column-toggle-tasks"
                    onClick={() => toggleColumnTasks(status.v)}
                    aria-expanded={false}
                  >
                    Mostrar todo ({hiddenTaskCount} más)
                  </button>
                )}
                {isExpanded && columnTasks.length > 5 && (
                  <button
                    type="button"
                    className="kanban-column-toggle-tasks"
                    onClick={() => toggleColumnTasks(status.v)}
                    aria-expanded
                  >
                    Colapsar
                  </button>
                )}
                {columnTasks.length === 0 && (
                  <div className="kanban-empty">Arrastra tareas aquí</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
