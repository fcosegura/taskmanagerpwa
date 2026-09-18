import { STORAGE_KEY, PRIORITY, normalizeStatuses } from './constants.js';
import { isPlannedSlotsArrayShape, normalizePlannedSlots } from './plannedSlots.js';
import { isValidStatusLogEntry, normalizeStatusLog } from './statusLog.js';
import { isDateOnlyString, isRequiredDateOnlyString, canonicalizeDateOnly } from './todayViewHelpers.js';

const lastCloudSnapshotByProfile = new Map();

/**
 * Whether the most recent `loadData` kept local data because the cloud copy was
 * empty/invalid. Consumers (App) can use this to avoid marking the kept payload
 * as already synced and to re-push it to the cloud.
 */
let lastLoadPreferLocal = false;

export function didLastLoadPreferLocal() {
  return lastLoadPreferLocal;
}

const TRANSIENT_READ_STATUSES = new Set([502, 503, 504]);
const CLOUD_READ_MAX_ATTEMPTS = 3;
const CLOUD_READ_RETRY_BASE_DELAY_MS = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET idempotentes contra la nube: reintenta errores transitorios (502/503/504)
 * antes de rendirse, para no alarmar al usuario por caídas momentáneas de D1.
 */
export async function fetchCloudReadWithRetry(url, init = {}, retry = {}) {
  const attempts = Number.isFinite(retry.attempts) ? retry.attempts : CLOUD_READ_MAX_ATTEMPTS;
  const baseDelayMs = Number.isFinite(retry.baseDelayMs) ? retry.baseDelayMs : CLOUD_READ_RETRY_BASE_DELAY_MS;
  const wait = typeof retry.wait === 'function' ? retry.wait : delay;
  const fetchImpl = typeof retry.fetchImpl === 'function' ? retry.fetchImpl : fetch;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const resp = await fetchImpl(url, init);
      if (!TRANSIENT_READ_STATUSES.has(resp?.status) || attempt === attempts) {
        return resp;
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
    await wait(baseDelayMs * attempt);
  }

  if (lastError) throw lastError;
  throw new Error('Cloud read failed');
}

function clonePayload(payload) {
  try {
    return JSON.parse(JSON.stringify({
      tasks: Array.isArray(payload?.tasks) ? payload.tasks : [],
      boardNotes: Array.isArray(payload?.boardNotes) ? payload.boardNotes : [],
      events: Array.isArray(payload?.events) ? payload.events : [],
    }));
  } catch {
    return { tasks: [], boardNotes: [], events: [] };
  }
}

