import { useMemo, useState } from 'react';
import { STATUS, PRIORITY } from '../constants.js';
import { fmtDate } from '../utils.jsx';

function KanbanTaskCard({
  task,
  allTasks,
  onEditTask,
  onDragStart,
  onDragEnd,
  isDragOver = false,
  dragMode = null,
}) {
  const priority = PRIORITY.find((item) => item.v === task.priority) || PRIORITY[1];
  const childTasks = allTasks.filter((candidate) => (task.dependencyTaskIds || []).includes(candidate.id));
  const parentTasks = allTasks.filter((candidate) => (candidate.dependencyTaskIds || []).includes(task.id));
  const hasParentTask = parentTasks.length > 0;
  const hasChildTasks = childTasks.length > 0;
  const dependencyRailColor = hasChildTasks && hasParentTask
    ? 'linear-gradient(180deg, #f59e0b 0%, #f59e0b 50%, #9333ea 50%, #9333ea 100%)'
    : hasChildTasks
      ? '#9333ea'
      : hasParentTask
      ? '#f59e0b'
      : 'transparent';
  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => onEditTask(task)}
      style={{
        border: '1px solid var(--color-border-tertiary)',
        borderColor: isDragOver && dragMode === 'link' ? '#2563eb' : 'var(--color-border-tertiary)',
        borderRadius: 12,
        background: isDragOver && dragMode === 'link' ? 'rgba(37,99,235,0.06)' : 'var(--color-background-primary)',
        padding: 12,
        cursor: 'grab',
        boxShadow: '0 8px 22px rgba(15,23,42,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'background 140ms ease, border-color 140ms ease, transform 140ms ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 10, gap: 10 }}>
        <div
          title="Arrastra desde aquí para mover o crear dependencia"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--color-text-secondary)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.01em',
            userSelect: 'none'
          }}
        >
          <span style={{ fontSize: 12, lineHeight: 1 }}>⋮⋮</span>
          <span>Arrastrar</span>
        </div>
        {hasChildTasks && (
          <span
            title="Tarea padre"
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#9333ea', display: 'inline-block' }}
          />
        )}
        {hasParentTask && (
          <span
            title="Tarea hija"
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}
          />
        )}
      </div>
      {(hasParentTask || hasChildTasks) && (
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 4, borderRadius: 999, background: `var(${priority.tv})` }} />
          <div style={{ width: 4, borderRadius: 999, background: dependencyRailColor }} />
        </div>
      )}
      {isDragOver && (
        <div style={{ fontSize: 10, fontWeight: 700, color: dragMode === 'link' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
          {dragMode === 'link' ? 'Soltar para crear dependencia' : 'Soltar para mover/reordenar'}
        </div>
      )}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word'
        }}
      >
        {task.name}
      </div>
      {task.date && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {task.date ? `${fmtDate(task.date)}${task.time ? ` · ${task.time}` : ''}` : 'Sin fecha'}
          </div>
        </div>
      )}
      {(childTasks.length > 0 || parentTasks.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {hasChildTasks && (
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
              Esta tarea depende de: {childTasks.map((childTask) => childTask.name).join(', ')}
            </div>
          )}
          {hasParentTask && (
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
              Esta tarea es parte de: {parentTasks.map((parentTask) => parentTask.name).join(', ')}
            </div>
          )}
        </div>
      )}
      <div
        style={{
          alignSelf: 'flex-start',
          borderRadius: 999,
          padding: '4px 8px',
          fontSize: 11,
          fontWeight: 700,
          color: `var(${priority.tv})`,
          background: `var(${priority.bv})`
        }}
      >
        {priority.label}
      </div>
    </div>
  );
}

export default function KanbanView({ tasks, allTasks = [], onEditTask, onMoveTaskStatus, onDropTaskOnTask }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [hoverStatus, setHoverStatus] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverTaskId, setHoverTaskId] = useState(null);
  const [hoverDragMode, setHoverDragMode] = useState(null);

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

  const groupedTasks = useMemo(() => (
    STATUS.reduce((accumulator, status) => {
      accumulator[status.v] = tasks.filter((task) => (
        task.status === status.v && !(status.v === 'done' && task.hideInKanbanDone)
      ));
      return accumulator;
    }, {})
  ), [tasks]);

  const handleDropOnColumn = (status, targetIndex = null) => {
    if (!draggedTaskId) return;
    onMoveTaskStatus?.(draggedTaskId, status, targetIndex);
    setDraggedTaskId(null);
    setHoverStatus(null);
    setHoverIndex(null);
    setHoverTaskId(null);
    setHoverDragMode(null);
  };

  return (
    <section className="kanban-view">
      <div className="kanban-grid">
        {STATUS.map((status) => (
          <div
            key={status.v}
            className={`kanban-column${hoverStatus === status.v ? ' active-drop' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (hoverStatus !== status.v) setHoverStatus(status.v);
              const columnCount = groupedTasks[status.v]?.length || 0;
              if (hoverIndex === null || hoverIndex > columnCount) setHoverIndex(columnCount);
            }}
            onDragLeave={() => {
              if (hoverStatus === status.v) {
                setHoverStatus(null);
                setHoverIndex(null);
                setHoverTaskId(null);
                setHoverDragMode(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDropOnColumn(status.v, groupedTasks[status.v]?.length || 0);
            }}
          >
            <div className="kanban-column-header">
              <span>{status.label}</span>
              <strong>{groupedTasks[status.v]?.length || 0}</strong>
            </div>
            <div className="kanban-column-body">
              {(groupedTasks[status.v] || []).map((task, index) => (
                <div key={task.id}>
                  {hoverStatus === status.v && hoverIndex === index && (
                    <div className="kanban-drop-indicator" />
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
                        setDraggedTaskId(null);
                        setHoverStatus(null);
                        setHoverIndex(null);
                        setHoverTaskId(null);
                        setHoverDragMode(null);
                        return;
                      }
                      handleDropOnColumn(status.v, index);
                    }}
                  >
                    <KanbanTaskCard
                      task={task}
                      allTasks={allTasks}
                      onEditTask={onEditTask}
                      onDragStart={(event, taskId) => {
                        event.dataTransfer.effectAllowed = 'move';
                        setDraggedTaskId(taskId);
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setHoverStatus(null);
                        setHoverIndex(null);
                        setHoverTaskId(null);
                        setHoverDragMode(null);
                      }}
                      isDragOver={hoverTaskId === task.id}
                      dragMode={hoverDragMode}
                    />
                  </div>
                </div>
              ))}
              {hoverStatus === status.v && hoverIndex === (groupedTasks[status.v] || []).length && (
                <div className="kanban-drop-indicator" />
              )}
              {(groupedTasks[status.v] || []).length === 0 && (
                <div className="kanban-empty">Arrastra tareas aquí</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
