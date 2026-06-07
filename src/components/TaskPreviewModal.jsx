import { STATUS, PRIORITY } from '../constants.js';
import { fmtDate, linkifyText, isJiraCategory } from '../utils.jsx';
import { normalizeStatusLog } from '../statusLog.js';
import { Pill, CategoryPill } from './shared/index.jsx';

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function TaskPreviewModal({ task, allTasks = [], onClose, onEdit, onOpenNotebook }) {
  const s = STATUS.find((x) => x.v === task.status) || STATUS[0];
  const p = PRIORITY.find((x) => x.v === task.priority) || PRIORITY[1];
  const childTasks = allTasks.filter((candidate) => (task.dependencyTaskIds || []).includes(candidate.id));
  const parentTasks = allTasks.filter((candidate) => (candidate.dependencyTaskIds || []).includes(task.id));
  const hasChildTasks = childTasks.length > 0;
  const hasParentTask = parentTasks.length > 0;
  const category = task.category || '';
  const showTicket = isJiraCategory(category) && task.ticketNumber;
  const statusLog = normalizeStatusLog(task.statusLog).slice().reverse();

  const openEdit = () => onEdit?.(task);

  return (
    <div
      className="liquid-glass-modal"
      style={{
        width: 'min(420px, 100%)',
        maxWidth: 'calc(100% - 32px)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 24,
        color: 'var(--color-text-primary)',
        maxHeight: 'min(85vh, 640px)',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-preview-title"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Vista rápida
          </div>
          <h2 id="task-preview-title" style={{ fontSize: 18, fontWeight: 700, margin: '6px 0 0', wordBreak: 'break-word' }}>
            {linkifyText(task.name)}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={openEdit}
            aria-label="Editar tarea"
            title="Editar tarea"
            style={{
              border: '1px solid var(--color-border-tertiary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)',
              borderRadius: 'var(--border-radius-md)',
              padding: '8px 10px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              lineHeight: 0,
            }}
          >
            <PencilIcon />
          </button>
          <button type="button" onClick={onClose} aria-label="Cerrar vista rápida" style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Pill s={p} />
        <Pill s={s} fixedWidth={82} />
        {category ? <CategoryPill name={category} /> : null}
      </div>

      {showTicket && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontWeight: 600 }}>Ticket:</span>{' '}
            {task.ticketNumber}
          </div>
          {task.createNotebook && (
            <button
              type="button"
              onClick={() => onOpenNotebook?.(task.ticketNumber)}
              style={{
                background: 'rgba(37,99,235,0.1)',
                border: 'none',
                borderRadius: '4px',
                color: 'var(--color-accent)',
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Ver libreta ↗
            </button>
          )}
        </div>
      )}

      {task.date && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>Fecha:</span>{' '}
          {fmtDate(task.date)}{task.time ? ` · ${task.time}` : ''}
        </div>
      )}
      {task.endDate && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>Fin:</span>{' '}
          {fmtDate(task.endDate)}
        </div>
      )}

      {task.url && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Enlace</div>
          <a href={task.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--color-accent)', wordBreak: 'break-all' }}>
            {task.url}
          </a>
        </div>
      )}

      {hasChildTasks && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Tareas hijas ({childTasks.length})
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {childTasks.map((childTask) => {
              const childStatus = STATUS.find((x) => x.v === childTask.status) || STATUS[0];
              return (
                <li
                  key={childTask.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--color-border-tertiary)',
                    background: 'var(--color-background-secondary)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word', flex: 1 }}>
                    {childTask.name}
                  </span>
                  <Pill s={childStatus} fixedWidth={82} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasParentTask && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          <span style={{ fontWeight: 600 }}>Tarea padre:</span>{' '}
          {parentTasks.map((parentTask) => parentTask.name).join(', ')}
        </div>
      )}

      {statusLog.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Historial de estado
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
            {statusLog.map((entry) => {
              const fromLabel = STATUS.find((x) => x.v === entry.fromStatus)?.label;
              const toLabel = STATUS.find((x) => x.v === entry.toStatus)?.label || entry.toStatus;
              const when = entry.at ? new Date(entry.at).toLocaleString() : '';
              return (
                <li
                  key={entry.id}
                  style={{
                    border: '1px solid var(--color-border-tertiary)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{when}</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {fromLabel ? `${fromLabel} → ${toLabel}` : toLabel}
                  </div>
                  <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {entry.comment}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Comentarios</div>
        {task.notes && String(task.notes).trim() ? (
          <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--color-text-primary)' }}>
            {linkifyText(task.notes)}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Sin comentarios.</div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          onClick={openEdit}
          style={{
            width: '100%',
            borderRadius: 'var(--border-radius-md)',
            border: 'none',
            background: 'var(--color-background-info)',
            color: 'var(--color-text-info)',
            fontWeight: 700,
            padding: '12px 14px',
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <PencilIcon />
          Editar tarea
        </button>
      </div>
    </div>
  );
}