function stableSerialize(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

function indexById(list = []) {
  const index = new Map();
  for (const item of list) {
    if (item && typeof item.id === 'string') {
      index.set(item.id, item);
    }
  }
  return index;
}

/** Guards normalize* calls so a null/non-object array entry is dropped, not fatal. */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function diffEntityOps(previousList = [], nextList = []) {
  const previous = indexById(previousList);
  const next = indexById(nextList);
  const deletes = [];
  const upserts = [];

  for (const [id, prevItem] of previous.entries()) {
    if (!next.has(id)) deletes.push(id);
    else if (stableSerialize(prevItem) !== stableSerialize(next.get(id))) upserts.push(next.get(id));
  }
  for (const [id, nextItem] of next.entries()) {
    if (!previous.has(id)) upserts.push(nextItem);
  }
  return { upserts, deletes };
}

function buildIncrementalOps(previousPayload, nextPayload) {
  return {
    tasks: diffEntityOps(previousPayload?.tasks || [], nextPayload?.tasks || []),
    notes: diffEntityOps(previousPayload?.boardNotes || [], nextPayload?.boardNotes || []),
    events: diffEntityOps(previousPayload?.events || [], nextPayload?.events || []),
  };
}

function hasAnyOps(ops) {
  return (
    (ops.tasks.upserts.length + ops.tasks.deletes.length) > 0 ||
    (ops.notes.upserts.length + ops.notes.deletes.length) > 0 ||
    (ops.events.upserts.length + ops.events.deletes.length) > 0
  );
}

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
  const { id, name, status, priority, subtasks, category, date, time, dependencyTaskIds, url, notes, ticketNumber, completedAt, plannedSlots } = task;
  if (typeof id !== 'string' || typeof name !== 'string') return false;
  if (typeof status !== 'string' || status.trim().length === 0) return false;
  if (typeof priority !== 'string' || !PRIORITY.some((p) => p.v === priority)) return false;
  if (category !== undefined && category !== null && typeof category !== 'string') return false;
  if (!isDateOnlyString(date)) return false;
  if (!isDateOnlyString(task.endDate)) return false;
  if (time !== undefined && time !== null && typeof time !== 'string') return false;
  if (url !== undefined && url !== null && typeof url !== 'string') return false;
  if (notes !== undefined && notes !== null && typeof notes !== 'string') return false;
  if (ticketNumber !== undefined && ticketNumber !== null && typeof ticketNumber !== 'string') return false;
  if (completedAt !== undefined && completedAt !== null && typeof completedAt !== 'string') return false;
  if (!Array.isArray(subtasks)) return false;
  if (dependencyTaskIds !== undefined && !Array.isArray(dependencyTaskIds)) return false;
  if (Array.isArray(dependencyTaskIds) && !dependencyTaskIds.every((id) => typeof id === 'string')) return false;
  if (!isPlannedSlotsArrayShape(plannedSlots)) return false;
  if (task.statusLog !== undefined && (
    !Array.isArray(task.statusLog) || !task.statusLog.every(isValidStatusLogEntry)
  )) return false;
  return subtasks.every(
    (st) => st && typeof st === 'object' && typeof st.id === 'string' && typeof st.text === 'string' && typeof st.done === 'boolean'
  );
}

function legacySubtaskId() {
  return `st-${crypto.randomUUID()}`;
}

function normalizeSubtask(st) {
  if (!st || typeof st !== 'object') return null;
  const text = st.text ?? st.title;
  return {
    id: String(st.id ?? legacySubtaskId()),
    text: typeof text === 'string' ? text : '',
    done: Boolean(st.done ?? st.completed ?? false),
  };
}

const LEGACY_PRIORITY_MAP = { urgent: 'critical' };

function normalizePriority(priority) {
  if (typeof priority !== 'string') return priority;
  return LEGACY_PRIORITY_MAP[priority] ?? priority;
}

function normalizeTask(task) {
  const rawDependencies = Array.isArray(task.dependencyTaskIds) ? task.dependencyTaskIds : [];
  const legacyName = typeof task.name === 'string' ? task.name : (typeof task.description === 'string' ? task.description : '');
  const normalizedStatus = task.status === 'started' ? 'in_progress' : task.status;
  const normalizedSubtasks = (Array.isArray(task.subtasks) ? task.subtasks : [])
    .map(normalizeSubtask)
    .filter(Boolean);
  return {
    ...task,
    name: legacyName,
    status: normalizedStatus,
    priority: normalizePriority(task.priority),
    subtasks: normalizedSubtasks,
    dependencyTaskIds: [...new Set(rawDependencies.filter((id) => typeof id === 'string'))],
    category: task.category || '',
    date: canonicalizeDateOnly(task.date),
    endDate: canonicalizeDateOnly(task.endDate),
    time: task.time || '',
    url: task.url || '',
    notes: task.notes || '',
    ticketNumber: task.ticketNumber || '',
    completedAt: typeof task.completedAt === 'string' ? task.completedAt : (typeof task.completed_at === 'string' ? task.completed_at : ''),
    hideInKanbanDone: Boolean(task.hideInKanbanDone),
    plannedSlots: normalizePlannedSlots(task.plannedSlots),
    statusLog: normalizeStatusLog(task.statusLog),
    createdAt: typeof task.createdAt === 'string'
      ? task.createdAt
      : (typeof task.created_at === 'string' ? task.created_at : ''),
    updatedAt: typeof task.updatedAt === 'string'
      ? task.updatedAt
      : (typeof task.updated_at === 'string' ? task.updated_at : ''),
  };
}

