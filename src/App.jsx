import { useState, useEffect, useRef } from 'react';
import { P_ORDER, STATUS } from './constants.js';
import { uid, toDateStr, parseDateTimeFromDescription, parseDescriptionDateResult, cleanDescriptionSegment, isJiraCategory, normalizeTicketNumber, applyTicketNumberToTaskName, inheritTicketFromParentTask } from './utils.jsx';
import { loadData, saveData, validateBackupPayload, normalizeDataPayload, loginWithGoogleCredential, logoutSession, createProfile, deleteProfile, parseTaskWithAI, checkSession, generateTasksFromText, fetchWorkspaceData, isMultiBackupPayload, validateMultiBackupPayload, normalizeMultiBackupPayload } from './storage.js';
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
  const THEME_STORAGE_KEY = 'taskmanager_theme';
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
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'dark' ? 'dark' : 'light';
  });
  const [aiGenerationLoading, setAiGenerationLoading] = useState(false);
  const [aiGenerationError, setAiGenerationError] = useState('');
  const [aiPlanPreview, setAiPlanPreview] = useState(null);
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
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', theme === 'dark' ? '#111827' : '#2563eb');
    }
  }, [theme]);

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
    const onKeyDown = (e) => { if (e.key === 'Escape') { setModal(null); setEventModal(null); setAiPlanPreview(null); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const showParentBlockedMessage = (actionLabel, openChildrenCount) => {
    setBackupMessage(`No se puede ${actionLabel}: la tarea padre tiene ${openChildrenCount} tarea(s) hija(s) abierta(s).`);
    setTimeout(() => setBackupMessage(''), 4200);
  };

  const normalizeTaskWithTicket = (taskInput) => {
    const category = typeof taskInput?.category === 'string' ? taskInput.category : '';
    const ticketNumber = normalizeTicketNumber(taskInput?.ticketNumber || '');
    const normalizedName = isJiraCategory(category) && ticketNumber
      ? applyTicketNumberToTaskName(taskInput?.name || '', ticketNumber)
      : (typeof taskInput?.name === 'string' ? taskInput.name.trim() : '');
    return {
      ...taskInput,
      category,
      ticketNumber,
      name: normalizedName,
    };
  };

  const toggleDone = (id) => {
    setTasks((previousTasks) => {
      const task = previousTasks.find((item) => item.id === id);
      if (!task) return previousTasks;
      const nextStatus = task.status === 'done' ? 'not_done' : 'done';
      if (nextStatus === 'done') {
        const openChildTasks = previousTasks.filter((item) => (
          (task.dependencyTaskIds || []).includes(item.id) &&
          item.status !== 'done'
        ));
        if (openChildTasks.length > 0) {
          showParentBlockedMessage('completar', openChildTasks.length);
          return previousTasks;
        }
      }
      return previousTasks.map((item) => item.id === id ? { ...item, status: nextStatus } : item);
    });
  };
  const moveTaskToStatus = (taskId, targetStatus, targetIndex = null) => {
    setTasks((prev) => {
      const sourceTask = prev.find((task) => task.id === taskId);
      if (!sourceTask) return prev;
      const nextStatus = targetStatus || sourceTask.status;
      if (nextStatus === 'done') {
        const openChildTasks = prev.filter((task) => (
          (sourceTask.dependencyTaskIds || []).includes(task.id) &&
          task.status !== 'done'
        ));
        if (openChildTasks.length > 0) {
          showParentBlockedMessage('mover a Hecha', openChildTasks.length);
          return prev;
        }
      }
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
  const linkStandaloneTaskAsChild = (sourceTaskId, targetTaskId) => {
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return false;
    let linked = false;
    setTasks((previousTasks) => {
      const sourceTask = previousTasks.find((task) => task.id === sourceTaskId);
      const targetTask = previousTasks.find((task) => task.id === targetTaskId);
      if (!sourceTask || !targetTask) return previousTasks;

      const hasParent = (taskId) => previousTasks.some((task) => (
        Array.isArray(task.dependencyTaskIds) &&
        task.dependencyTaskIds.includes(taskId)
      ));

      const sourceHasParent = hasParent(sourceTaskId);
      const sourceHasChildren = Array.isArray(sourceTask.dependencyTaskIds) && sourceTask.dependencyTaskIds.length > 0;
      const targetHasParent = hasParent(targetTaskId);
      const alreadyLinked = (targetTask.dependencyTaskIds || []).includes(sourceTaskId);

      if (sourceHasParent || sourceHasChildren || targetHasParent || alreadyLinked) {
        return previousTasks;
      }

      linked = true;
      return previousTasks.map((task) => {
        if (task.id === targetTaskId) {
          return { ...task, dependencyTaskIds: [...(task.dependencyTaskIds || []), sourceTaskId] };
        }
        if (task.id === sourceTaskId) {
          return normalizeTaskWithTicket(inheritTicketFromParentTask(targetTask, task));
        }
        return task;
      });
    });
    if (linked) {
      setBackupMessage('Dependencia creada: la tarea arrastrada ahora es hija de la tarea destino.');
      setTimeout(() => setBackupMessage(''), 3000);
    }
    return linked;
  };
  const triggerJsonDownload = (data, fileName) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBackup = async () => {
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `taskmanager-backup-${date}.json`;

    // Sin sesión activa o sin lista de workspaces, conservamos el formato legacy con el workspace actual.
    if (!authenticated || !Array.isArray(profiles) || profiles.length === 0) {
      const payload = { tasks, boardNotes, events };
      if (!validateBackupPayload(payload)) {
        setBackupMessage('Error: los datos internos están corruptos y no se puede exportar el backup.');
        setTimeout(() => setBackupMessage(''), 5000);
        return;
      }
      triggerJsonDownload(payload, fileName);
      setBackupMessage(`Exportado ${fileName}`);
      setTimeout(() => setBackupMessage(''), 3500);
      return;
    }

    setBackupMessage('Exportando todos los workspaces...');
    try {
      const activePayload = { tasks, boardNotes, events };
      const workspacesData = await Promise.all(
        profiles.map(async (profile) => {
          const data = profile.id === activeProfileId
            ? activePayload
            : await fetchWorkspaceData(profile.id);
          return { id: profile.id, name: profile.name, ...data };
        })
      );
      const backup = {
        version: 2,
        exportedAt: new Date().toISOString(),
        workspaces: workspacesData,
      };
      if (!validateMultiBackupPayload(backup)) {
        setBackupMessage('Error: los datos exportados están corruptos.');
        setTimeout(() => setBackupMessage(''), 5000);
        return;
      }
      triggerJsonDownload(backup, fileName);
      setBackupMessage(`Exportado ${fileName} (${workspacesData.length} workspace${workspacesData.length === 1 ? '' : 's'})`);
      setTimeout(() => setBackupMessage(''), 4000);
    } catch (err) {
      setBackupMessage(`Error al exportar: ${err.message}`);
      setTimeout(() => setBackupMessage(''), 5000);
    }
  };

  const importLegacyBackup = (parsed) => {
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
  };

  const importMultiBackup = async (parsed) => {
    const normalized = normalizeMultiBackupPayload(parsed);
    if (!normalized || !validateMultiBackupPayload(normalized)) {
      throw new Error('El archivo de backup multi-workspace no es válido.');
    }
    if (!authenticated) {
      throw new Error('Necesitas iniciar sesión para importar un backup con varios workspaces.');
    }

    setBackupMessage(`Importando ${normalized.workspaces.length} workspace${normalized.workspaces.length === 1 ? '' : 's'}...`);

    const existingByName = new Map(
      (profiles || []).map((profile) => [profile.name.trim().toLowerCase(), profile])
    );
    const createdProfiles = [];
    const errors = [];
    let restoredCount = 0;

    for (const workspace of normalized.workspaces) {
      const key = workspace.name.trim().toLowerCase();
      let targetProfile = existingByName.get(key);
      try {
        if (!targetProfile) {
          targetProfile = await createProfile(workspace.name);
          if (targetProfile) {
            existingByName.set(key, targetProfile);
            createdProfiles.push(targetProfile);
          }
        }
        if (!targetProfile?.id) throw new Error('No se pudo resolver el workspace destino.');
        const payload = {
          tasks: workspace.tasks,
          boardNotes: workspace.boardNotes,
          events: workspace.events,
        };
        await saveData(payload, true, targetProfile.id);
        restoredCount += 1;
      } catch (err) {
        errors.push(`"${workspace.name}": ${err.message}`);
      }
    }

    if (createdProfiles.length > 0) {
      setProfiles((prev) => [...prev, ...createdProfiles]);
    }

    setFilter('all'); setCategoryFilter('all'); setModal(null); setEventModal(null);
    setSummaryFilter('none');
    setReady(false);
    setAuthVersion((version) => version + 1);

    if (errors.length === 0) {
      setBackupMessage(`Importados ${restoredCount} workspace${restoredCount === 1 ? '' : 's'} correctamente.`);
    } else {
      setBackupMessage(`Importación parcial (${restoredCount} ok, ${errors.length} con errores): ${errors.join(' | ')}`);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (isMultiBackupPayload(parsed)) {
          await importMultiBackup(parsed);
        } else {
          importLegacyBackup(parsed);
        }
      } catch (err) {
        setBackupMessage(`Error al importar: ${err.message}`);
      }
      e.target.value = '';
      setTimeout(() => setBackupMessage(''), 6000);
    };
    reader.readAsText(file);
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  const upsert = (task) => {
    const normalizedTask = normalizeTaskWithTicket(task);
    setTasks((previousTasks) => {
      const taskId = normalizedTask.id || uid();
      const cleanedDependencyIds = [...new Set((normalizedTask.dependencyTaskIds || []).filter((dependencyId) => (
        typeof dependencyId === 'string' &&
        dependencyId !== taskId &&
        previousTasks.some((item) => item.id === dependencyId)
      )))];
      const parentTasks = previousTasks.filter((item) => (
        item.id !== taskId &&
        Array.isArray(item.dependencyTaskIds) &&
        item.dependencyTaskIds.includes(taskId)
      ));
      const finalDependencyIds = parentTasks.length > 0 ? [] : cleanedDependencyIds;
      if (normalizedTask.status === 'done') {
        const openChildTasks = previousTasks.filter((item) => (
          finalDependencyIds.includes(item.id) &&
          item.status !== 'done'
        ));
        if (openChildTasks.length > 0) {
          setBackupMessage(`No se puede guardar en Hecha: tiene ${openChildTasks.length} tarea(s) hija(s) abierta(s).`);
          setTimeout(() => setBackupMessage(''), 4200);
          return previousTasks;
        }
      }
      const nextTask = { ...normalizedTask, id: taskId, dependencyTaskIds: finalDependencyIds };
      return normalizedTask.id
        ? previousTasks.map((item) => item.id === normalizedTask.id ? nextTask : item)
        : [...previousTasks, nextTask];
    });
    setModal(null);
  };
  const del = (id) => {
    let blockedByOpenChildren = false;
    let blockedChildrenCount = 0;
    setTasks((previousTasks) => {
      const targetTask = previousTasks.find((task) => task.id === id);
      if (!targetTask) return previousTasks;
      const openChildTasks = previousTasks.filter((task) => (
        (targetTask.dependencyTaskIds || []).includes(task.id) &&
        task.status !== 'done'
      ));
      if (openChildTasks.length > 0) {
        blockedByOpenChildren = true;
        blockedChildrenCount = openChildTasks.length;
        return previousTasks;
      }
      return previousTasks
        .filter((task) => task.id !== id)
        .map((task) => ({
          ...task,
          dependencyTaskIds: (task.dependencyTaskIds || []).filter((dependencyId) => dependencyId !== id)
        }));
    });
    if (blockedByOpenChildren) {
      showParentBlockedMessage('eliminar', blockedChildrenCount || 1);
      return;
    }
    setModal(null);
  };
  const open = (init = {}) => setModal({ name: '', url: '', notes: '', status: 'not_done', priority: 'medium', date: '', time: '', subtasks: [], dependencyTaskIds: [], category: '', ticketNumber: '', hideInKanbanDone: false, ...init });

  const addBoardNote = (note) => setBoardNotes((p) => [note, ...p]);
  const deleteBoardNote = (id) => setBoardNotes((p) => p.filter((note) => note.id !== id));
  const updateBoardNote = (id, changes) => setBoardNotes((p) => p.map((note) => note.id === id ? { ...note, ...changes } : note));

  const upsertEvent = (event) => {
    setEvents((p) => event.id ? p.map((e) => e.id === event.id ? event : e) : [...p, { ...event, id: uid() }]);
    setEventModal(null);
  };
  const deleteEvent = (id) => { setEvents((p) => p.filter((e) => e.id !== id)); setEventModal(null); };
  const openEventModal = (init = {}) => setEventModal({ title: '', startDate: '', endDate: '', color: '#2563eb', ...init });

  const handleQuickAdd = (nameInput) => {
    if (!nameInput.trim()) return;
    const parsed = parseDateTimeFromDescription(nameInput);
    let cleaned = nameInput;
    if (parsed) {
      const result = parseDescriptionDateResult(nameInput);
      cleaned = cleanDescriptionSegment(nameInput, result?.text || '');
      if (!result?.text || cleaned === nameInput.trim()) {
        cleaned = cleaned.replace(/(?:\b(?:a|al|a la|a las|el|la|en|para)\b.*)$/i, '').replace(/\s{2,}/g, ' ').trim();
      }
    }
    upsert({ name: cleaned || nameInput.trim(), date: parsed?.date || '', time: parsed?.time || '', status: 'not_done', priority: 'medium', subtasks: [], category: '', url: '', notes: '' });
  };

  const handleQuickSuggest = async (nameInput) => {
    const text = (nameInput || '').trim();
    if (!text) return;
    const { task: parsed } = await parseTaskWithAI(text);
    const fallbackParsed = parseDateTimeFromDescription(text);
    const due = typeof parsed?.dueDate === 'string' ? new Date(parsed.dueDate) : null;
    const hasValidDue = due instanceof Date && !Number.isNaN(due.getTime());
    const category = Array.isArray(parsed?.tags) && parsed.tags.length > 0 ? String(parsed.tags[0]) : '';
    const cleanName = typeof parsed?.title === 'string' && parsed.title.trim() ? parsed.title.trim() : text;
    upsert({
      name: cleanName,
      date: hasValidDue
        ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
        : (fallbackParsed?.date || ''),
      time: hasValidDue
        ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`
        : (fallbackParsed?.time || ''),
      status: 'not_done',
      priority: ['low', 'medium', 'high', 'critical'].includes(parsed?.priority) ? parsed.priority : 'medium',
      subtasks: [],
      dependencyTaskIds: [],
      category,
      url: '',
      notes: ''
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
    setAiGenerationError('');
    setAiPlanPreview(null);
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

  const normalizeAiTaskInput = (taskInput, fallbackName) => {
    const name = typeof taskInput?.name === 'string' && taskInput.name.trim()
      ? taskInput.name.trim()
      : fallbackName;
    return {
      name,
      date: typeof taskInput?.date === 'string' ? taskInput.date : '',
      time: typeof taskInput?.time === 'string' ? taskInput.time : '',
      status: 'not_done',
      priority: ['low', 'medium', 'high', 'critical'].includes(taskInput?.priority) ? taskInput.priority : 'medium',
      subtasks: [],
      dependencyTaskIds: [],
      category: typeof taskInput?.category === 'string' ? taskInput.category : '',
      url: '',
      notes: typeof taskInput?.notes === 'string' ? taskInput.notes : '',
      hideInKanbanDone: false,
    };
  };

  const applyAiPlanPreview = () => {
    if (!aiPlanPreview) return;
    setTasks((previousTasks) => {
      const mainTaskRecords = aiPlanPreview.mainTasks
        .map((task, index) => ({
          ...normalizeAiTaskInput(task, `Tarea ${index + 1}`),
          id: uid(),
          ref: typeof task.ref === 'string' && task.ref.trim() ? task.ref.trim() : `main_${index + 1}`,
        }))
        .filter((task) => task.name);
      if (mainTaskRecords.length === 0) return previousTasks;

      const mainIdsByRef = new Map(mainTaskRecords.map((task) => [task.ref, task.id]));
      const defaultParentId = mainTaskRecords[0].id;
      const childRecords = aiPlanPreview.childTasks
        .map((task, index) => {
          const normalized = normalizeAiTaskInput(task, `Subtarea ${index + 1}`);
          const parentId = mainIdsByRef.get(task.parentRef) || defaultParentId;
          return { ...normalized, id: uid(), parentId };
        })
        .filter((task) => task.name);

      const childIdsByParent = new Map();
      childRecords.forEach((child) => {
        const list = childIdsByParent.get(child.parentId) || [];
        list.push(child.id);
        childIdsByParent.set(child.parentId, list);
      });

      const finalMainTasks = mainTaskRecords.map((task) => {
        const nextTask = { ...task, dependencyTaskIds: childIdsByParent.get(task.id) || [] };
        delete nextTask.ref;
        return nextTask;
      });
      const finalChildren = childRecords.map((task) => {
        const nextTask = { ...task };
        delete nextTask.parentId;
        return nextTask;
      });
      return [...previousTasks, ...finalChildren, ...finalMainTasks];
    });

    const sourceLabel = aiPlanPreview.source === 'ai' ? 'IA' : 'fallback';
    setBackupMessage(`Plan de tareas creado (${sourceLabel}).`);
    setTimeout(() => setBackupMessage(''), 3500);
    setAiPlanPreview(null);
  };

  const handleGenerateTasksFromAi = async () => {
    if (aiGenerationLoading) return;
    const input = window.prompt('Describe las tareas que quieres crear con IA');
    const text = typeof input === 'string' ? input.trim() : '';
    if (!text) return;

    setAiGenerationLoading(true);
    setAiGenerationError('');
    try {
      const result = await generateTasksFromText(text, activeProfileId);
      const mainInputs = Array.isArray(result?.mainTasks) ? result.mainTasks : [];
      const childInputs = Array.isArray(result?.childTasks) ? result.childTasks : [];
      if (mainInputs.length === 0) throw new Error('No se pudo interpretar tareas principales.');
      const normalizedMain = mainInputs
        .map((task, index) => ({
          ...normalizeAiTaskInput(task, `Tarea ${index + 1}`),
          ref: typeof task?.ref === 'string' && task.ref.trim() ? task.ref.trim() : `main_${index + 1}`,
        }))
        .filter((task) => task.name);
      const validRefs = new Set(normalizedMain.map((task) => task.ref));
      const defaultRef = normalizedMain[0]?.ref || 'main_1';
      const normalizedChildren = childInputs
        .map((task, index) => ({
          ...normalizeAiTaskInput(task, `Subtarea ${index + 1}`),
          parentRef: validRefs.has(task?.parentRef) ? task.parentRef : defaultRef,
        }))
        .filter((task) => task.name);
      setAiPlanPreview({
        source: result?.source === 'ai' ? 'ai' : 'fallback',
        inputText: text,
        mainTasks: normalizedMain,
        childTasks: normalizedChildren,
      });
    } catch (error) {
      setAiGenerationError(error.message || 'No se pudo generar tareas con IA.');
    } finally {
      setAiGenerationLoading(false);
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
    ? bySummary.filter((t) => t.name.toLowerCase().includes(normalizedSearch) || (t.category || '').toLowerCase().includes(normalizedSearch))
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
                <button type="button" role="menuitem" onClick={() => { toggleTheme(); setShowActionsMenu(false); }}>
                  {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                </button>
                <button type="button" role="menuitem" onClick={() => { void downloadBackup(); setShowActionsMenu(false); }}>Exportar backup</button>
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
                onClick={handleGenerateTasksFromAi}
                disabled={aiGenerationLoading}
              >
                {aiGenerationLoading ? 'Generando tareas...' : 'Generar tareas IA'}
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
          {view === 'tasks' && aiGenerationError && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-danger)' }}>{aiGenerationError}</div>
          )}
        </section>

        {view === 'tasks'
          ? <TasksView
              allTasks={tasks}
              tasks={sorted} total={totalVisible} filter={filter} setFilter={setFilter}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
              categories={categories} statusCounts={statusCounts} categoryCounts={categoryCounts}
              onEdit={(t) => setModal(t)} onToggleDone={toggleDone}
              onQuickAdd={handleQuickAdd} onQuickSuggest={handleQuickSuggest}
              onDropTaskOnTask={linkStandaloneTaskAsChild}
            />
          : view === 'kanban'
            ? <KanbanView
                key={activeProfileId || 'default'}
                tasks={tasks}
                allTasks={tasks}
                kanbanColumnsStorageKey={`taskmanager_kanban_visible_columns_${activeProfileId || 'default'}`}
                onEditTask={(task) => setModal(task)}
                onMoveTaskStatus={moveTaskToStatus}
                onDropTaskOnTask={linkStandaloneTaskAsChild}
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
          <TaskModal key={modal.id || 'new-task'} task={modal} categories={categories} allTasks={tasks} onSave={upsert} onDelete={modal.id ? () => del(modal.id) : null} onClose={() => setModal(null)} />
        </div>
      )}

      {eventModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setEventModal(null)}>
          <EventModal key={eventModal.id || 'new-event'} event={eventModal} onSave={upsertEvent} onDelete={eventModal.id ? () => deleteEvent(eventModal.id) : null} onClose={() => setEventModal(null)} />
        </div>
      )}

      {aiPlanPreview && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setAiPlanPreview(null)}>
          <div style={{ width: 'min(700px, 100%)', maxWidth: 'calc(100% - 32px)', background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', boxShadow: 'var(--shadow-card)', padding: 24, color: 'var(--color-text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Confirmar plan de tareas IA</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  Fuente: {aiPlanPreview.source === 'ai' ? 'IA' : 'fallback'}
                </div>
              </div>
              <button type="button" onClick={() => setAiPlanPreview(null)} aria-label="Cerrar preview IA" style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {aiPlanPreview.inputText}
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
              {aiPlanPreview.mainTasks.map((task) => {
                const children = aiPlanPreview.childTasks.filter((child) => child.parentRef === task.ref);
                return (
                  <div key={task.ref} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 600 }}>{task.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      Prioridad: {task.priority} {task.date ? `· Fecha: ${task.date}` : ''}
                    </div>
                    {children.length > 0 && (
                      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                        {children.map((child, index) => (
                          <div key={`${task.ref}-${child.name}-${index}`} style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                            - {child.name} ({child.priority})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="ghost-button" onClick={() => setAiPlanPreview(null)}>
                Cancelar
              </button>
              <button type="button" className="primary-button" onClick={applyAiPlanPreview}>
                Confirmar y crear
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav currentView={view} setView={setView} />
    </div>
  );
}
