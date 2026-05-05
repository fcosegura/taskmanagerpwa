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
    typeof note.createdAt === 'string' &&
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

function loadSafeData(parsed) {
  if (Array.isArray(parsed) && parsed.every(isValidTask)) {
    return { tasks: parsed, boardNotes: [], events: [] };
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks) && parsed.tasks.every(isValidTask)) {
    const boardNotes =
      Array.isArray(parsed.boardNotes) && parsed.boardNotes.every(isValidBoardNote)
        ? parsed.boardNotes
        : [];
    const events =
      Array.isArray(parsed.events) && parsed.events.every(isValidEvent) ? parsed.events : [];
    return { tasks: parsed.tasks, boardNotes, events };
  }
  return { tasks: [], boardNotes: [], events: [] };
}

export async function loadData(token = null) {
  let localData = { tasks: [], boardNotes: [], events: [] };
  
  // 1. Siempre cargar de local primero (rápido)
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) localData = loadSafeData(JSON.parse(r));
  } catch (e) {
    console.error("Error cargando local:", e);
  }

  // 2. Si hay token, intentar cargar de la nube (D1)
  if (token) {
    try {
      const resp = await fetch('/api/data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const cloudData = await resp.json();
        // Mezclar o priorizar nube (aquí podrías añadir lógica de marcas de tiempo)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
        return cloudData;
      }
    } catch (e) {
      console.warn("Error sincronizando con la nube:", e);
    }
  }

  return localData;
}

export async function saveData(payload, token = null) {
  // 1. Guardar local siempre
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // silent
  }

  // 2. Si hay token, sincronizar con la nube
  if (token) {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Error guardando en la nube:", e);
    }
  }
}