function normalizeEvent(event) {
  let allDay = event.allDay === false || event.allDay === 0 ? false : true;
  let startTime = typeof event.startTime === 'string' ? event.startTime : '';
  let endTime = typeof event.endTime === 'string' ? event.endTime : '';
  if (!allDay && !startTime && !endTime) allDay = true;
  const recurrenceFrequency = ['none', 'daily', 'weekly', 'monthly'].includes(event.recurrenceFrequency)
    ? event.recurrenceFrequency
    : 'none';
  const parsedInterval = Number.parseInt(String(event.recurrenceInterval ?? '1'), 10);
  const recurrenceInterval = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 1;
  const recurrenceUntil = canonicalizeDateOnly(event.recurrenceUntil);
  const parsedCount = Number.parseInt(String(event.recurrenceCount ?? ''), 10);
  const recurrenceCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : null;
  return {
    ...event,
    startDate: canonicalizeDateOnly(event.startDate),
    endDate: canonicalizeDateOnly(event.endDate) || canonicalizeDateOnly(event.startDate),
    color: event.color || '#2563eb',
    allDay,
    startTime: allDay ? '' : startTime,
    endTime: allDay ? '' : endTime,
    recurrenceFrequency,
    recurrenceInterval: recurrenceFrequency === 'none' ? 1 : recurrenceInterval,
    recurrenceUntil: recurrenceFrequency === 'none' ? '' : recurrenceUntil,
    recurrenceCount: recurrenceFrequency === 'none' ? null : recurrenceCount,
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
  const { id, title, startDate, endDate, color, allDay, startTime, endTime, recurrenceFrequency, recurrenceInterval, recurrenceUntil, recurrenceCount } = event;
  if (typeof id !== 'string' || typeof title !== 'string') return false;
  if (!isRequiredDateOnlyString(startDate)) return false;
  if (endDate !== undefined && endDate !== null && !isDateOnlyString(endDate)) return false;
  if (recurrenceUntil !== undefined && recurrenceUntil !== null && !isDateOnlyString(recurrenceUntil)) return false;
  if (typeof color !== 'string') return false;
  if (allDay != null && typeof allDay !== 'boolean' && typeof allDay !== 'number') return false;
  if (startTime != null && typeof startTime !== 'string') return false;
  if (endTime != null && typeof endTime !== 'string') return false;
  if (recurrenceFrequency != null && !['none', 'daily', 'weekly', 'monthly'].includes(recurrenceFrequency)) return false;
  if (recurrenceInterval != null && (!Number.isInteger(Number(recurrenceInterval)) || Number(recurrenceInterval) < 1)) return false;
  if (recurrenceUntil != null && typeof recurrenceUntil !== 'string') return false;
  if (recurrenceCount != null && (!Number.isInteger(Number(recurrenceCount)) || Number(recurrenceCount) < 1)) return false;
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
    const tasks = parsed.filter(isPlainObject).map(normalizeTask).filter(isValidTask);
    return { tasks, boardNotes: [], events: [] };
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
    // Per-item sanitation: drop only invalid entities instead of discarding the whole dataset.
    const tasks = parsed.tasks.filter(isPlainObject).map(normalizeTask).filter(isValidTask);
    const boardNotes = Array.isArray(parsed.boardNotes)
      ? parsed.boardNotes.filter(isPlainObject).map(normalizeBoardNote).filter(isValidBoardNote)
      : [];
    const events = Array.isArray(parsed.events)
      ? parsed.events.filter(isPlainObject).map(normalizeEvent).filter(isValidEvent)
      : [];
    const customStatuses = Array.isArray(parsed.customStatuses)
      ? normalizeStatuses(parsed.customStatuses)
      : undefined;
    return {
      tasks,
      boardNotes,
      events,
      ...(customStatuses ? { customStatuses } : {}),
    };
  }
  return { tasks: [], boardNotes: [], events: [] };
}

