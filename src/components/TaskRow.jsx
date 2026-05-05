import { STATUS, PRIORITY } from '../constants.js';
import { fmtDate, linkifyText } from '../utils.jsx';
import { Pill, CategoryPill } from './shared/index.jsx';

export default function TaskRow({ task, onClick, onToggleDone }) {
  const s = STATUS.find((x) => x.v === task.status) || STATUS[0];
  const p = PRIORITY.find((x) => x.v === task.priority) || PRIORITY[1];
  const subtaskCount = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((st) => st.done).length || 0;
  const progress = subtaskCount ? Math.round((completedSubtasks / subtaskCount) * 100) : 0;

  return (
    <div
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
      <div style={{ width: 4, minHeight: 34, borderRadius: 4, background: `var(${p.tv})`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
          {linkifyText(task.description)}
        </div>
        {task.date && (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {fmtDate(task.date)}{task.time ? ` · ${task.time}` : ''}
          </div>
        )}
        {subtaskCount > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                {completedSubtasks}/{subtaskCount} subtarea{subtaskCount !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: completedSubtasks === subtaskCount ? 'var(--color-text-success)' : 'var(--color-text-info)' }}>
                {progress}%
              </span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(148,163,184,0.18)' }}>
              <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: completedSubtasks === subtaskCount ? 'var(--color-text-success)' : 'var(--color-text-info)' }} />
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
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
