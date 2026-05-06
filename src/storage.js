import { STORAGE_KEY, STATUS, PRIORITY } from './constants.js';

function profileStorageKey(profileId) {
  return profileId ? `${STORAGE_KEY}:${profileId}` : STORAGE_KEY;
}

function readLocalPayload(profileId) {
  try {
    const primaryRaw = localStorage.getItem(profileStorageKey(profileId));
    if (primaryRaw) return normalizeDataPayload(JSON.parse(primaryRaw));
  } catch (e) {
    console.error("Error cargando local (perfil):", e);
  }
  if (!profileId) {
    // Legacy fallback only for default/no-profile scope.
    try {
      const legacyRaw = localStorage.getItem(STORAGE_KEY);
      if (legacyRaw) return normalizeDataPayload(JSON.parse(legacyRaw));
    } catch (e) {
      console.error("Error cargando local (legacy):", e);
    }
  }
  return { tasks: [], boardNotes: [], events: [] };
}

function hasAnyData(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return (
    (Array.isArray(payload.tasks) && payload.tasks.length > 0) ||
    (Array.isArray(payload.boardNotes) && payload.boardNotes.length > 0) ||
    (Array.isArray(payload.events) && payload.events.length > 0)
  );
}

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
    hideInKanbanDone: Boolean(task.hideInKanbanDone),
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

export async function createProfile(name) {
  const resp = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) throw new Error('No se pudo crear el perfil.');
  const data = await resp.json();
  return data.profile;
}

export async function deleteProfile(profileId) {
  const resp = await fetch('/api/profiles/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ profileId }),
  });
  if (!resp.ok) {
    let message = 'No se pudo borrar el perfil.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // Keep generic fallback.
    }
    throw new Error(message);
  }
  return resp.json();
}

export async function parseTaskWithAI(text) {
  const resp = await fetch('/api/ai/parse-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    let message = 'No se pudo parsear la tarea.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // Keep generic message when body is not JSON.
    }
    throw new Error(message);
  }
  const data = await resp.json();
  return {
    task: data?.task || null,
    source: data?.source || 'fallback',
  };
}

export async function loadData(profileId = null) {
  let localData = readLocalPayload(profileId);

  try {
    const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    const resp = await fetch(`/api/data${query}`, { credentials: 'same-origin' });
    if (resp.ok) {
      const cloudData = await resp.json();
      const safeCloudData = normalizeDataPayload(cloudData);
      const resolvedProfileId = typeof cloudData.activeProfileId === 'string' ? cloudData.activeProfileId : profileId;
      // Important: for explicit profiles, trust cloud as source of truth to avoid cross-workspace bleed.
      const shouldPreferLocal = !resolvedProfileId && hasAnyData(localData) && !hasAnyData(safeCloudData);
      const effectiveData = shouldPreferLocal ? localData : safeCloudData;
      // Prefer local when cloud comes back empty, to avoid data loss on transient sync failures.
      localStorage.setItem(profileStorageKey(resolvedProfileId), JSON.stringify(effectiveData));
      if (!resolvedProfileId) {
        // Keep legacy key only for default/no-profile scope.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(effectiveData));
      }
      return {
        ...effectiveData,
        authenticated: true,
        profiles: Array.isArray(cloudData.profiles) ? cloudData.profiles : [],
        activeProfileId: resolvedProfileId || null,
      };
    }
    if (resp.status === 401) return { ...localData, authenticated: false, profiles: [], activeProfileId: profileId };
    console.warn("La nube respondió con error, manteniendo la sesión local:", resp.status);
    let cloudError = `Cloud sync read failed (${resp.status})`;
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') cloudError = data.error;
    } catch {
      // ignore non-json body
    }
    return { ...localData, authenticated: true, profiles: null, activeProfileId: profileId, cloudError };
  } catch (e) {
    console.warn("Error sincronizando con la nube:", e);
  }

  return { ...localData, authenticated: false, profiles: null, activeProfileId: profileId, cloudError: null };
}

export async function saveData(payload, authenticated = false, profileId = null) {
  // 1. Guardar local siempre
  try {
    localStorage.setItem(profileStorageKey(profileId), JSON.stringify(payload));
    if (!profileId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // El guardado local puede fallar por cuota o modo privado; la nube sigue siendo el respaldo.
  }

  // 2. Si hay sesión, sincronizar con la nube usando cookie HttpOnly
  if (authenticated) {
    if (!profileId) {
      // Never sync to cloud without an explicit profile id in multi-workspace mode.
      return;
    }
    try {
      const resp = await fetch('/api/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ profileId, payload })
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || `Sync HTTP ${resp.status}`);
      }
    } catch (e) {
      console.warn("Error guardando en la nube:", e);
      throw e;
    }
  }
}