export function isMultiBackupPayload(parsed) {
  return Boolean(
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Array.isArray(parsed.workspaces)
  );
}

export function validateMultiBackupPayload(payload) {
  if (!isMultiBackupPayload(payload)) return false;
  return payload.workspaces.every((workspace) => (
    workspace &&
    typeof workspace === 'object' &&
    typeof workspace.name === 'string' &&
    workspace.name.trim().length > 0 &&
    validateBackupPayload(workspace)
  ));
}

export function normalizeMultiBackupPayload(parsed) {
  if (!isMultiBackupPayload(parsed)) return null;
  const workspaces = parsed.workspaces
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!name) return null;
      const normalized = normalizeDataPayload(raw);
      const sourceTaskCount = Array.isArray(raw.tasks) ? raw.tasks.length : 0;
      const sourceNoteCount = Array.isArray(raw.boardNotes) ? raw.boardNotes.length : 0;
      const sourceEventCount = Array.isArray(raw.events) ? raw.events.length : 0;
      const droppedItems =
        normalized.tasks.length !== sourceTaskCount ||
        normalized.boardNotes.length !== sourceNoteCount ||
        normalized.events.length !== sourceEventCount;
      if (droppedItems) return null;
      const customStatuses = Array.isArray(raw.customStatuses)
        ? normalizeStatuses(raw.customStatuses)
        : (Array.isArray(raw.statuses) ? normalizeStatuses(raw.statuses) : undefined);
      return {
        id: typeof raw.id === 'string' ? raw.id : null,
        name,
        ...normalized,
        ...(customStatuses ? { customStatuses } : {}),
      };
    })
    .filter(Boolean);
  if (workspaces.length === 0) return null;
  return { workspaces };
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

export async function checkSession() {
  const resp = await fetch('/api/session', { credentials: 'same-origin' });
  return resp.ok;
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

export async function updateProfileStatuses(profileId, customStatuses) {
  const resp = await fetch('/api/profiles/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ profileId, customStatuses }),
  });
  if (!resp.ok) {
    let message = 'No se pudo actualizar los estados del workspace.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // ignore
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
    if (resp.status === 429) message = message.includes('IA') ? message : 'Demasiadas solicitudes. Espera un momento.';
    if (resp.status === 413) message = message.includes('Límite') ? message : 'Los datos son demasiado grandes para sincronizar.';
    throw new Error(message);
  }
  const data = await resp.json();
  return {
    task: data?.task || null,
    source: data?.source || 'fallback',
  };
}

export async function generateTasksFromText(text, profileId = null) {
  const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
  const resp = await fetch(`/api/ai/generate-tasks${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    let message = 'No se pudo generar tareas con IA.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // Keep default error message.
    }
    if (resp.status === 429) message = message.includes('IA') ? message : 'Demasiadas solicitudes. Espera un momento.';
    throw new Error(message);
  }
  const data = await resp.json();
  const mainTasks = Array.isArray(data?.mainTasks)
    ? data.mainTasks.filter((item) => item && typeof item === 'object')
    : [];
  const childTasks = Array.isArray(data?.childTasks)
    ? data.childTasks.filter((item) => item && typeof item === 'object')
    : [];
  if (mainTasks.length === 0) {
    throw new Error('Respuesta IA invalida: mainTasks faltante.');
  }
  return {
    mainTasks,
    childTasks,
    source: data?.source === 'ai' ? 'ai' : 'fallback',
  };
}

export async function generateDailyStatus(days, activities, profileId = null) {
  const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
  const resp = await fetch(`/api/ai/daily-status${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ days, activities }),
  });
  if (!resp.ok) {
    let message = 'No se pudo generar el daily status.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // Keep default error message.
    }
    if (resp.status === 429) message = message.includes('IA') ? message : 'Demasiadas solicitudes. Espera un momento.';
    throw new Error(message);
  }
  const data = await resp.json();
  return {
    report: typeof data?.report === 'string' ? data.report : '',
    source: data?.source === 'ai' ? 'ai' : 'fallback',
  };
}

