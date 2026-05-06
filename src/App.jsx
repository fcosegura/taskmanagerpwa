import { useState, useEffect, useRef } from 'react';
import { P_ORDER } from './constants.js';
import { uid, toDateStr, parseDateTimeFromDescription, parseDescriptionDateResult, cleanDescriptionSegment } from './utils.jsx';
import { loadData, saveData, validateBackupPayload, normalizeDataPayload, loginWithGoogleCredential, logoutSession, createProfile, deleteProfile, parseTaskWithAI } from './storage.js';
import TasksView from './components/TasksView.jsx';
import CalendarView from './components/CalendarView.jsx';
import BoardView from './components/BoardView.jsx';
import TaskModal from './components/TaskModal.jsx';
import EventModal from './components/EventModal.jsx';
import BottomNav from './components/BottomNav.jsx';
import Login from './components/Login.jsx';

export default function App() {
  const ACTIVE_PROFILE_STORAGE_KEY = 'taskmanager_active_profile';
  const [authenticated, setAuthenticated] = useState(null);
  const [authVersion, setAuthVersion] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [boardNotes, setBoardNotes] = useState([]);
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [hydratedSession, setHydratedSession] = useState(null);
  const [view, setView] = useState('tasks');
  const [modal, setModal] = useState(null);
  const [eventModal, setEventModal] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [selDay, setSelDay] = useState(null);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [summaryFilter, setSummaryFilter] = useState('none');
  const [backupMessage, setBackupMessage] = useState('');
  const [syncState, setSyncState] = useState('idle');
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const fileInputRef = useRef(null);
  const profileMenuRef = useRef(null);
  const syncFeedbackTimerRef = useRef(null);

  useEffect(() => {
    localStorage.removeItem('userToken');
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadData(activeProfileId).then((data) => {
      if (cancelled) return;
      setTasks(data.tasks);
      setBoardNotes(data.boardNotes);
      setEvents(data.events || []);
      if (Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
      }
      if (data.activeProfileId && data.activeProfileId !== activeProfileId) {
        setActiveProfileId(data.activeProfileId);
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, data.activeProfileId);
      }
      setAuthenticated(data.authenticated);
      setHydratedSession(data.authenticated);
      if (data.cloudError) {
        setBackupMessage(`Sync D1: ${data.cloudError}`);
        setTimeout(() => setBackupMessage(''), 5500);
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [authVersion, activeProfileId]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const handleLoginSuccess = async (credential) => {
    await loginWithGoogleCredential(credential);
    setReady(false);
    setAuthenticated(true);
    setAuthVersion((version) => version + 1);
  };

  const handleLogout = async () => {
    await logoutSession();
    setAuthenticated(false);
    setReady(false);
    setHydratedSession(null);
    setTasks([]);
    setBoardNotes([]);
    setEvents([]);
    setProfiles([]);
    setActiveProfileId(null);
    setSyncState('idle');
    localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
  };

  useEffect(() => {
    if (!ready || !authenticated || hydratedSession !== authenticated) return undefined;
    if (!activeProfileId) return undefined;
    const timer = window.setTimeout(() => {
      setSyncState('saving');
      saveData({ tasks, boardNotes, events }, authenticated, activeProfileId)
        .then(() => {
          setSyncState('saved');
          if (syncFeedbackTimerRef.current) window.clearTimeout(syncFeedbackTimerRef.current);
          syncFeedbackTimerRef.current = window.setTimeout(() => setSyncState('idle'), 1600);
        })
        .catch(() => {
          setSyncState('error');
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [tasks, boardNotes, events, ready, authenticated, hydratedSession, activeProfileId]);

  useEffect(() => () => {
    if (syncFeedbackTimerRef.current) window.clearTimeout(syncFeedbackTimerRef.current);
  }, []);

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
        const normalized = normalizeDataPayload(parsed);
        const hasImportShape = Array.isArray(parsed) || (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks));
        const sourceTasks = Array.isArray(parsed) ? parsed : parsed?.tasks;
        const sourceNotes = Array.isArray(parsed?.boardNotes) ? parsed.boardNotes : null;
        const sourceEvents = Array.isArray(parsed?.events) ? parsed.events : null;
        const droppedInvalidItems =
          normalized.tasks.length !== sourceTasks?.length ||
          (sourceNotes && normalized.boardNotes.length !== sourceNotes.length) ||
          (sourceEvents && normalized.events.length !== sourceEvents.length);
        if (!hasImportShape || droppedInvalidItems || !validateBackupPayload(normalized)) {
          throw new Error('El archivo JSON no tiene la estructura esperada.');
        }
        setTasks(normalized.tasks);
        setBoardNotes(normalized.boardNotes);
        setEvents(normalized.events);
        setFilter('all'); setCategoryFilter('all'); setModal(null); setEventModal(null);
        setSummaryFilter('none');
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

  const handleQuickSuggest = async (description) => {
    const text = (description || '').trim();
    if (!text) return;
    const { task: parsed } = await parseTaskWithAI(text);
    const fallbackParsed = parseDateTimeFromDescription(text);
    const due = typeof parsed?.dueDate === 'string' ? new Date(parsed.dueDate) : null;
    const hasValidDue = due instanceof Date && !Number.isNaN(due.getTime());
    const category = Array.isArray(parsed?.tags) && parsed.tags.length > 0 ? String(parsed.tags[0]) : '';
    const cleanDescription = typeof parsed?.title === 'string' && parsed.title.trim() ? parsed.title.trim() : text;
    upsert({
      description: cleanDescription,
      date: hasValidDue
        ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
        : (fallbackParsed?.date || ''),
      time: hasValidDue
        ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`
        : (fallbackParsed?.time || ''),
      status: 'not_done',
      priority: ['low', 'medium', 'high', 'critical'].includes(parsed?.priority) ? parsed.priority : 'medium',
      subtasks: [],
      category
    });
  };

  const handleSummaryMetricClick = (metricKey) => {
    setView('tasks');
    setSearchQuery('');
    setCategoryFilter('all');
    if (metricKey === 'today') {
      setFilter('all');
      setSummaryFilter((current) => (current === 'today' ? 'none' : 'today'));
      return;
    }
    setSummaryFilter('none');
    if (metricKey === 'active') {
      setFilter('all');
      return;
    }
    if (metricKey === 'blocked') {
      setFilter((current) => (current === 'blocked' ? 'all' : 'blocked'));
      return;
    }
    if (metricKey === 'done') {
      setFilter((current) => (current === 'done' ? 'all' : 'done'));
    }
  };

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null;
  const activeProfileName = activeProfile?.name || 'Trabajo';
  const profileGlyph = (activeProfileName[0] || 'T').toUpperCase();

  const handleSelectProfile = (profileId) => {
    if (!profileId || profileId === activeProfileId) {
      setShowProfileMenu(false);
      return;
    }
    setActiveProfileId(profileId);
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
    setView('tasks');
    setFilter('all');
    setCategoryFilter('all');
    setSummaryFilter('none');
    setSearchQuery('');
    setModal(null);
    setEventModal(null);
    setTasks([]);
    setBoardNotes([]);
    setEvents([]);
    setReady(false);
    setShowProfileMenu(false);
  };

  const handleCreateProfile = async () => {
    const name = window.prompt('Nombre del workspace', 'Personal')?.trim();
    if (!name) return;
    try {
      const profile = await createProfile(name);
      setProfiles((prev) => [...prev, profile]);
      handleSelectProfile(profile.id);
    } catch (error) {
      setBackupMessage(error.message || 'No se pudo crear el workspace.');
      setTimeout(() => setBackupMessage(''), 5000);
    }
  };

  const handleDeleteProfile = async (profile) => {
    if (!profile?.id) return;
    if (profiles.length <= 1) {
      setBackupMessage('No puedes borrar el unico workspace.');
      setTimeout(() => setBackupMessage(''), 4000);
      return;
    }
    const confirmed = window.confirm(`Vas a borrar "${profile.name}" y todas sus tareas, notas y eventos. Esta accion no se puede deshacer.\n\nDeseas continuar?`);
    if (!confirmed) return;
    try {
      const result = await deleteProfile(profile.id);
      if (Array.isArray(result?.profiles)) {
        setProfiles(result.profiles);
      }
      const nextProfileId = typeof result?.activeProfileId === 'string' ? result.activeProfileId : null;
      if (nextProfileId) {
        handleSelectProfile(nextProfileId);
      }
      setBackupMessage(`Workspace "${profile.name}" eliminado.`);
      setTimeout(() => setBackupMessage(''), 4500);
    } catch (error) {
      setBackupMessage(error.message || 'No se pudo borrar el workspace.');
      setTimeout(() => setBackupMessage(''), 5000);
    }
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
  const bySummary = summaryFilter === 'today'
    ? byCategory.filter((t) => t.date === todayStr && t.status !== 'done')
    : byCategory;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const bySearch = normalizedSearch
    ? bySummary.filter((t) => t.description.toLowerCase().includes(normalizedSearch) || (t.category || '').toLowerCase().includes(normalizedSearch))
    : bySummary;
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
  const totalVisible = bySummary.length;
  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length;
  const todayCount = (tByDate[todayStr] || []).filter((t) => t.status !== 'done').length;
  const activeMetric = summaryFilter === 'today'
    ? 'today'
    : filter === 'blocked'
      ? 'blocked'
      : filter === 'done'
        ? 'done'
        : 'active';

  if (authenticated === null) {
    return null;
  }

  if (!authenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell">
      <h2 className="sr-only">Gestor de tareas con calendario</h2>

      <header className="app-header">
        <div className="brand-block">
          <button className="icon-button subtle" onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión">↩</button>
          <div className="workspace-switcher" ref={profileMenuRef}>
            <button
              type="button"
              className="brand-mark workspace-trigger"
              onClick={() => setShowProfileMenu((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={showProfileMenu}
              aria-label={`Cambiar workspace. Actual: ${activeProfileName}`}
            >
              {profileGlyph}
            </button>
            {showProfileMenu && (
              <div className="workspace-menu" role="menu">
                {profiles.map((profile) => (
                  <div key={profile.id} className="workspace-option-row">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={profile.id === activeProfileId}
                      className={`workspace-option${profile.id === activeProfileId ? ' active' : ''}`}
                      onClick={() => handleSelectProfile(profile.id)}
                    >
                      <span>{profile.name}</span>
                      {profile.id === activeProfileId && <span>✓</span>}
                    </button>
                    <button
                      type="button"
                      className="workspace-delete"
                      aria-label={`Borrar workspace ${profile.name}`}
                      title={`Borrar workspace ${profile.name}`}
                      onClick={() => handleDeleteProfile(profile)}
                      disabled={profiles.length <= 1}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="workspace-create" onClick={handleCreateProfile}>+ Nuevo workspace</button>
              </div>
            )}
          </div>
          <div className="brand-copy">
            <span className="brand-title">{view === 'calendar' ? 'Calendario' : view === 'board' ? 'Tablero' : 'Tareas'}</span>
            <span className="brand-subtitle hide-mobile">
              {view === 'board' ? `Notas libres · ${activeProfileName}` : `Workspace: ${activeProfileName}`}
            </span>
          </div>
        </div>

        <div className="desktop-tabs hide-mobile">
          {[['tasks', 'Tareas'], ['calendar', 'Calendario'], ['board', 'Tablero']].map(([v, l]) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        <div className="header-actions">
          <div
            className={`sync-indicator${syncState !== 'idle' ? ' visible' : ''}${syncState === 'error' ? ' error' : ''}`}
            aria-live="polite"
          >
            {syncState === 'saving' ? 'Guardando...' : syncState === 'saved' ? 'Guardado' : syncState === 'error' ? 'Error al guardar' : ''}
          </div>
          <button className="ghost-button hide-mobile" type="button" onClick={downloadBackup}>Exportar</button>
          <button className="ghost-button hide-mobile" type="button" onClick={() => fileInputRef.current?.click()}>Importar</button>
          <button type="button"
            onClick={() => view === 'board'
              ? addBoardNote({ id: uid(), title: '', text: '', createdAt: new Date().toISOString(), x: 20 + Math.random() * 40, y: 20 + Math.random() * 40 })
              : open()
            }
            aria-label={view === 'board' ? 'Crear nueva nota' : 'Crear nueva tarea'}
            className="primary-button"
          >
            {view === 'board' ? '+ Nota' : '+ Tarea'}
          </button>
        </div>
      </header>

      {backupMessage && (
        <div className="toast-message">{backupMessage}</div>
      )}

      <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />

      <main className="app-main">
        <section className="overview-panel">
          <div>
            <p className="eyebrow">Resumen</p>
            <h1>{view === 'calendar' ? 'Planifica la semana' : view === 'board' ? 'Ordena tus ideas' : 'Prioriza lo importante'}</h1>
          </div>
          <div className="metric-strip">
            {[
              { key: 'active', label: 'Activas', count: activeTasks.length },
              { key: 'today', label: 'Hoy', count: todayCount },
              { key: 'blocked', label: 'Bloqueadas', count: blockedCount },
              { key: 'done', label: 'Hechas', count: completedCount },
            ].map((metric) => (
              <button
                key={metric.key}
                type="button"
                className={`metric-card${activeMetric === metric.key ? ' active' : ''}`}
                onClick={() => handleSummaryMetricClick(metric.key)}
                aria-pressed={activeMetric === metric.key}
              >
                <strong>{metric.count}</strong>
                <span>{metric.label}</span>
              </button>
            ))}
          </div>
        </section>

        {view === 'tasks'
          ? <TasksView
              tasks={sorted} total={totalVisible} filter={filter} setFilter={setFilter}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
              categories={categories} statusCounts={statusCounts} categoryCounts={categoryCounts}
              onEdit={(t) => setModal(t)} onToggleDone={toggleDone} onQuickAdd={handleQuickAdd} onQuickSuggest={handleQuickSuggest}
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
      </main>

      {modal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <TaskModal key={modal.id || 'new-task'} task={modal} categories={categories} onSave={upsert} onDelete={modal.id ? () => del(modal.id) : null} onClose={() => setModal(null)} />
        </div>
      )}

      {eventModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setEventModal(null)}>
          <EventModal key={eventModal.id || 'new-event'} event={eventModal} onSave={upsertEvent} onDelete={eventModal.id ? () => deleteEvent(eventModal.id) : null} onClose={() => setEventModal(null)} />
        </div>
      )}

      <BottomNav currentView={view} setView={setView} />
    </div>
  );
}
