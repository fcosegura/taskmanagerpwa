import { useState } from 'react';
import { STATUS, PRIORITY } from '../constants.js';
import { fmtDate, linkifyText } from '../utils.jsx';
import { Pill, CategoryPill } from './shared/index.jsx';

export default function TaskRow({ task, onClick, onToggleDone, onToggleSubtaskDone, onReorderSubtasks }) {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [hoverSubtaskIndex, setHoverSubtaskIndex] = useState(null);
  const s = STATUS.find((x) => x.v === task.status) || STATUS[0];
  const p = PRIORITY.find((x) => x.v === task.priority) || PRIORITY[1];
  const subtaskCount = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((st) => st.done).length || 0;
  const progress = subtaskCount ? Math.round((completedSubtasks / subtaskCount) * 100) : 0;

  return (
    <div
      className="task-card"
      onClick={onClick}
      style={{
        background: 'var(--color-background-primary)',
        border: 'none',
        borderRadius: 'var(--border-radius-lg)',
        padding: '18px 18px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
        opacity: task.status === 'done' ? 0.8 : 1,
        transform: 'translateZ(0)',
        boxShadow: 'var(--shadow-card)',
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div className="priority-rail" style={{ width: 4, minHeight: 34, borderRadius: 4, background: `var(${p.tv})`, flexShrink: 0 }} />
      <div className="task-content" style={{ flex: 1, minWidth: 0 }}>
        <div className="task-title" style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
          {linkifyText(task.description)}
        </div>
        {task.date && (
          <div className="task-date" style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {fmtDate(task.date)}{task.time ? ` · ${task.time}` : ''}
          </div>
        )}
        {subtaskCount > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSubtasks((prev) => !prev);
                }}
                aria-label={showSubtasks ? 'Colapsar subtareas' : 'Expandir subtareas'}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  fontSize: 11,
                  fontWeight: 600
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    transition: 'transform 140ms ease',
                    transform: showSubtasks ? 'rotate(90deg)' : 'rotate(0deg)',
                    fontSize: 18,
                    lineHeight: 1
                  }}
                >
                  ▸
                </span>
                <span>{completedSubtasks}/{subtaskCount} subtarea{subtaskCount !== 1 ? 's' : ''}</span>
              </button>
              <span style={{ fontSize: 11, fontWeight: 700, color: completedSubtasks === subtaskCount ? 'var(--color-text-success)' : 'var(--color-text-info)' }}>
                {progress}%
              </span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(148,163,184,0.18)' }}>
              <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: completedSubtasks === subtaskCount ? 'var(--color-text-success)' : 'var(--color-text-info)' }} />
            </div>
            {showSubtasks && (
              <div
                style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (hoverSubtaskIndex === null || hoverSubtaskIndex > (task.subtasks?.length || 0)) {
                    setHoverSubtaskIndex(task.subtasks?.length || 0);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragIndex === null) return;
                  const endIndex = task.subtasks?.length || 0;
                  onReorderSubtasks?.(task.id, dragIndex, endIndex);
                  setDragIndex(null);
                  setHoverSubtaskIndex(null);
                }}
                onDragLeave={() => setHoverSubtaskIndex(null)}
              >
                {task.subtasks.map((subtask, index) => (
                  <div key={subtask.id}>
                    {hoverSubtaskIndex === index && (
                      <div className="subtask-drop-indicator" style={{ marginBottom: 6 }} />
                    )}
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDragIndex(index);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (hoverSubtaskIndex !== index) setHoverSubtaskIndex(index);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragIndex === null || dragIndex === index) return;
                        onReorderSubtasks?.(task.id, dragIndex, index);
                        setDragIndex(null);
                        setHoverSubtaskIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setHoverSubtaskIndex(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        color: subtask.done ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: dragIndex === index ? 'rgba(23, 107, 135, 0.08)' : 'transparent'
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSubtaskDone?.(task.id, subtask.id);
                        }}
                        aria-label={subtask.done ? 'Marcar subtarea como pendiente' : 'Marcar subtarea como completada'}
                        style={{
                          border: '1px solid var(--color-border-tertiary)',
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          display: 'grid',
                          placeItems: 'center',
                          background: subtask.done ? 'var(--color-background-success)' : 'var(--color-background-primary)',
                          color: subtask.done ? 'var(--color-text-success)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {subtask.done ? '✓' : ''}
                      </button>
                      <span style={{ textDecoration: subtask.done ? 'line-through' : 'none' }}>{subtask.text}</span>
                      <span
                        title="Arrastra para reordenar"
                        style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)', cursor: 'grab', fontSize: 13 }}
                      >
                        ⋮⋮
                      </span>
                    </div>
                  </div>
                ))}
                {hoverSubtaskIndex === (task.subtasks?.length || 0) && (
                  <div className="subtask-drop-indicator" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="task-meta" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleDone?.(task.id); }}
          aria-label={task.status === 'done' ? 'Marcar como no completada' : 'Marcar como completada'}
          style={{
            width: 28, height: 28, borderRadius: 999, border: '1px solid var(--color-border-tertiary)',
            background: task.status === 'done' ? 'var(--color-background-success)' : 'var(--color-background-primary)',
            color: task.status === 'done' ? 'var(--color-text-success)' : 'var(--color-text-secondary)',
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'grid', placeItems: 'center',
          }}
        >
          {task.status === 'done' ? '✓' : '○'}
        </button>
        <Pill s={p} />
        {task.category && <CategoryPill name={task.category} />}
        <Pill s={s} />
      </div>
    </div>
  );
}
