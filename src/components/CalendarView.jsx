import { MONTHS, DAYS } from '../constants.js';
import { toDateStr, fmtDate } from '../utils.jsx';
import { NBtn } from './shared/index.jsx';
import TaskRow from './TaskRow.jsx';

function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getSpainNationalHolidaySet(year) {
  const set = new Set([
    toDateStr(year, 0, 1),  // Año Nuevo
    toDateStr(year, 0, 6),  // Reyes
    toDateStr(year, 4, 1),  // Día del Trabajo
    toDateStr(year, 7, 15), // Asunción
    toDateStr(year, 9, 12), // Fiesta Nacional
    toDateStr(year, 10, 1), // Todos los Santos
    toDateStr(year, 11, 6), // Constitución
    toDateStr(year, 11, 8), // Inmaculada
    toDateStr(year, 11, 25), // Navidad
  ]);
  const easter = getEasterSunday(year);
  const goodFriday = addDays(easter, -2);
  set.add(toDateStr(goodFriday.getFullYear(), goodFriday.getMonth(), goodFriday.getDate()));
  return set;
}

function formatEventSchedule(event) {
  const timed = event.allDay === false || event.allDay === 0;
  if (timed && event.startTime && event.endTime) {
    return `${event.startTime} – ${event.endTime}`;
  }
  if (event.endDate && event.endDate !== event.startDate) {
    return `${fmtDate(event.startDate)} – ${fmtDate(event.endDate)} · Todo el día`;
  }
  return 'Todo el día';
}

function isRecurringEvent(event) {
  return ['daily', 'weekly', 'monthly'].includes(event?.recurrenceFrequency);
}

function compareCalendarEvents(a, b) {
  const aTimed = (a.allDay === false || a.allDay === 0) && a.startTime;
  const bTimed = (b.allDay === false || b.allDay === 0) && b.startTime;
  if (aTimed && bTimed) return a.startTime.localeCompare(b.startTime);
  if (aTimed && !bTimed) return -1;
  if (!aTimed && bTimed) return 1;
  return (a.title || '').localeCompare(b.title || '');
}