const NOTE_AI_META_CACHE_PREFIX = 'taskmanager_note_ai_meta:';

export function cacheNoteAiMetaLocal(profileId, metaList) {
  if (!profileId) return;
  try {
    localStorage.setItem(
      `${NOTE_AI_META_CACHE_PREFIX}${profileId}`,
      JSON.stringify({ at: Date.now(), meta: Array.isArray(metaList) ? metaList : [] })
    );
  } catch {
    // ignore
  }
}

export function loadCachedNoteAiMeta(profileId) {
  if (!profileId) return [];
  try {
    const raw = localStorage.getItem(`${NOTE_AI_META_CACHE_PREFIX}${profileId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.meta) ? parsed.meta : [];
  } catch {
    return [];
  }
}

export async function fetchNoteAiMeta(profileId) {
  const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
  const resp = await fetch(`/api/notes/ai${query}`, { credentials: 'same-origin' });
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('Sesión expirada');
    throw new Error(`No se pudo cargar metadatos de notas (${resp.status}).`);
  }
  const data = await resp.json();
  const meta = Array.isArray(data?.meta) ? data.meta : [];
  cacheNoteAiMetaLocal(profileId, meta);
  return meta;
}

export async function searchNotesSemantic(query, profileId, prefs) {
  const resp = await fetch('/api/notes/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ query, profileId, prefs }),
  });
  if (!resp.ok) {
    let message = 'No se pudo buscar en las notas.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // keep default
    }
    if (resp.status === 429) message = message.includes('IA') ? message : 'Demasiadas solicitudes. Espera un momento.';
    throw new Error(message);
  }
  return await resp.json();
}

export async function fetchRelatedNotes(noteId, profileId) {
  const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
  const resp = await fetch(`/api/notes/${encodeURIComponent(noteId)}/related${query}`, {
    credentials: 'same-origin',
  });
  if (!resp.ok) throw new Error('No se pudieron cargar notas relacionadas.');
  return await resp.json();
}

export async function dismissNoteAiSuggestionClient(noteId, kind, value, profileId) {
  const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
  const resp = await fetch(`/api/notes/ai/dismiss${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ noteId, kind, value }),
  });
  if (!resp.ok) throw new Error('No se pudo descartar la sugerencia.');
  return await resp.json();
}

export async function fetchNoteDuplicates(profileId, prefs) {
  const resp = await fetch('/api/notes/duplicates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ profileId, prefs }),
  });
  if (!resp.ok) {
    let message = 'No se pudieron detectar duplicados.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  return await resp.json();
}

export async function fetchNotesOrganizeLayout(profileId, prefs, layout) {
  const resp = await fetch('/api/notes/organize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ profileId, prefs, layout }),
  });
  if (!resp.ok) {
    let message = 'No se pudo organizar el tablero.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  return await resp.json();
}

export async function chatNotesRag(question, profileId, prefs) {
  const resp = await fetch('/api/notes/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ question, profileId, prefs }),
  });
  if (!resp.ok) {
    let message = 'No se pudo consultar el chat de notas.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // keep default
    }
    if (resp.status === 429) {
      message = message.includes('chat') || message.includes('IA')
        ? message
        : 'Demasiadas preguntas. Espera un momento.';
    }
    throw new Error(message);
  }
  return await resp.json();
}

