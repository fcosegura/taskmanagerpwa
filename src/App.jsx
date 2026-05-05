import { useState, useEffect, useRef } from 'react';
import { STATUS, PRIORITY, P_ORDER } from './constants.js';
import { uid, toDateStr, parseDateTimeFromDescription, parseDescriptionDateResult, cleanDescriptionSegment } from './utils.jsx';
import { loadData, saveData, validateBackupPayload, isValidTask, isValidBoardNote, isValidEvent } from './storage.js';
import TasksView from './components/TasksView.jsx';
import CalendarView from './components/CalendarView.jsx';
import BoardView from './components/BoardView.jsx';
import TaskModal from './components/TaskModal.jsx';
import EventModal from './components/EventModal.jsx';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [boardNotes, setBoardNotes] = useState([]);
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('tasks');
  const [modal, setModal] = useState(null);
  const [eventModal, setEventModal] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [selDay, setSelDay] = useState(null);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData().then((data) => {
      setTasks(data.tasks);
      setBoardNotes(data.boardNotes);
      setEvents(data.events || []);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) saveData({ tasks, boardNotes, events });
  }, [tasks, boardNotes, events, ready]);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') { setModal(null); setEventModal(null); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleDone = (id) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, status: t.status === 'done' ? 'not_done' : 'done' } : t));
  };

  const downloadBackup = () => {
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `taskmanager-backup-${date}.json`;
    const payload = { tasks, boardNotes, events };
    if (!validateBackupPayload(payload)) {
      setBackupMessage('Error: los datos internos están corruptos y no se puede exportar el backup.');
      setTimeout(() => setBackupMessage(''), 5000);
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
    setBackupMessage(`Exportado ${fileName}`);
    setTimeout(() => setBackupMessage(''), 3500);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          if (!parsed.every(isValidTask)) throw new Error('El JSON contiene tareas con formato incorrecto.');
          setTasks(parsed); setBoardNotes([]);
        } else if (parsed && typeof parsed === 'object') {
          if (!Array.isArray(parsed.tasks) || !parsed.tasks.every(isValidTask)) throw new Error('El JSON no contiene una lista válida de tareas.');
          if (parsed.boardNotes !== undefined && (!Array.isArray(parsed.boardNotes) || !parsed.boardNotes.every(isValidBoardNote))) throw new Error('El JSON contiene notas con formato incorrecto.');
          if (parsed.events !== undefined && (!Array.isArray(parsed.events) || !parsed.events.every(isValidEvent))) throw new Error('El JSON contiene eventos con formato incorrecto.');
          setTasks(parsed.tasks);
          setBoardNotes(Array.isArray(parsed.boardNotes) ? parsed.boardNotes : []);
          setEvents(Array.isArray(parsed.events) ? parsed.events : []);
        } else {
          throw new Error('El archivo JSON no tiene la estructura esperada.');
        }
        setFilter('all'); setCategoryFilter('all'); setModal(null); setEventModal(null);
        setBackupMessage('Importación completada correctamente.');
      } catch (err) {
        setBackupMessage(`Error al importar: ${err.message}`);
      }
      e.target.value = '';
      setTimeout(() => setBackupMessage(''), 5000);
    };
    reader.readAsText(file);
  };

  const upsert = (task) => {
    setTasks((p) => task.id ? p.map((t) => t.id === task.id ? task : t) : [...p, { ...task, id: uid() }]);
    setModal(null);
  };
  const del = (id) => { setTasks((p) => p.filter((t) => t.id !== id)); setModal(null); };
  const open = (init = {}) => setModal({ description: '', status: 'not_done', priority: 'medium', date: '', time: '', subtasks: [], category: '', ...init });

  const addBoardNote = (note) => setBoardNotes((p) => [note, ...p]);
  const deleteBoardNote = (id) => setBoardNotes((p) => p.filter((note) => note.id !== id));
  const updateBoardNote = (id, changes) => setBoardNotes((p) => p.map((note) => note.id === id ? { ...note, ...changes } : note));

  const upsertEvent = (event) => {
    setEvents((p) => event.id ? p.map((e) => e.id === event.id ? event : e) : [...p, { ...event, id: uid() }]);
    setEventModal(null);
  };
  const deleteEvent = (id) => { setEvents((p) => p.filter((e) => e.id !== id)); setEventModal(null); };
  const openEventModal = (init = {}) => setEventModal({ title: '', startDate: '', endDate: '', color: '#2563eb', ...init });

  const handleQuickAdd = (description) => {
    if (!description.trim()) return;
    const parsed = parseDateTimeFromDescription(description);
    let cleaned = description;
    if (parsed) {
      const result = parseDescriptionDateResult(description);
      cleaned = cleanDescriptionSegment(description, result?.text || '');
      if (!result?.text || cleaned === description.trim()) {
        cleaned = cleaned.replace(/(?:\b(?:a|al|a la|a las|el|la|en|para)\b.*)$/i, '').replace(/\s{2,}/g, ' ').trim();
      }
    }
    upsert({ description: cleaned || description.trim(), date: parsed?.date || '', time: parsed?.time || '', status: 'not_done', priority: 'medium', subtasks: [], category: '' });
  };

  const y = calDate.getFullYear(), mo = calDate.getMonth();
  const dIM = new Date(y, mo + 1, 0).getDate();
  const fD = new Date(y, mo, 1).getDay();

  const tByDate = {};
  tasks.forEach((t) => { if (t.date) { (tByDate[t.date] = tByDate[t.date] || []).push(t); } });

  const eByDate = {};
  events.forEach((e) => {
    if (!e.startDate) return;
    let current = new Date(e.startDate + 'T12:00:00');
    const end = new Date((e.endDate || e.startDate) + 'T12:00:00');
    while (current <= end) {
      const dStr = toDateStr(current.getFullYear(), current.getMonth(), current.getDate());
      (eByDate[dStr] = eByDate[dStr] || []).push(e);
      current.setDate(current.getDate() + 1);
    }
  });

  const categories = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean))).sort();
  const now = new Date();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const baseByStatus = filter === 'all' ? activeTasks : tasks.filter((t) => t.status === filter);
  const byCategory = categoryFilter === 'all' ? baseByStatus : baseByStatus.filter((t) => t.category === categoryFilter);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const bySearch = normalizedSearch
    ? byCategory.filter((t) => t.description.toLowerCase().includes(normalizedSearch) || (t.category || '').toLowerCase().includes(normalizedSearch))
    : byCategory;
  const sorted = [...bySearch].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (b.status === 'done' && a.status !== 'done') return -1;
    if (a.status === 'blocked' && b.status !== 'blocked') return -1;
    if (b.status === 'blocked' && a.status !== 'blocked') return 1;
    return (P_ORDER[a.priority] ?? 3) - (P_ORDER[b.priority] ?? 3);
  });

  const statusBase = categoryFilter === 'all' ? tasks : tasks.filter((t) => t.category === categoryFilter);
  const statusCounts = statusBase.reduce((acc, t) => { const key = t.status || 'not_done'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
  const categoryBase = filter === 'all' ? activeTasks : tasks.filter((t) => t.status === filter);
  const categoryCounts = categoryBase.reduce((acc, t) => { if (!t.category) return acc; acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {});
  const totalVisible = baseByStatus.length;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: 'var(--font-sans)', background: 'var(--color-background-tertiary)', color: 'var(--color-text-primary)' }}>
      <h2 className="sr-only">Gestor de tareas con calendario</h2>

      <div style={{ background: 'var(--color-background-primary)', borderBottom: '0.5px solid rgba(148,163,184,0.18)', padding: '0 20px', minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-soft)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>{view === 'board' ? 'Tablero' : 'Tareas'}</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {view === 'board' ? 'Notas estilo post-it' : 'Gestión de tareas y calendario'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 3, background: 'var(--color-background-secondary)', padding: '3px', borderRadius: 'var(--border-radius-md)' }}>
          {[['tasks', 'Tareas'], ['calendar', 'Calendario'], ['board', 'Tablero']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '4px 14px', border: 'none', borderRadius: 'calc(var(--border-radius-md) - 2px)', background: view === v ? 'var(--color-background-primary)' : 'transparent', color: view === v ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontSize: 13, fontWeight: view === v ? 500 : 400, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" onClick={downloadBackup} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', background: 'rgba(37,99,235,0.1)', color: 'var(--color-accent)', borderRadius: '999px', transition: 'background 150ms ease' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.16)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.1)')}>Exportar</button>
          <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', borderRadius: '999px', transition: 'background 150ms ease' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(241,245,249,0.95)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-background-primary)')}>Importar</button>
          <button type="button"
            onClick={() => view === 'board'
              ? addBoardNote({ id: uid(), title: '', text: '', createdAt: new Date().toISOString(), x: 20 + Math.random() * 40, y: 20 + Math.random() * 40 })
              : open()
            }
            aria-label={view === 'board' ? 'Crear nueva nota' : 'Crear nueva tarea'}
            style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, var(--color-accent), #3b82f6)', color: 'white', borderRadius: '999px', boxShadow: '0 18px 36px rgba(37,99,235,0.18)', transition: 'transform 150ms ease, box-shadow 150ms ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 22px 40px rgba(37,99,235,0.22)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 18px 36px rgba(37,99,235,0.18)'; }}
          >
            {view === 'board' ? '+ Nueva nota' : '+ Nueva tarea'}
          </button>
        </div>
      </div>

      {backupMessage && (
        <div style={{ padding: '10px 20px', color: 'var(--color-text-secondary)', fontSize: 13 }}>{backupMessage}</div>
      )}

      <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />

      <div style={{ padding: '16px 20px' }}>
        {view === 'tasks'
          ? <TasksView
              tasks={sorted} total={totalVisible} filter={filter} setFilter={setFilter}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
              categories={categories} statusCounts={statusCounts} categoryCounts={categoryCounts}
              onEdit={(t) => setModal(t)} onToggleDone={toggleDone} onQuickAdd={handleQuickAdd}
            />
          : view === 'calendar'
            ? <CalendarView
                y={y} mo={mo} dIM={dIM} fD={fD} tByDate={tByDate} eByDate={eByDate} todayStr={todayStr}
                prev={() => setCalDate(new Date(y, mo - 1, 1))} next={() => setCalDate(new Date(y, mo + 1, 1))}
                selDay={selDay} setSelDay={setSelDay}
                onAddTaskForDay={(date) => open({ date })} onEditTask={(t) => setModal(t)}
                onAddEventForDay={(date) => openEventModal({ startDate: date, endDate: date })} onEditEvent={(e) => openEventModal(e)}
              />
            : <BoardView notes={boardNotes} onAddNote={addBoardNote} onUpdateNote={updateBoardNote} onDeleteNote={deleteBoardNote} />
        }
      </div>

      {modal && (
        <div onClick={(e) => e.target === e.currentTarget && setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 10, display: 'flex', justifyContent: 'center', paddingTop: 70 }}>
          <TaskModal task={modal} categories={categories} onSave={upsert} onDelete={modal.id ? () => del(modal.id) : null} onClose={() => setModal(null)} />
        </div>
      )}

      {eventModal && (
        <div onClick={(e) => e.target === e.currentTarget && setEventModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 10, display: 'flex', justifyContent: 'center', paddingTop: 70 }}>
          <EventModal event={eventModal} onSave={upsertEvent} onDelete={eventModal.id ? () => deleteEvent(eventModal.id) : null} onClose={() => setEventModal(null)} />
        </div>
      )}
    </div>
  );
}
