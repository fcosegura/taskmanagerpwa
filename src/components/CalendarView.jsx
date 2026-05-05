import { MONTHS, DAYS } from '../constants.js';
import { toDateStr, fmtDate } from '../utils.jsx';
import { NBtn } from './shared/index.jsx';
import TaskRow from './TaskRow.jsx';

export default function CalendarView({ y, mo, dIM, fD, tByDate, eByDate, todayStr, prev, next, selDay, setSelDay, onAddTaskForDay, onEditTask, onAddEventForDay, onEditEvent }) {
  const cells = [...Array(fD).fill(null), ...Array.from({ length: dIM }, (_, i) => i + 1)];
  const selDs = selDay ? toDateStr(y, mo, selDay) : null;

  return (
    <div className="calendar-view" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="calendar-panel" style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Calendario</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{MONTHS[mo]} {y}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onAddEventForDay(toDateStr(y, mo, new Date().getDate()))}
              style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', borderRadius: '999px', whiteSpace: 'nowrap' }}
            >+ Evento</button>
            <div style={{ display: 'flex', gap: 6 }}>
              <NBtn onClick={prev}>{'‹'}</NBtn>
              <NBtn onClick={next}>{'›'}</NBtn>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px 8px', marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 600 }}>
          {DAYS.map((day) => <div key={day} style={{ textAlign: 'center' }}>{day.slice(0, 3)}</div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
          {cells.map((day, index) => {
            const dateStr = day ? toDateStr(y, mo, day) : null;
            const eventsForDay = dateStr ? eByDate[dateStr] || [] : [];
            const tasksForDay = dateStr ? tByDate[dateStr] || [] : [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selDs;

            return (
              <div
                key={index}
                className={`calendar-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                style={{
                  position: 'relative', minHeight: 65, padding: '8px 4px',
                  borderRadius: 12,
                  background: isSelected ? '#eef6ff' : isToday ? '#ecfdf5' : '#ffffff',
                  border: `1px solid ${isSelected ? '#93c5fd' : isToday ? '#4ade80' : 'rgba(148,163,184,0.12)'}`,
                  color: day ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  cursor: day ? 'pointer' : 'default',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                }}
                onClick={() => day && setSelDay(day)}
                onDoubleClick={() => day && onAddTaskForDay(dateStr)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: day ? (isToday ? 'var(--color-text-success)' : 'var(--color-text-primary)') : 'var(--color-text-secondary)', width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 999, background: isToday ? '#d1fae5' : undefined }}>
                      {day || ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                    {eventsForDay.slice(0, 3).map((event) => (
                      <div key={event.id} style={{ width: 6, height: 6, borderRadius: '50%', background: event.color }} />
                    ))}
                    {tasksForDay.slice(0, 3 - eventsForDay.length).map((task) => (
                      <div key={task.id} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', opacity: task.status === 'done' ? 0.4 : 1 }} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="day-panel" style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 3 }}>Día seleccionado</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {selDs ? `${DAYS[new Date(selDs).getDay()]}, ${fmtDate(selDs)}` : 'Selecciona un día'}
            </div>
          </div>
          {selDs && (
            <button type="button" onClick={() => setSelDay(null)} style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              Cerrar
            </button>
          )}
        </div>

        {selDs ? (
          ((tByDate[selDs] || []).length + (eByDate[selDs] || []).length) > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(eByDate[selDs] || []).map((event) => (
                <div key={event.id} onClick={() => onEditEvent(event)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--border-radius-lg)', background: event.color, color: 'white' }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{event.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginLeft: 'auto' }}>
                    {fmtDate(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` - ${fmtDate(event.endDate)}` : ''}
                  </div>
                </div>
              ))}
              {(tByDate[selDs] || []).map((task) => <TaskRow key={task.id} task={task} onClick={() => onEditTask(task)} />)}
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>No hay tareas ni eventos para este día.</div>
          )
        ) : (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Haz clic en un día para ver o añadir tareas.</div>
        )}
      </div>
    </div>
  );
}