export default function CalendarView({
  y, mo, dIM, fD, tByDate, eByDate, todayStr, prev, next, selDay, setSelDay,
  onAddTaskForDay, onOpenTaskPreview, onOpenPriorityPicker, onAddEventForDay, onEditEvent,
}) {
  const cells = [...Array(fD).fill(null), ...Array.from({ length: dIM }, (_, i) => i + 1)];
  const selDs = selDay ? toDateStr(y, mo, selDay) : null;
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() === mo;
  const fallbackDay = isCurrentMonth ? today.getDate() : 1;
  const eventCreateDate = selDs || toDateStr(y, mo, fallbackDay);
  const holidaySet = getSpainNationalHolidaySet(y);

  return (
    <div className="calendar-view" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="calendar-panel material-base" style={{ borderRadius: 'var(--border-radius-xl)', padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
              Mes Actual
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 850 }}>
              {MONTHS[mo]} {y}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onAddEventForDay(eventCreateDate)}
              style={{ borderRadius: '999px', fontSize: 12, fontWeight: 700 }}
            >
              + Evento
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              <NBtn onClick={prev}>{'‹'}</NBtn>
              <NBtn onClick={next}>{'›'}</NBtn>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px 8px', marginBottom: 10, color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
          {DAYS.map((day, dayIndex) => {
            const isWeekendHeader = dayIndex === 0 || dayIndex === 6;
            return (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  color: isWeekendHeader ? 'var(--color-text-danger)' : 'var(--color-text-secondary)'
                }}
              >
                {day.slice(0, 3)}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
          {cells.map((day, index) => {
            const dateStr = day ? toDateStr(y, mo, day) : null;
            const dayOfWeek = day ? new Date(y, mo, day).getDay() : null;
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isNationalHoliday = dateStr ? holidaySet.has(dateStr) : false;
            const eventsForDay = dateStr ? eByDate[dateStr] || [] : [];
            const tasksForDay = dateStr ? tByDate[dateStr] || [] : [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selDs;
            const holidayLike = isWeekend || isNationalHoliday;
            const hasEndDateTask = tasksForDay.some((task) => task.calendarDateRole === 'end');
            const visibleTaskMarkers = [...tasksForDay].sort((a, b) => {
              if (a.calendarDateRole === 'end' && b.calendarDateRole !== 'end') return -1;
              if (b.calendarDateRole === 'end' && a.calendarDateRole !== 'end') return 1;
              return 0;
            });

            return (
              <div
                key={index}
                className={`calendar-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${hasEndDateTask ? ' has-end-date' : ''}`}
                style={{
                  position: 'relative',
                  minHeight: 70,
                  padding: '8px 6px',
                  borderRadius: 'var(--border-radius-md)',
                  background: isSelected
                    ? 'var(--material-elevated-bg)'
                    : isToday
                      ? 'rgba(23, 107, 135, 0.12)'
                      : holidayLike
                        ? 'var(--calendar-holiday-bg)'
                        : 'var(--material-base-bg)',
                  border: isSelected
                    ? '2px solid var(--color-accent)'
                    : isToday
                      ? '2px solid var(--color-accent)'
                      : 'var(--material-base-border)',
                  color: day ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  cursor: day ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => day && setSelDay(day)}
                onDoubleClick={() => day && onAddTaskForDay(dateStr)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isToday ? 850 : 600,
                        color: day ? (isToday ? 'var(--color-accent)' : holidayLike ? 'var(--color-text-danger)' : 'var(--color-text-primary)') : 'var(--color-text-secondary)',
                        width: 24,
                        height: 24,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 999,
                        background: isToday ? 'var(--material-elevated-bg)' : undefined
                      }}
                    >
                      {day || ''}
                    </span>
                  </div>
                  <div className="calendar-task-markers" style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {eventsForDay.slice(0, 3).map((event) => (
                      <div key={`${event.id}-${event.occurrenceDate || dateStr || 'event'}`} className="calendar-task-marker" style={{ width: 6, height: 6, borderRadius: '50%', background: event.color }} />
                    ))}
                    {visibleTaskMarkers.slice(0, 3 - eventsForDay.length).map((task) => {
                      const isEndMarker = task.calendarDateRole === 'end';
                      return (
                        <div
                          key={`${task.id}-${task.calendarDateRole || 'start'}`}
                          className={`calendar-task-marker${isEndMarker ? ' calendar-task-marker--end' : ' calendar-task-marker--start'}`}
                          title={isEndMarker ? 'Fecha fin' : 'Fecha inicio'}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: isEndMarker ? 'var(--color-text-danger)' : 'var(--color-accent)',
                            opacity: task.status === 'done' ? 0.45 : 1
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="day-panel material-elevated" style={{ borderRadius: 'var(--border-radius-xl)', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase' }}>
              Día seleccionado
            </div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 800 }}>
              {selDs ? `${DAYS[new Date(selDs).getDay()]}, ${fmtDate(selDs)}` : 'Selecciona un día en la cuadrícula'}
            </div>
          </div>
          {selDs && (
            <button type="button" className="ghost-button compact" onClick={() => setSelDay(null)}>
              Cerrar
            </button>
          )}
        </div>

        {selDs ? (
          ((tByDate[selDs] || []).length + (eByDate[selDs] || []).length) > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...(eByDate[selDs] || [])].sort(compareCalendarEvents).map((event) => (
                <div
                  key={`${event.id}-${event.occurrenceDate || selDs}`}
                  onClick={() => onEditEvent(event)}
                  className="material-base"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 'var(--border-radius-md)',
                    borderLeft: `4px solid ${event.color || 'var(--color-accent)'}`
                  }}
                >
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>{event.title}{isRecurringEvent(event) ? ' ↻' : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 'auto', textAlign: 'right', fontWeight: 600 }}>
                    {formatEventSchedule(event)}
                  </div>
                </div>
              ))}
              {(tByDate[selDs] || []).map((task) => (
                <div key={`${task.id}-${task.calendarDateRole || 'start'}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {task.calendarDateRole === 'end' && (
                    <span className="calendar-end-date-badge">Fecha fin</span>
                  )}
                  <TaskRow
                    task={task}
                    onClick={() => onOpenTaskPreview?.(task)}
                    onOpenPriorityPicker={onOpenPriorityPicker}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>No hay tareas ni eventos para este día.</div>
          )
        ) : (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Haz clic en un día para ver o añadir tareas.</div>
        )}
      </div>
    </div>
  );
}
