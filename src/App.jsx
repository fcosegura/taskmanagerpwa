import { useState, useEffect, useRef } from 'react';
import { P_ORDER, STATUS } from './constants.js';
import { uid, toDateStr, parseDateTimeFromDescription, parseDescriptionDateResult, cleanDescriptionSegment } from './utils.jsx';
import { loadData, saveData, validateBackupPayload, normalizeDataPayload, loginWithGoogleCredential, logoutSession, createProfile, deleteProfile, parseTaskWithAI, checkSession, getWorkspaceSummary } from './storage.js';
import TasksView from './components/TasksView.jsx';
import CalendarView from './components/CalendarView.jsx';
import BoardView from './components/BoardView.jsx';
import KanbanView from './components/KanbanView.jsx';
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
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [workspaceSummary, setWorkspaceSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const fileInputRef = useRef(null);
  const profileMenuRef = useRef(null);
  const actionsMenuRef = useRef(null);
  const syncFeedbackTimerRef = useRef(null);
  const syncDebounceTimerRef = useRef(null);
  const lastSyncedPayloadRef = useRef('');
  const latestPayloadRef = useRef({ tasks: [], boardNotes: [], events: [] });
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef(false);

  const serializePayload = (payload) => {
    try {
      return JSON.stringify(payload);
    } catch {
      return '';
    }
  };

  const clearSyncDebounce = () => {
    if (syncDebounceTimerRef.current) {
      window.clearTimeout(syncDebounceTimerRef.current);
      syncDebounceTimerRef.current = null;
    }
  };

  const syncNow = async ({ immediate = false } = {}) => {
    if (!ready || !authenticated || hydratedSession !== authenticated || !activeProfileId) return false;
    const payload = latestPayloadRef.current;
    const serialized = serializePayload(payload);
    if (!serialized || serialized === lastSyncedPayloadRef.current) return false;

    if (syncInFlightRef.current) {
      pendingSyncRef.current = true;
      return false;
    }

    if (immediate) clearSyncDebounce();

    syncInFlightRef.current = true;
    setSyncState('saving');
    try {
      await saveData(payload, authenticated, activeProfileId);
      lastSyncedPayloadRef.current = serialized;
      setSyncState('saved');
      if (syncFeedbackTimerRef.current) window.clearTimeout(syncFeedbackTimerRef.current);
      syncFeedbackTimerRef.current = window.setTimeout(() => setSyncState('idle'), 1600);
      return true;
    } catch {
      setSyncState('error');
      return false;
    } finally {
      syncInFlightRef.current = false;
      if (pendingSyncRef.current) {
        pendingSyncRef.current = false;
        void syncNow({ immediate: true });
      }
    }
  };

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
      const loadedPayload = {
        tasks: data.tasks,
        boardNotes: data.boardNotes,
        events: data.events || []
      };
      latestPayloadRef.current = loadedPayload;
      lastSyncedPayloadRef.current = serializePayload(loadedPayload);
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
      if (!actionsMenuRef.current?.contains(event.target)) {
        setShowActionsMenu(false);
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
    try {
      await syncNow({ immediate: true });
    } catch {
      // Best-effort flush before ending session.
    }
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
    setShowProfileMenu(false);
    localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
  };

  const forceLogout = () => {
    setAuthenticated(false);
    setReady(false);
    setHydratedSession(null);
    setTasks([]);
    setBoardNotes([]);
    setEvents([]);
    setProfiles([]);
    setActiveProfileId(null);
    setSyncState('idle');
    setShowProfileMenu(false);
    localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
  };

  useEffect(() => {
    if (!authenticated) return undefined;
    let cancelled = false;
    const verifyActiveSession = async () => {
      try {
        const active = await checkSession();
        if (!cancelled && !active) {
          forceLogout();
        }
      } catch {
        // Ignore transient network errors and keep current session state.
      }
    };
    const intervalId = window.setInterval(verifyActiveSession, 60000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') verifyActiveSession();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    verifyActiveSession();
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authenticated]);

  useEffect(() => {
    latestPayloadRef.current = { tasks, boardNotes, events };
    if (!ready || !authenticated || hydratedSession !== authenticated || !activeProfileId) return undefined;
    clearSyncDebounce();
    syncDebounceTimerRef.current = window.setTimeout(() => {
      void syncNow();
    }, 2000);
    return () => clearSyncDebounce();
  }, [tasks, boardNotes, events, ready, authenticated, hydratedSession, activeProfileId]);

  useEffect(() => {
    if (!authenticated) return undefined;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void syncNow({ immediate: true });
      }
    };
    const onBeforeUnload = () => {
      void syncNow({ immediate: true });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [authenticated, ready, hydratedSession, activeProfileId]);

  useEffect(() => () => {
    if (syncFeedbackTimerRef.current) window.clearTimeout(syncFeedbackTimerRef.current);
    clearSyncDebounce();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') { setModal(null); setEventModal(null); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleDone = (id) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, status: t.status === 'done' ? 'not_done' : 'done' } : t));
  };
  const moveTaskToStatus = (taskId, targetStatus, targetIndex = null) => {
    setTasks((prev) => {
      const sourceTask = prev.find((task) => task.id === taskId);
      if (!sourceTask) return prev;
      const nextStatus = targetStatus || sourceTask.status;
      const movedTask = { ...sourceTask, status: nextStatus };
      const remaining = prev.filter((task) => task.id !== taskId);
      const byStatus = STATUS.reduce((acc, status) => {
        acc[status.v] = [];
        return acc;
      }, {});
      remaining.forEach((task) => {
        if (!byStatus[task.status]) byStatus[task.status] = [];
        byStatus[task.status].push(task);
      });
      const list = byStatus[nextStatus] || [];
      const insertionIndex = targetIndex === null
        ? list.length
        : Math.max(0, Math.min(targetIndex, list.length));
      list.splice(insertionIndex, 0, movedTask);
      byStatus[nextStatus] = list;
      return STATUS.flatMap((status) => byStatus[status.v] || []);
    });
  };
  const toggleSubtaskDone = (taskId, subtaskId) => {
    setTasks((prev) => prev.map((task) => (
      task.id === taskId
        ? {
            ...task,
            subtasks: (task.subtasks || []).map((subtask) => (
              subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask
            ))
          }
        : task
    )));
  };
  const reorderTaskSubtasks = (taskId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    setTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task;
      const subtasks = [...(task.subtasks || [])];
      if (fromIndex < 0 || fromIndex >= subtasks.length || toIndex < 0 || toIndex >= subtasks.length) return task;
      const [moved] = subtasks.splice(fromIndex, 1);
      subtasks.splice(toIndex, 0, moved);
      return { ...task, subtasks };
    }));
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
  const open = (init = {}) => setModal({ description: '', status: 'not_done', priority: 'medium', date: '', time: '', subtasks: [], category: '', hideInKanbanDone: false, ...init });

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
    setWorkspaceSummary(null);
    setSummaryError('');
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

  const handleGenerateWorkspaceSummary = async () => {
    if (summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const result = await getWorkspaceSummary(activeProfileId);
      setWorkspaceSummary(result);
      setShowSummaryModal(true);
    } catch (error) {
      setSummaryError(error.message || 'No se pudo generar el resumen.');
    } finally {
      setSummaryLoading(false);
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
      // If backend says profile no longer exists, refresh from cloud to reconcile stale UI list.
      if (typeof error?.message === 'string' && error.message.includes('no existe')) {
        try {
          const data = await loadData(activeProfileId);
          if (Array.isArray(data?.profiles)) setProfiles(data.profiles);
          if (typeof data?.activeProfileId === 'string') {
            setActiveProfileId(data.activeProfileId);
            localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, data.activeProfileId);
          }
        } catch {
          // Keep original error toast if refresh fails.
        }
      }
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
                <button type="button" className="workspace-logout" onClick={handleLogout}>Log out</button>
              </div>
            )}
          </div>
          <div className="brand-copy">
            <span className="brand-title">{view === 'kanban' ? 'Kanban' : view === 'calendar' ? 'Calendario' : view === 'board' ? 'Tablero' : 'Tareas'}</span>
            <span className="brand-subtitle hide-mobile">
              {view === 'board' ? `Notas libres · ${activeProfileName}` : `Workspace: ${activeProfileName}`}
            </span>
          </div>
        </div>

        <div className="desktop-tabs hide-mobile">
          {[['tasks', 'Tareas'], ['kanban', 'Kanban'], ['calendar', 'Calendario'], ['board', 'Tablero']].map(([v, l]) => (
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
          <div className="actions-menu-wrap hide-mobile" ref={actionsMenuRef}>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setShowActionsMenu((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={showActionsMenu}
            >
              Acciones
            </button>
            {showActionsMenu && (
              <div className="header-actions-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { downloadBackup(); setShowActionsMenu(false); }}>Exportar backup</button>
                <button type="button" role="menuitem" onClick={() => { fileInputRef.current?.click(); setShowActionsMenu(false); }}>Importar backup</button>
              </div>
            )}
          </div>
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
        <section className="overview-panel compact">
          <div>
            <p className="eyebrow">Resumen</p>
            <h1>{view === 'kanban' ? 'Visualiza el flujo real' : view === 'calendar' ? 'Planifica la semana' : view === 'board' ? 'Ordena tus ideas' : 'Prioriza lo importante'}</h1>
          </div>
          {view === 'tasks' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                type="button"
                className="ghost-button"
                onClick={handleGenerateWorkspaceSummary}
                disabled={summaryLoading}
              >
                {summaryLoading ? 'Generando resumen...' : 'Resumen + plan IA'}
              </button>
            </div>
          )}
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
          {view === 'tasks' && summaryError && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-danger)' }}>{summaryError}</div>
          )}
        </section>

        {view === 'tasks'
          ? <TasksView
              tasks={sorted} total={totalVisible} filter={filter} setFilter={setFilter}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
              categories={categories} statusCounts={statusCounts} categoryCounts={categoryCounts}
              onEdit={(t) => setModal(t)} onToggleDone={toggleDone} onToggleSubtaskDone={toggleSubtaskDone}
              onReorderSubtasks={reorderTaskSubtasks} onQuickAdd={handleQuickAdd} onQuickSuggest={handleQuickSuggest}
            />
          : view === 'kanban'
            ? <KanbanView
                tasks={tasks}
                onEditTask={(task) => setModal(task)}
                onMoveTaskStatus={moveTaskToStatus}
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

      {showSummaryModal && workspaceSummary && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowSummaryModal(false)}>
          <div style={{ width: 'min(620px, 100%)', maxWidth: 'calc(100% - 32px)', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', boxShadow: 'var(--shadow-card)', padding: 24, color: 'var(--color-text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Resumen del workspace</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  Fuente: {workspaceSummary.source === 'ai' ? 'IA' : 'local'}
                </div>
              </div>
              <button type="button" onClick={() => setShowSummaryModal(false)} aria-label="Cerrar resumen" style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{workspaceSummary.summary}</p>
            {Array.isArray(workspaceSummary.actionPlan) && workspaceSummary.actionPlan.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                {workspaceSummary.actionPlan.map((item, index) => (
                  <div key={`${item}-${index}`}>{index + 1}. {item}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav currentView={view} setView={setView} />
    </div>
  );
}
