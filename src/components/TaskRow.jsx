import { useState } from 'react';
import { STATUS, PRIORITY } from '../constants.js';
import { fmtDate, linkifyText } from '../utils.jsx';
import { Pill, CategoryPill } from './shared/index.jsx';
import CopyTicketButton from './CopyTicketButton.jsx';

export default function TaskRow({
  task,
  allTasks = [],
  onClick,
  onEditClick,
  onToggleDone,
  onOpenPriorityPicker,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragOver = false,
  dragMode = null,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  childTaskCount = 0,
  statuses = STATUS,
}) {
  const [showInlineSubtasks, setShowInlineSubtasks] = useState(false);

  const s = statuses.find((x) => x.v === task.status) || statuses[0];
  const p = PRIORITY.find((x) => x.v === task.priority) || PRIORITY[1];

  const openPriority = (e) => {
    e.stopPropagation();
    onOpenPriorityPicker?.(task);
  };

  const openEdit = (e) => {
    e.stopPropagation();
    onEditClick?.(task);
  };

  const childTasks = allTasks.filter((candidate) => (task.dependencyTaskIds || []).includes(candidate.id));
  const parentTasks = allTasks.filter((candidate) => (candidate.dependencyTaskIds || []).includes(task.id));
  const hasParentTask = parentTasks.length > 0;
  const hasChildTasks = childTasks.length > 0;
  const showCollapseControl = collapsible && childTaskCount > 0;

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((st) => st.completed).length;
  const totalSubtasks = subtasks.length;

  const dependencyRailColor = hasChildTasks && hasParentTask
    ? 'linear-gradient(180deg, #f59e0b 0%, #f59e0b 50%, #9333ea 50%, #9333ea 100%)'
    : hasChildTasks
      ? '#9333ea'
      : hasParentTask
      ? '#f59e0b'
      : 'transparent';

  return (
    <div
      className={`task-card material-elevated${isDragOver ? ' drag-over' : ''}`}
      onClick={onClick}
      style={{
        borderRadius: 'var(--border-radius-lg)',
        padding: '16px 18px',
        marginLeft: hasParentTask ? 20 : 0,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: task.status === 'done' ? 0.75 : 1,
        transition: 'all 0.2s ease',
        border: isDragOver ? (dragMode === 'link' ? '1px dashed var(--color-accent)' : '1px dashed var(--color-border-secondary)') : undefined,
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
        {onOpenPriorityPicker ? (
          <button
            type="button"
            className="priority-rail"
            aria-label={`Cambiar prioridad, actualmente ${p.label}`}
            onClick={openPriority}
            style={{
              width: 4, minHeight: 36, borderRadius: 4, background: `var(${p.tv})`, flexShrink: 0,
              border: 'none', padding: 0, cursor: 'pointer',
            }}
          />
        ) : (
          <div className="priority-rail" style={{ width: 4, minHeight: 36, borderRadius: 4, background: `var(${p.tv})`, flexShrink: 0 }} />
        )}

        {(hasParentTask || hasChildTasks) && (
          <div
            className="dependency-rail"
            title={hasParentTask && hasChildTasks
              ? 'Esta tarea depende de otra y también tiene tareas hijas'
              : hasParentTask
                ? 'Esta tarea depende de otra tarea'
                : 'Esta tarea tiene tareas hijas'}
            style={{ width: 4, minHeight: 36, borderRadius: 4, background: dependencyRailColor, flexShrink: 0 }}
          />
        )}

        <div className="task-content" style={{ flex: 1, minWidth: 0 }}>
          <div
            title="Arrastra desde aquí para mover o crear dependencia"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--color-text-secondary)',
              fontSize: 11,
              fontWeight: 700,
              userSelect: 'none',
              marginBottom: 4
            }}
          >
            {showCollapseControl && (
              <button
                type="button"
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse?.();
                }}
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Mostrar tareas hijas' : 'Ocultar tareas hijas'}
                title={collapsed ? 'Mostrar tareas hijas' : 'Ocultar tareas hijas'}
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  padding: 0,
                  margin: 0,
                  marginRight: 2,
                  border: 'var(--material-base-border)',
                  borderRadius: 6,
                  background: 'var(--material-base-bg)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  lineHeight: 1,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            )}
            <span style={{ fontSize: 12, lineHeight: 1 }}>⋮⋮</span>
            <span>Arrastrar</span>
          </div>

          {isDragOver && dragMode === 'link' && (
            <div style={{ marginBottom: 6, fontSize: 10, fontWeight: 700, color: 'var(--color-accent)' }}>
              Soltar para crear dependencia
            </div>
          )}

          <div
            className="task-title"
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textDecoration: task.status === 'done' ? 'line-through' : 'none'
            }}
          >
            {linkifyText(task.name)}
          </div>

          {task.url && (
            <div className="task-date" style={{ fontSize: 12, color: 'var(--color-accent)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {linkifyText(task.url)}
            </div>
          )}
          {task.notes && (
            <div className="task-date" style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {linkifyText(task.notes)}
            </div>
          )}
          {task.date && (
            <div className="task-date" style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {fmtDate(task.date)}{task.time ? ` · ${task.time}` : ''}
            </div>
          )}

          {(childTasks.length > 0 || parentTasks.length > 0) && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {hasChildTasks && (
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  Depende de: {childTasks.map((ct) => ct.name).join(', ')}
                </div>
              )}
              {hasParentTask && (
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  Parte de: {parentTasks.map((pt) => pt.name).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="task-meta" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {totalSubtasks > 0 && (
            <button
              type="button"
              className="subtask-progress-pill"
              onClick={(e) => {
                e.stopPropagation();
                setShowInlineSubtasks((prev) => !prev);
              }}
              title="Ver sub-tareas"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 999,
                border: 'var(--material-base-border)',
                background: 'var(--material-base-bg)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >
              <span>{completedSubtasks}/{totalSubtasks} sub-tareas</span>
              <span style={{ fontSize: 9 }}>{showInlineSubtasks ? '▲' : '▼'}</span>
            </button>
          )}

          {onEditClick ? (
            <button
              type="button"
              onClick={openEdit}
              aria-label="Editar tarea"
              title="Editar tarea"
              style={{
                width: 28, height: 28, borderRadius: 999, border: 'var(--material-base-border)',
                background: 'var(--material-base-bg)', color: 'var(--color-text-secondary)',
                cursor: 'pointer', padding: 0,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          ) : null}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleDone?.(task.id); }}
            aria-label={task.status === 'done' ? 'Marcar como no completada' : 'Marcar como completada'}
            style={{
              width: 28, height: 28, borderRadius: 999, border: 'var(--material-base-border)',
              background: task.status === 'done' ? 'var(--color-background-success)' : 'var(--material-base-bg)',
              color: task.status === 'done' ? 'var(--color-text-success)' : 'var(--color-text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 700,
              display: 'grid', placeItems: 'center',
            }}
          >
            {task.status === 'done' ? '✓' : '○'}
          </button>

          {onOpenPriorityPicker ? (
            <button
              type="button"
              onClick={openPriority}
              aria-label={`Cambiar prioridad, actualmente ${p.label}`}
              style={{
                border: 'none', background: 'transparent', padding: 0, margin: 0, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center',
              }}
            >
              <Pill s={p} />
            </button>
          ) : (
            <Pill s={p} />
          )}

          <CopyTicketButton ticketNumber={task.ticketNumber} />
          {task.category && <CategoryPill name={task.category} />}
          <Pill s={s} fixedWidth={82} />
        </div>
      </div>

      {/* Inline Subtasks Expandable Panel */}
      {showInlineSubtasks && totalSubtasks > 0 && (
        <div
          className="inline-subtasks-panel"
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 6,
            paddingTop: 8,
            borderTop: 'var(--material-base-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          {subtasks.map((st) => (
            <div
              key={st.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: st.completed ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                textDecoration: st.completed ? 'line-through' : 'none'
              }}
            >
              <span style={{ fontSize: 10, color: st.completed ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
                {st.completed ? '✓' : '•'}
              </span>
              <span>{st.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
