import { useEffect, useMemo, useState } from 'react';
import { PRIORITY } from '../constants.js';
import { fmtDate, toDateStr } from '../utils.jsx';
import { addDays, indexEventsByDate } from '../calendarEvents.js';
import { normalizePlannedSlots } from '../plannedSlots.js';
import AgendaPlanModal from './AgendaPlanModal.jsx';

const SLOT_MIN = 30;
const START_H = 6;
const END_H = 22;
const ROW_PX = 28;

function startOfIsoWeekMon(date) {
  const x = new Date(date);
  x.setHours(12, 0, 0, 0);
  const dow = x.getDay();
  const fromMonday = (dow + 6) % 7;
  x.setDate(x.getDate() - fromMonday);
  x.setHours(0, 0, 0, 0);
  return x;
}

function compareAgendaEvents(a, b) {
  const aTimed = (a.allDay === false || a.allDay === 0) && a.startTime;
  const bTimed = (b.allDay === false || b.allDay === 0) && b.startTime;
  if (aTimed && bTimed) return a.startTime.localeCompare(b.startTime);
  if (aTimed && !bTimed) return -1;
  if (!aTimed && bTimed) return 1;
  return (a.title || '').localeCompare(b.title || '');
}

function timeToMin(t) {
  if (typeof t !== 'string' || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function clipBlockToGrid(startTime, endTime) {
  const startM = timeToMin(startTime);
  const endM = timeToMin(endTime);
  const gridStart = START_H * 60;
  const gridEnd = END_H * 60;
  if (endM <= gridStart || startM >= gridEnd) return null;
  const s = Math.max(startM, gridStart);
  const e = Math.min(endM, gridEnd);
  if (e <= s) return null;
  return { topMin: s - gridStart, heightMin: e - s };
}

export default function DailyAgendaView({
  tasks,
  events,
  todayStr,
  onSaveTaskSlots,
  onEditEvent,
  onOpenTaskModal,
}) {
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [mode, setMode] = useState('day');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [planModal, setPlanModal] = useState(null);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const dayDates = useMemo(() => {
    if (mode === 'day') {
      const d = new Date(anchorDate);
      d.setHours(12, 0, 0, 0);
      return [new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)];
    }
    const monday = startOfIsoWeekMon(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [anchorDate, mode]);

  const dateStrings = useMemo(() => dayDates.map((d) => toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
  ), [dayDates]);

  const eByDate = useMemo(() => {
    if (dateStrings.length === 0) return {};
    const first = dateStrings[0];
    const last = dateStrings[dateStrings.length - 1];
    const w0 = new Date(`${first}T00:00:00`);
    const w1 = new Date(`${last}T23:59:59`);
    const marginStart = addDays(w0, -35);
    const marginEnd = addDays(w1, 35);
    return indexEventsByDate(events || [], marginStart, marginEnd);
  }, [events, dateStrings]);

  const totalRows = ((END_H - START_H) * 60) / SLOT_MIN;
  const gridHeight = totalRows * ROW_PX;

  const goPrev = () => {
    setAnchorDate((d) => {
      const x = new Date(d);
      if (mode === 'day') x.setDate(x.getDate() - 1);
      else x.setDate(x.getDate() - 7);
      return x;
    });
  };

  const goNext = () => {
    setAnchorDate((d) => {
      const x = new Date(d);
      if (mode === 'day') x.setDate(x.getDate() + 1);
      else x.setDate(x.getDate() + 7);
      return x;
    });
  };

  const goToday = () => {
    setAnchorDate(new Date());
  };

  const openAdd = (dateStr) => {
    setPlanModal({ type: 'add', initialDateStr: dateStr || dateStrings[0] || todayStr });
  };

  const headerLabel = mode === 'day'
    ? `${fmtDate(dateStrings[0] || todayStr)}`
    : (() => {
      const a = dateStrings[0];
      const b = dateStrings[6];
      if (!a || !b) return '';
      return `${fmtDate(a)} – ${fmtDate(b)}`;
    })();

  const timeLabels = [];
  for (let h = START_H; h < END_H; h += 1) {
    timeLabels.push(
      <div
        key={h}
        style={{
          height: ROW_PX * 2,
          flexShrink: 0,
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          paddingRight: 6,
          textAlign: 'right',
          borderTop: '1px solid var(--color-border-tertiary)',
          paddingTop: 2,
        }}
      >
        {String(h).padStart(2, '0')}:00
      </div>,
    );
  }

  return (
    <div className="daily-agenda-view">
      <div className="daily-agenda-toolbar">
        <div>
          <div className="daily-agenda-eyebrow">Agenda diaria</div>
          <div className="daily-agenda-title">{headerLabel}</div>
        </div>
        <div className="daily-agenda-toolbar-actions">
          <div className="daily-agenda-seg">
            <button type="button" className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')}>Día</button>
            <button type="button" className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>Semana</button>
          </div>
          <button type="button" className="ghost-button" onClick={goPrev} aria-label="Anterior">‹</button>
          <button type="button" className="ghost-button" onClick={goToday}>Hoy</button>
          <button type="button" className="ghost-button" onClick={goNext} aria-label="Siguiente">›</button>
          <button type="button" className="primary-button daily-agenda-add" onClick={() => openAdd(dateStrings[0])}>
            + Añadir tarea
          </button>
        </div>
      </div>

      <div className="daily-agenda-scroll">
        <div
          className="daily-agenda-grid"
          style={{
            gridTemplateColumns: mode === 'day' ? `52px 1fr` : `52px repeat(${dateStrings.length}, minmax(80px, 1fr))`,
          }}
        >
          <div className="daily-agenda-corner" />
          {dateStrings.map((ds) => {
            const d = new Date(`${ds}T12:00:00`);
            const dow = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
            const isToday = ds === todayStr;
            return (
              <div key={ds} className={`daily-agenda-col-head${isToday ? ' today' : ''}`}>
                <span className="dow">{dow}</span>
                <span className="dm">{fmtDate(ds)}</span>
              </div>
            );
          })}

          <div className="daily-agenda-allday-spacer" aria-hidden="true" />

          {dateStrings.map((ds) => {
            const dayEvents = (eByDate[ds] || []).slice().sort(compareAgendaEvents);
            const allDay = dayEvents.filter((ev) => !(ev.allDay === false || ev.allDay === 0));
            return (
              <div key={`allday-${ds}`} className="daily-agenda-allday-cell" style={{ minHeight: 36 }}>
                <div className="daily-agenda-allday-inner">
                  {allDay.map((ev) => (
                    <button
                      key={`${ev.id}-${ev.occurrenceDate || ds}`}
                      type="button"
                      className="daily-agenda-allday-pill"
                      style={{ background: ev.color || '#2563eb' }}
                      title={ev.title}
                      onClick={() => onEditEvent?.(ev)}
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="daily-agenda-time-gutter" style={{ height: gridHeight }}>
            {timeLabels}
          </div>

          {dateStrings.map((ds) => {
            const dayEvents = (eByDate[ds] || []).slice().sort(compareAgendaEvents);
            const timed = dayEvents.filter((ev) => ev.allDay === false || ev.allDay === 0);

            const taskBlocks = [];
            (tasks || []).forEach((task) => {
              const slots = normalizePlannedSlots(task.plannedSlots);
              slots.filter((s) => s.date === ds).forEach((slot) => {
                const clip = clipBlockToGrid(slot.startTime, slot.endTime);
                if (!clip) return;
                const pri = PRIORITY.find((p) => p.v === task.priority);
                taskBlocks.push({
                  kind: 'task',
                  task,
                  slot,
                  clip,
                  pri,
                });
              });
            });

            const now = new Date(nowTick);
            const isTodayCol = ds === todayStr;
            let nowTop = null;
            if (isTodayCol) {
              const mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
              const gridStart = START_H * 60;
              const gridEnd = END_H * 60;
              if (mins >= gridStart && mins <= gridEnd) {
                nowTop = ((mins - gridStart) / SLOT_MIN) * ROW_PX;
              }
            }

            return (
              <div key={ds} className="daily-agenda-slots" style={{ height: gridHeight }}>
                {Array.from({ length: totalRows }).map((_, i) => (
                  <div key={i} className="daily-agenda-slot-row" />
                ))}

                {timed.map((ev) => {
                  if (!ev.startTime || !ev.endTime) return null;
                  const clip = clipBlockToGrid(ev.startTime, ev.endTime);
                  if (!clip) return null;
                  const top = (clip.topMin / SLOT_MIN) * ROW_PX;
                  const h = (clip.heightMin / SLOT_MIN) * ROW_PX;
                  return (
                    <button
                      key={`${ev.id}-${ev.occurrenceDate || ds}-${ev.startTime}`}
                      type="button"
                      className="daily-agenda-block daily-agenda-block-event"
                      style={{
                        top,
                        height: Math.max(h, 20),
                        background: ev.color || '#2563eb',
                      }}
                      onClick={() => onEditEvent?.(ev)}
                      title={`${ev.title} (${ev.startTime}–${ev.endTime})`}
                    >
                      <span className="blk-title">{ev.title}</span>
                      <span className="blk-time">{ev.startTime} – {ev.endTime}</span>
                    </button>
                  );
                })}

                {taskBlocks.map(({ task, slot, clip, pri }) => {
                  const top = (clip.topMin / SLOT_MIN) * ROW_PX;
                  const h = (clip.heightMin / SLOT_MIN) * ROW_PX;
                  return (
                    <div
                      key={`${task.id}-${slot.id}`}
                      className="daily-agenda-block daily-agenda-block-task-wrap"
                      style={{
                        top,
                        height: Math.max(h, 22),
                        borderColor: `var(${pri?.bov || '--color-border-secondary'})`,
                        background: `var(${pri?.bv || '--color-background-secondary'})`,
                      }}
                      title={`${task.name} (${slot.startTime}–${slot.endTime})`}
                    >
                      <div className="daily-agenda-block-task-inner">
                        <button
                          type="button"
                          className="daily-agenda-block-task-main"
                          onClick={() => setPlanModal({ type: 'edit', task, slot })}
                        >
                          <span className="blk-title">{task.name}</span>
                          <span className="blk-time">{slot.startTime} – {slot.endTime}</span>
                        </button>
                        <button
                          type="button"
                          className="daily-agenda-task-ficha"
                          aria-label="Abrir ficha de tarea"
                          title="Ficha de tarea (opciones avanzadas ocultas)"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenTaskModal?.(task);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {nowTop != null && (
                  <div className="daily-agenda-now-line" style={{ top: nowTop }} aria-hidden="true">
                    <span className="daily-agenda-now-dot" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {planModal?.type === 'add' && (
        <AgendaPlanModal
          tasks={tasks}
          initialDateStr={planModal.initialDateStr}
          onClose={() => setPlanModal(null)}
          onSaveSlots={onSaveTaskSlots}
          editingTask={null}
          editingSlot={null}
        />
      )}
      {planModal?.type === 'edit' && (
        <AgendaPlanModal
          tasks={tasks}
          onClose={() => setPlanModal(null)}
          onSaveSlots={onSaveTaskSlots}
          editingTask={planModal.task}
          editingSlot={planModal.slot}
        />
      )}
    </div>
  );
}
