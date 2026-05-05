import { STORAGE_KEY, STATUS, PRIORITY } from './constants.js';

export function isValidTask(task) {
  if (!task || typeof task !== 'object') return false;
  const { id, description, status, priority, subtasks, category, date, time } = task;
  if (typeof id !== 'string' || typeof description !== 'string') return false;
  if (typeof status !== 'string' || !STATUS.some((s) => s.v === status)) return false;
  if (typeof priority !== 'string' || !PRIORITY.some((p) => p.v === priority)) return false;
  if (category !== undefined && category !== null && typeof category !== 'string') return false;
  if (date !== undefined && date !== null && typeof date !== 'string') return false;
  if (time !== undefined && time !== null && typeof time !== 'string') return false;
  if (!Array.isArray(subtasks)) return false;
  return subtasks.every(
    (st) => st && typeof st === 'object' && typeof st.id === 'string' && typeof st.text === 'string' && typeof st.done === 'boolean'
  );
}

function normalizeTask(task) {
  return {
    ...task,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    category: task.category || '',
    date: task.date || '',
    time: task.time || '',
  };
}

function normalizeEvent(event) {
  return {
    ...event,
    endDate: event.endDate || event.startDate,
    color: event.color || '#2563eb',
  };
}

function normalizeBoardNote(note) {
  return {
    ...note,
    title: note.title || '',
    text: note.text || '',
    createdAt: note.createdAt || note.created_at || new Date().toISOString(),
    x: typeof note.x === 'number' ? note.x : 20,
    y: typeof note.y === 'number' ? note.y : 20,
  };
}

export function isValidEvent(event) {
  if (!event || typeof event !== 'object') return false;
  const { id, title, startDate, endDate, color } = event;
  if (typeof id !== 'string' || typeof title !== 'string') return false;
  if (typeof startDate !== 'string' || (endDate && typeof endDate !== 'string')) return false;
  if (typeof color !== 'string') return false;
  return true;
}

export function isValidBoardNote(note) {
  return (
    note &&
    typeof note === 'object' &&
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.text === 'string' &&
    (typeof note.createdAt === 'string' || typeof note.created_at === 'string') &&
    (note.x === undefined || typeof note.x === 'number') &&
    (note.y === undefined || typeof note.y === 'number')
  );
}

export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.tasks) || !payload.tasks.every(isValidTask)) return false;
  if (payload.boardNotes !== undefined && (!Array.isArray(payload.boardNotes) || !payload.boardNotes.every(isValidBoardNote))) return false;
  if (payload.events !== undefined && (!Array.isArray(payload.events) || !payload.events.every(isValidEvent))) return false;
  return true;
}

export function normalizeDataPayload(parsed) {
  if (Array.isArray(parsed)) {
    const tasks = parsed.map(normalizeTask);
    if (tasks.every(isValidTask)) return { tasks, boardNotes: [], events: [] };
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
    const tasks = parsed.tasks.map(normalizeTask);
    if (!tasks.every(isValidTask)) return { tasks: [], boardNotes: [], events: [] };
    const boardNotes = Array.isArray(parsed.boardNotes)
      ? parsed.boardNotes.map(normalizeBoardNote).filter(isValidBoardNote)
      : [];
    const events = Array.isArray(parsed.events)
      ? parsed.events.map(normalizeEvent).filter(isValidEvent)
      : [];
    return { tasks, boardNotes, events };
  }
  return { tasks: [], boardNotes: [], events: [] };
}

export async function loginWithGoogleCredential(credential) {
  const resp = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ credential }),
  });
  if (!resp.ok) throw new Error('No se pudo iniciar sesión.');
  return true;
}

export async function logoutSession() {
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

export async function loadData() {
  let localData = { tasks: [], boardNotes: [], events: [] };
  
  // 1. Siempre cargar de local primero (rápido)
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) localData = normalizeDataPayload(JSON.parse(r));
  } catch (e) {
    console.error("Error cargando local:", e);
  }

  try {
    const resp = await fetch('/api/data', { credentials: 'same-origin' });
    if (resp.ok) {
      const cloudData = await resp.json();
      const safeCloudData = normalizeDataPayload(cloudData);
      // Mezclar o priorizar nube (aquí podrías añadir lógica de marcas de tiempo)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeCloudData));
      return { ...safeCloudData, authenticated: true };
    }
    if (resp.status === 401) return { ...localData, authenticated: false };
    console.warn("La nube respondió con error, manteniendo la sesión local:", resp.status);
    return { ...localData, authenticated: true };
  } catch (e) {
    console.warn("Error sincronizando con la nube:", e);
  }

  return { ...localData, authenticated: false };
}

export async function saveData(payload, authenticated = false) {
  // 1. Guardar local siempre
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // El guardado local puede fallar por cuota o modo privado; la nube sigue siendo el respaldo.
  }

  // 2. Si hay sesión, sincronizar con la nube usando cookie HttpOnly
  if (authenticated) {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Error guardando en la nube:", e);
    }
  }
}