export async function fetchWorkspaceData(profileId) {
  if (!profileId) throw new Error('profileId es requerido para fetchWorkspaceData.');
  const resp = await fetchCloudReadWithRetry(`/api/data?profileId=${encodeURIComponent(profileId)}`, { credentials: 'same-origin' });
  if (!resp.ok) {
    throw new Error(`No se pudo leer el workspace (${resp.status}).`);
  }
  const cloudData = await resp.json();
  const data = normalizeDataPayload(cloudData);
  // Los estados custom viven en el perfil dentro de cloudData.profiles, no en el payload de tareas.
  const profile = Array.isArray(cloudData?.profiles)
    ? cloudData.profiles.find((p) => p && p.id === profileId)
    : null;
  const customStatuses = Array.isArray(profile?.customStatuses) && profile.customStatuses.length > 0
    ? normalizeStatuses(profile.customStatuses)
    : undefined;
  return {
    tasks: data.tasks,
    boardNotes: data.boardNotes,
    events: data.events,
    ...(customStatuses ? { customStatuses } : {}),
  };
}

export async function loadData(profileId = null) {
  let localData = readLocalPayload(profileId);
  lastLoadPreferLocal = false;

  try {
    const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    const resp = await fetchCloudReadWithRetry(`/api/data${query}`, { credentials: 'same-origin' });
    if (resp.ok) {
      const cloudData = await resp.json();
      const safeCloudData = normalizeDataPayload(cloudData);
      const resolvedProfileId = typeof cloudData.activeProfileId === 'string' ? cloudData.activeProfileId : profileId;
      // Preserve local data whenever the cloud copy is empty/invalid, even for an
      // explicit profile, to avoid wiping unsynced local changes with an empty cloud.
      const localHasData = hasAnyData(localData);
      const cloudHasData = hasAnyData(safeCloudData);
      const shouldPreferLocal = localHasData && !cloudHasData;
      const effectiveData = shouldPreferLocal ? localData : safeCloudData;
      lastLoadPreferLocal = shouldPreferLocal;
      if (resolvedProfileId) {
        // When local wins over an empty cloud, record the real (empty) cloud snapshot
        // so the next saveData pushes local up instead of treating it as synced.
        lastCloudSnapshotByProfile.set(
          resolvedProfileId,
          clonePayload(shouldPreferLocal ? safeCloudData : effectiveData)
        );
      }
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
        preferredLocal: shouldPreferLocal,
      };
    }
    if (resp.status === 401) return { ...localData, authenticated: false, profiles: [], activeProfileId: profileId };
    // Sin backend real (p. ej. solo Vite): no fingir sesión en la nube.
    if (resp.status === 404 || resp.status === 405) {
      return { ...localData, authenticated: false, profiles: [], activeProfileId: profileId, cloudError: null };
    }
    console.warn("La nube respondió con error, manteniendo la sesión local:", resp.status);
    let cloudError = `Cloud sync read failed (${resp.status})`;
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') cloudError = data.error;
    } catch {
      // ignore non-json body
    }
    if (cloudError === `Cloud sync read failed (${resp.status})` && TRANSIENT_READ_STATUSES.has(resp.status)) {
      cloudError = 'la nube no está disponible temporalmente. Sigues trabajando en local y se reintentará automáticamente.';
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
      const previousSnapshot = lastCloudSnapshotByProfile.get(profileId) || null;
      const ops = previousSnapshot ? buildIncrementalOps(previousSnapshot, payload) : null;
      const requestBody = (ops && hasAnyOps(ops))
        ? { profileId, ops }
        : { profileId, payload };
      const resp = await fetch('/api/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(requestBody)
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        let message = text || `Sync HTTP ${resp.status}`;
        try {
          const data = JSON.parse(text);
          if (typeof data?.error === 'string') message = data.error;
        } catch {
          // keep text body
        }
        if (resp.status === 413) {
          message = message.includes('Límite') ? message : 'Los datos superan el límite permitido por el servidor.';
        }
        if (resp.status === 500 && (message === 'internal_error' || message.includes('internal_error'))) {
          message = 'Error del servidor al guardar. Inténtalo de nuevo más tarde.';
        }
        throw new Error(message || `Sync HTTP ${resp.status}`);
      }
      lastCloudSnapshotByProfile.set(profileId, clonePayload(payload));
    } catch (e) {
      console.warn("Error guardando en la nube:", e);
      throw e;
    }
  }
}
