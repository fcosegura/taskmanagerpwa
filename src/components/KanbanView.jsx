import { useMemo, useState } from 'react';
import { STATUS, PRIORITY } from '../constants.js';
import { fmtDate } from '../utils.jsx';

function KanbanTaskCard({ task, onEditTask, onDragStart, onDragEnd }) {
  const priority = PRIORITY.find((item) => item.v === task.priority) || PRIORITY[1];
  const doneSubtasks = (task.subtasks || []).filter((subtask) => subtask.done).length;
  const totalSubtasks = (task.subtasks || []).length;
  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => onEditTask(task)}
      style={{
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: 12,
        background: 'var(--color-background-primary)',
        padding: 12,
        cursor: 'grab',
        boxShadow: '0 8px 22px rgba(15,23,42,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{task.description}</div>
      {(task.date || totalSubtasks > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {task.date ? `${fmtDate(task.date)}${task.time ? ` · ${task.time}` : ''}` : 'Sin fecha'}
          </div>
          {totalSubtasks > 0 && (
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {doneSubtasks}/{totalSubtasks} subtareas
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

export default function KanbanView({ tasks, onEditTask, onMoveTaskStatus }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [hoverStatus, setHoverStatus] = useState(null);

  const groupedTasks = useMemo(() => (
    STATUS.reduce((accumulator, status) => {
      accumulator[status.v] = tasks.filter((task) => task.status === status.v);
      return accumulator;
    }, {})
  ), [tasks]);

  const handleDropOnColumn = (status, targetIndex = null) => {
    if (!draggedTaskId) return;
    onMoveTaskStatus?.(draggedTaskId, status, targetIndex);
    setDraggedTaskId(null);
    setHoverStatus(null);
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
            }}
            onDragLeave={() => {
              if (hoverStatus === status.v) setHoverStatus(null);
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
                <div
                  key={task.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (hoverStatus !== status.v) setHoverStatus(status.v);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDropOnColumn(status.v, index);
                  }}
                >
                  <KanbanTaskCard
                    task={task}
                    onEditTask={onEditTask}
                    onDragStart={(event, taskId) => {
                      event.dataTransfer.effectAllowed = 'move';
                      setDraggedTaskId(taskId);
                    }}
                    onDragEnd={() => {
                      setDraggedTaskId(null);
                      setHoverStatus(null);
                    }}
                  />
                </div>
              ))}
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
