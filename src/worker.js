import {
  importDataEncryptionKey,
  encryptField,
  decryptField,
  stableStringify,
  sha256HexOfUtf8,
  buildTaskPlainSnapshot,
  buildNotePlainSnapshot,
  buildEventPlainSnapshot
} from './d1-field-crypto.js';

const VALID_STATUS = new Set(['not_done', 'started', 'in_progress', 'paused', 'blocked', 'done']);
const VALID_PRIORITY = new Set(['low', 'medium', 'high', 'critical']);
const SESSION_COOKIE = '__Host-taskmanager_session';
const LOCAL_SESSION_COOKIE = 'taskmanager_session';
const SESSION_MAX_AGE_SEC = 3600;
const MAX_SYNC_TASKS = 8000;
const MAX_SYNC_NOTES = 2000;
const MAX_SYNC_EVENTS = 4000;
const AI_RATE_WINDOW_SEC = 60;
const AI_RATE_MAX_PER_WINDOW = 48;
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com",
    "frame-src https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

function withSecurityHeaders(headers = {}) {
  return { ...SECURITY_HEADERS, ...headers };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: withSecurityHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {})
    })
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
}

function isLocalRequest(request) {
  const url = new URL(request.url);
  return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
}

function sessionCookie(value, request) {
  if (isLocalRequest(request)) {
    return `${LOCAL_SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; HttpOnly; SameSite=Lax`;
  }
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; HttpOnly; Secure; SameSite=Strict`;
}

function clearSessionCookie(request) {
  const localCookie = `${LOCAL_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  const secureCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
  return isLocalRequest(request) ? localCookie : secureCookie;
}

async function ensureSecuritySchema(env) {
  const safeExec = async (statement) => {
    try {
      await env.DB.prepare(statement).run();
    } catch {
      // ignore duplicate schema
    }
  };
  await safeExec(
    'CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)'
  );
  await safeExec('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
  await safeExec('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)');
  await safeExec(
    'CREATE TABLE IF NOT EXISTS ai_rate_limits (user_id TEXT PRIMARY KEY, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL DEFAULT 0)'
  );
}

function countSyncEntities(normalizedBody) {
  if (normalizedBody.mode === 'payload') {
    const p = normalizedBody.payload;
    return {
      tasks: p.tasks.length,
      notes: p.boardNotes.length,
      events: p.events.length
    };
  }
  const { tasks, notes, events } = normalizedBody.ops;
  return {
    tasks: tasks.upserts.length + tasks.deletes.length,
    notes: notes.upserts.length + notes.deletes.length,
    events: events.upserts.length + events.deletes.length
  };
}

function checkSyncLimits(normalizedBody) {
  const c = countSyncEntities(normalizedBody);
  if (c.tasks > MAX_SYNC_TASKS || c.notes > MAX_SYNC_NOTES || c.events > MAX_SYNC_EVENTS) {
    return {
      ok: false,
      error: `Límite de sincronización excedido (máx. ${MAX_SYNC_TASKS} tareas, ${MAX_SYNC_NOTES} notas, ${MAX_SYNC_EVENTS} eventos por solicitud).`
    };
  }
  return { ok: true };
}

async function consumeAiRateLimit(env, userId) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / AI_RATE_WINDOW_SEC) * AI_RATE_WINDOW_SEC;
  const row = await env.DB.prepare(
    'SELECT window_start, request_count FROM ai_rate_limits WHERE user_id = ?'
  ).bind(userId).first();

  if (!row || row.window_start < windowStart) {
    await env.DB.prepare(
      'INSERT INTO ai_rate_limits (user_id, window_start, request_count) VALUES (?, ?, 1) ' +
        'ON CONFLICT(user_id) DO UPDATE SET window_start = excluded.window_start, request_count = 1'
    ).bind(userId, windowStart).run();
    return null;
  }

  if (row.request_count >= AI_RATE_MAX_PER_WINDOW) {
    return json(
      { error: 'Demasiadas solicitudes de IA. Prueba de nuevo en un minuto.' },
      { status: 429 }
    );
  }

  await env.DB.prepare(
    'UPDATE ai_rate_limits SET request_count = request_count + 1 WHERE user_id = ?'
  ).bind(userId).run();
  return null;
}

async function shortHashForLog(value) {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    const bytes = new Uint8Array(digest);
    return [...bytes.slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'unknown';
  }
}

async function createOpaqueSession(env, userId) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, userId, expiresAt).run();
  return token;
}

async function pruneExpiredSessions(env) {
  const now = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  } catch {
    // ignore
  }
}

function getSessionTokenFromRequest(request) {
  return getCookie(request, SESSION_COOKIE) || getCookie(request, LOCAL_SESSION_COOKIE);
}

function isValidSessionTokenFormat(token) {
  return typeof token === 'string' && /^[0-9a-f]{64}$/i.test(token);
}

function isValidTask(task) {
  const taskName = typeof task?.name === 'string'
    ? task.name
    : (typeof task?.description === 'string' ? task.description : null);
  return (
    task &&
    typeof task === 'object' &&
    typeof task.id === 'string' &&
    typeof taskName === 'string' &&
    (task.ticketNumber === undefined || typeof task.ticketNumber === 'string') &&
    VALID_STATUS.has(task.status) &&
    VALID_PRIORITY.has(task.priority) &&
    (task.url === undefined || typeof task.url === 'string') &&
    (task.notes === undefined || typeof task.notes === 'string') &&
    (task.hideInKanbanDone === undefined || typeof task.hideInKanbanDone === 'boolean') &&
    (task.completedAt === undefined || task.completedAt === null || typeof task.completedAt === 'string') &&
    (task.completed_at === undefined || task.completed_at === null || typeof task.completed_at === 'string') &&
    Array.isArray(task.subtasks) &&
    (task.dependencyTaskIds === undefined || (
      Array.isArray(task.dependencyTaskIds) &&
      task.dependencyTaskIds.every((dependencyId) => typeof dependencyId === 'string')
    )) &&
    task.subtasks.every((st) => (
      st &&
      typeof st === 'object' &&
      typeof st.id === 'string' &&
      typeof st.text === 'string' &&
      typeof st.done === 'boolean'
    ))
  );
}

function isValidNote(note) {
  return (
    note &&
    typeof note === 'object' &&
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.text === 'string' &&
    (note.x === undefined || typeof note.x === 'number') &&
    (note.y === undefined || typeof note.y === 'number')
  );
}

function isValidEvent(event) {
  return (
    event &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    typeof event.title === 'string' &&
    typeof event.startDate === 'string' &&
    (event.endDate === undefined || event.endDate === null || typeof event.endDate === 'string') &&
    typeof event.color === 'string' &&
    (event.allDay === undefined || event.allDay === null || typeof event.allDay === 'boolean' || typeof event.allDay === 'number') &&
    (event.startTime === undefined || event.startTime === null || typeof event.startTime === 'string') &&
    (event.endTime === undefined || event.endTime === null || typeof event.endTime === 'string') &&
    (event.recurrenceFrequency === undefined || event.recurrenceFrequency === null || ['none', 'daily', 'weekly', 'monthly'].includes(event.recurrenceFrequency)) &&
    (event.recurrenceInterval === undefined || event.recurrenceInterval === null || (Number.isInteger(Number(event.recurrenceInterval)) && Number(event.recurrenceInterval) > 0)) &&
    (event.recurrenceUntil === undefined || event.recurrenceUntil === null || typeof event.recurrenceUntil === 'string') &&
    (event.recurrenceCount === undefined || event.recurrenceCount === null || (Number.isInteger(Number(event.recurrenceCount)) && Number(event.recurrenceCount) > 0))
  );
}

function isValidPayload(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.tasks) &&
    payload.tasks.every(isValidTask) &&
    Array.isArray(payload.boardNotes) &&
    payload.boardNotes.every(isValidNote) &&
    Array.isArray(payload.events) &&
    payload.events.every(isValidEvent)
  );
}

function normalizeSyncBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (isValidPayload(body)) {
    return { profileId: typeof body.profileId === 'string' ? body.profileId : null, mode: 'payload', payload: body };
  }
  if (body.payload && isValidPayload(body.payload)) {
    return { profileId: typeof body.profileId === 'string' ? body.profileId : null, mode: 'payload', payload: body.payload };
  }

  const isValidDeleteList = (list) => Array.isArray(list) && list.every((id) => typeof id === 'string');
  const isValidOpsGroup = (group, validator) => (
    group &&
    typeof group === 'object' &&
    Array.isArray(group.upserts) &&
    group.upserts.every(validator) &&
    isValidDeleteList(group.deletes)
  );

  if (body.ops && typeof body.ops === 'object') {
    const { tasks, notes, events } = body.ops;
    if (
      isValidOpsGroup(tasks, isValidTask) &&
      isValidOpsGroup(notes, isValidNote) &&
      isValidOpsGroup(events, isValidEvent)
    ) {
      return {
        profileId: typeof body.profileId === 'string' ? body.profileId : null,
        mode: 'ops',
        ops: { tasks, notes, events }
      };
    }
  }
  return null;
}

async function prepareTaskUpsert(env, dataKey, profileId, userId, task, taskSchema) {
  const taskName = typeof task?.name === 'string'
    ? task.name
    : (typeof task?.description === 'string' ? task.description : '');
  const hasName = Boolean(taskSchema?.hasName);
  const hasDescription = Boolean(taskSchema?.hasDescription);
  const hasUrl = Boolean(taskSchema?.hasUrl);
  const hasNotes = Boolean(taskSchema?.hasNotes);
  const hasTicketNumber = Boolean(taskSchema?.hasTicketNumber);
  const hasCompletedAt = Boolean(taskSchema?.hasCompletedAt);

  const subtasksJson = JSON.stringify(task.subtasks || []);
  const dependenciesJson = JSON.stringify(
    [...(task.dependencyTaskIds || [])].filter((x) => typeof x === 'string').sort()
  );
  const snapshot = buildTaskPlainSnapshot(task, taskSchema, taskName, subtasksJson, dependenciesJson);
  const contentHash = await sha256HexOfUtf8(stableStringify(snapshot));

  const columns = ['id', 'user_id', 'profile_id'];
  const placeholders = ['?', '?', '?'];
  const bindings = [
    scopedEntityId(profileId, task.id),
    userId,
    profileId
  ];
  const updates = [];

  if (hasName) {
    columns.push('name');
    placeholders.push('?');
    bindings.push(await encryptField(dataKey, taskName));
    updates.push('name = excluded.name');
  }
  if (hasDescription) {
    columns.push('description');
    placeholders.push('?');
    bindings.push(await encryptField(dataKey, taskName));
    updates.push('description = excluded.description');
  }
  if (hasUrl) {
    columns.push('url');
    placeholders.push('?');
    bindings.push(await encryptField(dataKey, task.url || null));
    updates.push('url = excluded.url');
  }
  if (hasNotes) {
    columns.push('notes');
    placeholders.push('?');
    bindings.push(await encryptField(dataKey, task.notes || null));
    updates.push('notes = excluded.notes');
  }
  if (hasTicketNumber) {
    columns.push('ticket_number');
    placeholders.push('?');
    const rawTk = typeof task.ticketNumber === 'string' ? task.ticketNumber.trim() : null;
    bindings.push(await encryptField(dataKey, rawTk));
    updates.push('ticket_number = excluded.ticket_number');
  }
  if (hasCompletedAt) {
    columns.push('completed_at');
    placeholders.push('?');
    const ca = typeof task.completedAt === 'string' && task.completedAt.trim()
      ? task.completedAt.trim()
      : (typeof task.completed_at === 'string' && task.completed_at.trim() ? task.completed_at.trim() : null);
    bindings.push(await encryptField(dataKey, ca || null));
    updates.push('completed_at = excluded.completed_at');
  }

  const encCategory = await encryptField(dataKey, task.category || null);
  const encDate = await encryptField(dataKey, task.date || null);
  const encTime = await encryptField(dataKey, task.time || null);
  const encSubtasks = await encryptField(dataKey, subtasksJson);
  const encDeps = await encryptField(dataKey, dependenciesJson);

  columns.push('status', 'priority', 'category', 'date', 'time', 'subtasks', 'dependencies', 'hide_in_kanban_done');
  placeholders.push('?', '?', '?', '?', '?', '?', '?', '?');
  bindings.push(
    task.status,
    task.priority,
    encCategory,
    encDate,
    encTime,
    encSubtasks,
    encDeps,
    task.hideInKanbanDone ? 1 : 0
  );
  updates.push(
    'status = excluded.status',
    'priority = excluded.priority',
    'category = excluded.category',
    'date = excluded.date',
    'time = excluded.time',
    'subtasks = excluded.subtasks',
    'dependencies = excluded.dependencies',
    'hide_in_kanban_done = excluded.hide_in_kanban_done',
    'updated_at = CURRENT_TIMESTAMP'
  );

  columns.push('content_hash');
  placeholders.push('?');
  bindings.push(contentHash);
  updates.push('content_hash = excluded.content_hash');

  const statement =
    `INSERT INTO tasks (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')} ` +
    'WHERE tasks.user_id = excluded.user_id AND tasks.profile_id = excluded.profile_id AND ' +
    '(tasks.content_hash IS NOT excluded.content_hash OR tasks.content_hash IS NULL)';
  return env.DB.prepare(statement).bind(...bindings);
}

async function prepareNoteUpsert(env, dataKey, profileId, userId, note) {
  const title = typeof note.title === 'string' ? note.title : '';
  const text = typeof note.text === 'string' ? note.text : '';
  const x = note.x || 0;
  const y = note.y || 0;
  const snap = buildNotePlainSnapshot({ title, text, x, y });
  const contentHash = await sha256HexOfUtf8(stableStringify(snap));
  const encTitle = await encryptField(dataKey, title);
  const encText = await encryptField(dataKey, text);
  return env.DB.prepare(
    "INSERT INTO notes (id, user_id, profile_id, title, text, x, y, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title = excluded.title, text = excluded.text, x = excluded.x, y = excluded.y, " +
    "content_hash = excluded.content_hash, updated_at = CURRENT_TIMESTAMP " +
    "WHERE notes.user_id = excluded.user_id AND notes.profile_id = excluded.profile_id AND (" +
    "notes.content_hash IS NOT excluded.content_hash OR notes.content_hash IS NULL)"
  ).bind(
    scopedEntityId(profileId, note.id),
    userId,
    profileId,
    encTitle,
    encText,
    x,
    y,
    contentHash
  );
}

async function prepareEventUpsert(env, dataKey, profileId, userId, event) {
  const allDay = event.allDay === false || event.allDay === 0 ? 0 : 1;
  const startTime = allDay === 0 && typeof event.startTime === 'string' && event.startTime ? event.startTime : null;
  const endTime = allDay === 0 && typeof event.endTime === 'string' && event.endTime ? event.endTime : null;
  const recurrenceFrequency = ['none', 'daily', 'weekly', 'monthly'].includes(event.recurrenceFrequency)
    ? event.recurrenceFrequency
    : 'none';
  const parsedRecurrenceInterval = Number.parseInt(String(event.recurrenceInterval ?? '1'), 10);
  const recurrenceInterval = Number.isFinite(parsedRecurrenceInterval) && parsedRecurrenceInterval > 0
    ? parsedRecurrenceInterval
    : 1;
  const recurrenceUntil = recurrenceFrequency === 'none'
    ? null
    : (typeof event.recurrenceUntil === 'string' && event.recurrenceUntil ? event.recurrenceUntil : null);
  const parsedRecurrenceCount = Number.parseInt(String(event.recurrenceCount ?? ''), 10);
  const recurrenceCount = recurrenceFrequency === 'none'
    ? null
    : (Number.isFinite(parsedRecurrenceCount) && parsedRecurrenceCount > 0 ? parsedRecurrenceCount : null);
  const endDate = event.endDate || null;
  const color = event.color || '#3b82f6';
  const norm = {
    allDay,
    color,
    endDate,
    endTime,
    recurrenceCount,
    recurrenceFrequency,
    recurrenceInterval,
    recurrenceUntil,
    startTime
  };
  const snap = buildEventPlainSnapshot(event, norm);
  const contentHash = await sha256HexOfUtf8(stableStringify(snap));
  const encTitle = await encryptField(dataKey, event.title);
  const encStartDate = await encryptField(dataKey, event.startDate);
  const encEndDate = await encryptField(dataKey, endDate);
  const encColor = await encryptField(dataKey, color);
  const encStartTime = await encryptField(dataKey, startTime);
  const encEndTime = await encryptField(dataKey, endTime);
  const encFreq = await encryptField(dataKey, recurrenceFrequency);
  const encUntil = await encryptField(dataKey, recurrenceUntil);
  const storedInterval = recurrenceFrequency === 'none' ? 1 : recurrenceInterval;
  return env.DB.prepare(
    "INSERT INTO events (id, user_id, profile_id, title, startDate, endDate, color, allDay, startTime, endTime, recurrenceFrequency, recurrenceInterval, recurrenceUntil, recurrenceCount, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title = excluded.title, startDate = excluded.startDate, endDate = excluded.endDate, color = excluded.color, " +
    "allDay = excluded.allDay, startTime = excluded.startTime, endTime = excluded.endTime, " +
    "recurrenceFrequency = excluded.recurrenceFrequency, recurrenceInterval = excluded.recurrenceInterval, recurrenceUntil = excluded.recurrenceUntil, recurrenceCount = excluded.recurrenceCount, " +
    "content_hash = excluded.content_hash, updated_at = CURRENT_TIMESTAMP " +
    "WHERE events.user_id = excluded.user_id AND events.profile_id = excluded.profile_id AND (" +
    "events.content_hash IS NOT excluded.content_hash OR events.content_hash IS NULL)"
  ).bind(
    scopedEntityId(profileId, event.id),
    userId,
    profileId,
    encTitle,
    encStartDate,
    encEndDate,
    encColor,
    allDay,
    encStartTime,
    encEndTime,
    encFreq,
    storedInterval,
    encUntil,
    recurrenceCount,
    contentHash
  );
}

async function ensureProfilesSchema(env) {
  const safeExec = async (statement, ...bindings) => {
    try {
      await env.DB.prepare(statement).bind(...bindings).run();
    } catch {
      // Keep schema bootstrap resilient across mixed DB versions.
    }
  };

  await safeExec("CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  await safeExec("CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id)");
  await safeExec("ALTER TABLE tasks ADD COLUMN profile_id TEXT");
  await safeExec("ALTER TABLE notes ADD COLUMN profile_id TEXT");
  await safeExec("ALTER TABLE events ADD COLUMN profile_id TEXT");
  await safeExec("CREATE INDEX IF NOT EXISTS idx_tasks_user_profile ON tasks(user_id, profile_id)");
  await safeExec("CREATE INDEX IF NOT EXISTS idx_notes_user_profile ON notes(user_id, profile_id)");
  await safeExec("CREATE INDEX IF NOT EXISTS idx_events_user_profile ON events(user_id, profile_id)");
  await safeExec("ALTER TABLE tasks ADD COLUMN hide_in_kanban_done INTEGER DEFAULT 0");
  await safeExec("ALTER TABLE tasks ADD COLUMN dependencies TEXT DEFAULT '[]'");
  await safeExec("ALTER TABLE tasks ADD COLUMN name TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN url TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN notes TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN ticket_number TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN completed_at TEXT");
  await safeExec("UPDATE tasks SET name = description WHERE name IS NULL");
  await safeExec("ALTER TABLE events ADD COLUMN allDay INTEGER DEFAULT 1");
  await safeExec("ALTER TABLE events ADD COLUMN startTime TEXT");
  await safeExec("ALTER TABLE events ADD COLUMN endTime TEXT");
  await safeExec("ALTER TABLE events ADD COLUMN recurrenceFrequency TEXT DEFAULT 'none'");
  await safeExec("ALTER TABLE events ADD COLUMN recurrenceInterval INTEGER DEFAULT 1");
  await safeExec("ALTER TABLE events ADD COLUMN recurrenceUntil TEXT");
  await safeExec("ALTER TABLE events ADD COLUMN recurrenceCount INTEGER");
  await safeExec("ALTER TABLE tasks ADD COLUMN content_hash TEXT");
  await safeExec("ALTER TABLE notes ADD COLUMN content_hash TEXT");
  await safeExec("ALTER TABLE events ADD COLUMN content_hash TEXT");

  const hasProfileColumn = async (tableName) => {
    try {
      const { results } = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
      return Array.isArray(results) && results.some((col) => col?.name === 'profile_id');
    } catch {
      return false;
    }
  };

  const tasksHasProfile = await hasProfileColumn('tasks');
  const notesHasProfile = await hasProfileColumn('notes');
  const eventsHasProfile = await hasProfileColumn('events');
  if (!tasksHasProfile || !notesHasProfile || !eventsHasProfile) {
    throw new Error('D1 schema mismatch: profile_id column missing in one or more tables.');
  }

  let taskColumns;
  try {
    const { results } = await env.DB.prepare("PRAGMA table_info(tasks)").all();
    taskColumns = Array.isArray(results) ? results.map((col) => col?.name).filter(Boolean) : [];
  } catch {
    taskColumns = [];
  }
  return {
    hasName: taskColumns.includes('name'),
    hasDescription: taskColumns.includes('description'),
    hasUrl: taskColumns.includes('url'),
    hasNotes: taskColumns.includes('notes'),
    hasTicketNumber: taskColumns.includes('ticket_number'),
    hasCompletedAt: taskColumns.includes('completed_at')
  };
}

async function ensureDefaultProfile(env, userId, dataKey) {
  const defaultProfileId = `${userId}:work`;
  const defaultNameEnc = await encryptField(dataKey, 'Trabajo');
  await env.DB.prepare(
    "INSERT OR IGNORE INTO profiles (id, user_id, name) VALUES (?, ?, ?)"
  ).bind(defaultProfileId, userId, defaultNameEnc).run();

  // Migrate legacy rows with NULL profile_id into default profile.
  await env.DB.batch([
    env.DB.prepare("UPDATE tasks SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId),
    env.DB.prepare("UPDATE notes SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId),
    env.DB.prepare("UPDATE events SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId)
  ]);

  return defaultProfileId;
}

async function resolveProfileId(env, userId, requestedProfileId, dataKey) {
  const defaultProfileId = await ensureDefaultProfile(env, userId, dataKey);
  if (!requestedProfileId) return defaultProfileId;
  const row = await env.DB.prepare(
    "SELECT id FROM profiles WHERE id = ? AND user_id = ?"
  ).bind(requestedProfileId, userId).first();
  return row?.id || defaultProfileId;
}

async function decryptProfileRows(dataKey, rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const p of rows) {
    out.push({
      ...p,
      name: await decryptField(dataKey, p.name)
    });
  }
  return out;
}

function sanitizeProfileName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ').slice(0, 40);
}

function buildProfileId(userId, name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';
  return `${userId}:${slug}:${Date.now().toString(36)}`;
}

function scopedEntityId(profileId, entityId) {
  if (typeof entityId !== 'string') return entityId;
  return `${profileId}::${entityId}`;
}

function unscopedEntityId(profileId, storedId) {
  if (typeof storedId !== 'string') return storedId;
  const prefix = `${profileId}::`;
  return storedId.startsWith(prefix) ? storedId.slice(prefix.length) : storedId;
}

function normalizePriority(priority) {
  if (typeof priority !== 'string') return 'medium';
  const cleaned = priority.toLowerCase().trim();
  if (['critical', 'critica', 'cr-itica', 'crítica'].includes(cleaned)) return 'critical';
  if (['high', 'alta', 'urgent', 'urgente'].includes(cleaned)) return 'high';
  if (['medium', 'media', 'normal'].includes(cleaned)) return 'medium';
  if (['low', 'baja'].includes(cleaned)) return 'low';
  return 'medium';
}

function extractTags(text) {
  if (typeof text !== 'string') return [];
  const tags = new Set();
  const lower = text.toLowerCase();
  if (/(cliente|meeting|reunion|reunión|equipo|trabajo)/.test(lower)) tags.add('trabajo');
  if (/(casa|hogar|familia|personal)/.test(lower)) tags.add('personal');
  if (/(salud|medico|medico|doctor|ejercicio)/.test(lower)) tags.add('salud');
  for (const match of text.matchAll(/#([a-z0-9_-]{2,20})/gi)) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags].slice(0, 5);
}

function stripNoise(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s,])(urgente|urgent|alta prioridad)(?=$|[\s,])/gi, ' ')
    .replace(/(^|[\s,])(prioridad|priority)\s*[:=-]?\s*(low|medium|high|critical|baja|media|alta)/gi, ' ')
    .trim();
}

function parseTaskFallback(input) {
  const text = (input || '').trim();
  const maxLen = 350;
  const truncated = text.length > maxLen ? text.slice(0, maxLen) : text;
  const lower = truncated.toLowerCase();
  const explicitPriority =
    /\b(urgente|urgent)\b/.test(lower) ? 'high' :
    (/\b(critical|critica|crítica)\b/.test(lower) ? 'critical' : null);
  const priorityMatch = lower.match(/\b(?:prioridad|priority)\s*[:=-]?\s*(low|medium|high|critical|baja|media|alta)\b/);
  const priority = normalizePriority(priorityMatch?.[1] || explicitPriority || 'medium');
  const title = stripNoise(truncated).replace(/[.,;:\- ]+$/g, '') || truncated || 'Nueva tarea';
  return {
    title: title.slice(0, 120),
    dueDate: null,
    priority,
    tags: extractTags(truncated)
  };
}

function sanitizeParsedTask(parsed, fallbackText) {
  const fb = parseTaskFallback(fallbackText);
  if (!parsed || typeof parsed !== 'object') return fb;
  const title =
    typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : fb.title;
  const dueDate = typeof parsed.dueDate === 'string' && parsed.dueDate.trim() ? parsed.dueDate.trim() : null;
  const priority = normalizePriority(parsed.priority || fb.priority);
  const tags = Array.isArray(parsed.tags)
    ? [...new Set(parsed.tags.filter((t) => typeof t === 'string').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 5)
    : fb.tags;
  return { title, dueDate, priority, tags };
}

async function parseTaskWithAi(input, env) {
  if (!env?.AI?.run) return null;
  const prompt = [
    'Extrae una tarea de texto libre y responde SOLO JSON valido.',
    'Formato exacto: {"title":"string","dueDate":"YYYY-MM-DDTHH:mm:ssZ|null","priority":"low|medium|high|critical","tags":["tag1"]}',
    'Si no hay fecha clara, usar null en dueDate.',
    `Texto: ${input}`
  ].join('\n');
  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 140,
    temperature: 0.1
  });
  const raw = typeof result?.response === 'string' ? result.response.trim() : '';
  if (!raw) return null;
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
  const maybeJson = raw.slice(jsonStart, jsonEnd + 1);
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

function parseDateInCurrentWeek(text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  const cleaned = text.toLowerCase();
  const explicitDate = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (explicitDate) return `${explicitDate[1]}-${explicitDate[2]}-${explicitDate[3]}`;

  const weekdays = new Map([
    ['domingo', 0],
    ['lunes', 1],
    ['martes', 2],
    ['miercoles', 3],
    ['miércoles', 3],
    ['jueves', 4],
    ['viernes', 5],
    ['sabado', 6],
    ['sábado', 6],
  ]);
  let requestedWeekday = null;
  for (const [word, value] of weekdays.entries()) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(cleaned)) {
      requestedWeekday = value;
      break;
    }
  }
  if (requestedWeekday === null) return '';

  const now = new Date();
  const currentWeekday = now.getDay();
  const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() + mondayOffset);
  const target = new Date(monday);
  const dayOffset = requestedWeekday === 0 ? 6 : requestedWeekday - 1;
  target.setDate(monday.getDate() + dayOffset);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

function parseMainTasksFallback(input) {
  if (typeof input !== 'string') return [];
  const tasksMatch = input.match(/(?:crear?|agregar?)\s+(?:tasks?|tareas?)\s+para\s+(.+?)(?:,|$)/i);
  if (tasksMatch?.[1]) {
    const rawMain = tasksMatch[1]
      .split(/(?:,|;|\sy\s|\sand\s)/i)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (rawMain.length > 0) {
      return rawMain.map((name, index) => ({
        ref: `main_${index + 1}`,
        name,
        date: parseDateInCurrentWeek(input),
        time: '',
        priority: 'medium',
        notes: '',
        category: ''
      }));
    }
  }

  const parsed = parseTaskFallback(input);
  return [{
    ref: 'main_1',
    name: parsed.title || 'Nueva tarea',
    date: parseDateInCurrentWeek(input),
    time: '',
    priority: parsed.priority || 'medium',
    notes: '',
    category: parsed.tags?.[0] || ''
  }];
}

function parseChildTasksFallback(input, mainTasks) {
  if (typeof input !== 'string') return [];
  const childMatch = input.match(/(?:subtareas?|subtasks?)\s+(?:para|de)\s+(?:tarea\s+)?(.+?)(?:\s*[:,-]\s*|\s+)(.+)$/i);
  if (childMatch?.[1] && childMatch?.[2]) {
    const parentHint = childMatch[1].trim().toLowerCase();
    const childName = childMatch[2].trim();
    const parentCandidate = mainTasks.find((task) => task.name.toLowerCase().includes(parentHint) || parentHint.includes(task.name.toLowerCase()));
    return [{
      name: childName,
      parentRef: parentCandidate?.ref || mainTasks[0]?.ref || 'main_1',
      date: '',
      time: '',
      priority: 'medium',
      notes: '',
      category: ''
    }];
  }

  const genericChildrenMatch = input.match(/(?:subtareas?|subtasks?)\s*[:,-]?\s*(.+)$/i);
  if (!genericChildrenMatch?.[1]) return [];
  return genericChildrenMatch[1]
    .split(/(?:,|;|\sy\s|\sand\s)/i)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((name) => ({
      name,
      parentRef: mainTasks[0]?.ref || 'main_1',
      date: '',
      time: '',
      priority: 'medium',
      notes: '',
      category: ''
    }));
}

function generateTaskPlanFallback(input) {
  const mainTasks = parseMainTasksFallback(input);
  const childTasks = parseChildTasksFallback(input, mainTasks);
  return { mainTasks, childTasks };
}

async function generateTasksFromTextWithAi(input, env) {
  if (!env?.AI?.run) return null;
  const prompt = [
    'Convierte texto libre en varias tareas principales y tareas hijas dependientes.',
    'Responde SOLO JSON valido.',
    'Formato exacto:',
    '{"mainTasks":[{"ref":"main_1","name":"string","date":"YYYY-MM-DD|","time":"HH:MM|","priority":"low|medium|high|critical","notes":"string","category":"string"}],"childTasks":[{"name":"string","parentRef":"main_1","date":"YYYY-MM-DD|","time":"HH:MM|","priority":"low|medium|high|critical","notes":"string","category":"string"}]}',
    'Si no hay fecha/hora clara, devolver string vacio.',
    'Si menciona subtareas, devolverlas como childTasks con parentRef.',
    'Maximo 8 mainTasks y 12 childTasks.',
    `Texto: ${input}`
  ].join('\n');
  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 420,
    temperature: 0.1
  });
  const raw = typeof result?.response === 'string' ? result.response.trim() : '';
  if (!raw) return null;
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeGeneratedTaskPlan(aiParsed, sourceText) {
  const fallback = generateTaskPlanFallback(sourceText);
  const inputMain = aiParsed && typeof aiParsed === 'object' && Array.isArray(aiParsed.mainTasks)
    ? aiParsed.mainTasks
    : fallback.mainTasks;
  const inputChildren = aiParsed && typeof aiParsed === 'object' && Array.isArray(aiParsed.childTasks)
    ? aiParsed.childTasks
    : fallback.childTasks;

  const normalizeMain = (item, fallbackName, fallbackRef) => {
    const rawDate = typeof item?.date === 'string' ? item.date.trim() : '';
    const derivedDate = rawDate || parseDateInCurrentWeek(sourceText);
    return {
      ref: typeof item?.ref === 'string' && item.ref.trim() ? item.ref.trim().slice(0, 30) : fallbackRef,
      name: typeof item?.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 120) : fallbackName,
      date: derivedDate || '',
      time: typeof item?.time === 'string' ? item.time.trim().slice(0, 5) : '',
      priority: normalizePriority(item?.priority),
      notes: typeof item?.notes === 'string' ? item.notes.trim().slice(0, 400) : '',
      category: typeof item?.category === 'string' ? item.category.trim().slice(0, 30) : '',
    };
  };

  const normalizeChild = (item, fallbackName, defaultParentRef) => ({
    name: typeof item?.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 120) : fallbackName,
    parentRef: typeof item?.parentRef === 'string' && item.parentRef.trim() ? item.parentRef.trim().slice(0, 30) : defaultParentRef,
    date: typeof item?.date === 'string' ? item.date.trim().slice(0, 10) : '',
    time: typeof item?.time === 'string' ? item.time.trim().slice(0, 5) : '',
    priority: normalizePriority(item?.priority),
    notes: typeof item?.notes === 'string' ? item.notes.trim().slice(0, 400) : '',
    category: typeof item?.category === 'string' ? item.category.trim().slice(0, 30) : '',
  });

  const mainTasks = inputMain
    .filter((item) => item && typeof item === 'object')
    .slice(0, 8)
    .map((item, index) => normalizeMain(item, `Tarea ${index + 1}`, `main_${index + 1}`))
    .filter((item) => item.name);
  if (mainTasks.length === 0) mainTasks.push(...fallback.mainTasks);
  const validRefs = new Set(mainTasks.map((item) => item.ref));
  const defaultParentRef = mainTasks[0]?.ref || 'main_1';
  const childTasks = inputChildren
    .filter((item) => item && typeof item === 'object')
    .slice(0, 12)
    .map((item, index) => normalizeChild(item, `Subtarea ${index + 1}`, defaultParentRef))
    .filter((item) => item.name)
    .map((item) => ({ ...item, parentRef: validRefs.has(item.parentRef) ? item.parentRef : defaultParentRef }));

  return { mainTasks, childTasks };
}

async function verifyGoogleToken(token, env) {
  if (!token) return null;
  const googleResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
  const info = await googleResp.json();
  if (!googleResp.ok || info.error) return null;
  if (info.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) return null;
  if (!info.exp || Number(info.exp) * 1000 <= Date.now()) return null;
  return info.sub || null;
}

async function authenticate(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  if (isValidSessionTokenFormat(token)) {
    const now = Math.floor(Date.now() / 1000);
    const row = await env.DB.prepare(
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?'
    ).bind(token, now).first();
    return row?.user_id || null;
  }
  return verifyGoogleToken(token, env);
}

export default {
  // Worker Version: 2026.05.13.2
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (!env?.DB) {
        return json({ error: 'D1 binding missing: DB is not configured in this environment.' }, { status: 500 });
      }

      await ensureSecuritySchema(env);

      if (request.method === 'POST' && url.pathname === '/api/login') {
        try {
          const { credential } = await request.json();
          const userId = await verifyGoogleToken(credential, env);
          if (!userId) return json({ error: 'Token inválido' }, { status: 401 });
          await pruneExpiredSessions(env);
          const sessionToken = await createOpaqueSession(env, userId);
          return json(
            { success: true },
            { headers: { 'Set-Cookie': sessionCookie(sessionToken, request) } }
          );
        } catch {
          return json({ error: 'Login inválido' }, { status: 400 });
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
        const token = getSessionTokenFromRequest(request);
        if (token && isValidSessionTokenFormat(token)) {
          try {
            await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
          } catch {
            // ignore
          }
        }
        return json(
          { success: true },
          { headers: { 'Set-Cookie': clearSessionCookie(request) } }
        );
      }

      const userId = await authenticate(request, env);
      if (!userId) return json({ error: 'No autorizado' }, { status: 401 });

      const path = url.pathname.replace('/api', '');
      
      try {
        if (request.method === 'GET' && path === '/session') {
          return json({ authenticated: true });
        }
        const taskSchema = await ensureProfilesSchema(env);
        const dataKey = await importDataEncryptionKey(env.DATA_ENCRYPTION_KEY);
        if (!dataKey) {
          return json({ error: 'data_encryption_misconfigured' }, { status: 500 });
        }
        const requestedProfileId = url.searchParams.get('profileId');
        const profileId = await resolveProfileId(env, userId, requestedProfileId, dataKey);

        if (request.method === 'POST' && path === '/ai/parse-task') {
          let body = null;
          try {
            body = await request.json();
          } catch {
            return json({ error: 'Body inválido' }, { status: 400 });
          }
          const text = typeof body?.text === 'string' ? body.text.trim() : '';
          if (!text) return json({ error: 'text es requerido' }, { status: 400 });
          if (text.length > 500) return json({ error: 'text demasiado largo (max 500)' }, { status: 400 });

          const rateLimited = await consumeAiRateLimit(env, userId);
          if (rateLimited) return rateLimited;

          const fallback = parseTaskFallback(text);
          try {
            const aiParsed = await parseTaskWithAi(text, env);
            if (!aiParsed) return json({ task: fallback, source: 'fallback' });
            return json({ task: sanitizeParsedTask(aiParsed, text), source: 'ai' });
          } catch {
            return json({ task: fallback, source: 'fallback' });
          }
        }

        if (request.method === 'POST' && path === '/ai/generate-tasks') {
          let body = null;
          try {
            body = await request.json();
          } catch {
            return json({ error: 'Body inválido' }, { status: 400 });
          }
          const text = typeof body?.text === 'string' ? body.text.trim() : '';
          if (!text) return json({ error: 'text es requerido' }, { status: 400 });
          if (text.length > 700) return json({ error: 'text demasiado largo (max 700)' }, { status: 400 });

          const rateLimited = await consumeAiRateLimit(env, userId);
          if (rateLimited) return rateLimited;

          const fallbackPlan = normalizeGeneratedTaskPlan(null, text);

          try {
            const aiPlan = await generateTasksFromTextWithAi(text, env);
            if (!aiPlan) {
              return json({
                mainTasks: fallbackPlan.mainTasks,
                childTasks: fallbackPlan.childTasks,
                source: 'fallback'
              });
            }
            const normalized = normalizeGeneratedTaskPlan(aiPlan, text);
            return json({
              mainTasks: normalized.mainTasks,
              childTasks: normalized.childTasks,
              source: 'ai'
            });
          } catch {
            return json({
              mainTasks: fallbackPlan.mainTasks,
              childTasks: fallbackPlan.childTasks,
              source: 'fallback'
            });
          }
        }

        if (request.method === 'POST' && path === '/profiles') {
          const body = await request.json();
          const name = sanitizeProfileName(body?.name);
          if (!name) return json({ error: 'Nombre de perfil inválido' }, { status: 400 });
          const newProfile = { id: buildProfileId(userId, name), name };
          const nameEnc = await encryptField(dataKey, newProfile.name);
          await env.DB.prepare(
            "INSERT INTO profiles (id, user_id, name) VALUES (?, ?, ?)"
          ).bind(newProfile.id, userId, nameEnc).run();
          return json({ profile: newProfile });
        }

        if (request.method === 'POST' && path === '/profiles/delete') {
          const body = await request.json();
          const targetProfileId = typeof body?.profileId === 'string' ? body.profileId : '';
          if (!targetProfileId) return json({ error: 'profileId inválido' }, { status: 400 });

          const { results: userProfiles } = await env.DB.prepare(
            "SELECT id, name, created_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
          ).bind(userId).all();

          const existing = userProfiles.find((p) => p.id === targetProfileId);
          if (!existing) {
            const { results: currentProfiles } = await env.DB.prepare(
              "SELECT id, name, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
            ).bind(userId).all();
            const fallbackProfileId = currentProfiles[0]?.id || null;
            const profilesOut = await decryptProfileRows(dataKey, currentProfiles);
            return json({ error: 'El workspace no existe.', profiles: profilesOut, activeProfileId: fallbackProfileId }, { status: 404 });
          }
          if (userProfiles.length <= 1) {
            return json({ error: 'No puedes borrar el único workspace.' }, { status: 400 });
          }

          await env.DB.batch([
            env.DB.prepare("DELETE FROM tasks WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
            env.DB.prepare("DELETE FROM notes WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
            env.DB.prepare("DELETE FROM events WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
            env.DB.prepare("DELETE FROM profiles WHERE user_id = ? AND id = ?").bind(userId, targetProfileId)
          ]);

          const { results: remainingProfiles } = await env.DB.prepare(
            "SELECT id, name, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
          ).bind(userId).all();

          const fallbackProfileId = remainingProfiles[0]?.id || null;
          const remainingOut = await decryptProfileRows(dataKey, remainingProfiles);
          return json({ success: true, profiles: remainingOut, activeProfileId: fallbackProfileId });
        }

        if (request.method === 'GET' && path === '/data') {
          const { results: profiles } = await env.DB.prepare(
            "SELECT id, name, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
          ).bind(userId).all();
          const { results: tasks } = await env.DB.prepare(
            "SELECT * FROM tasks WHERE user_id = ? AND profile_id = ?"
          ).bind(userId, profileId).all();
          const { results: notes } = await env.DB.prepare(
            "SELECT * FROM notes WHERE user_id = ? AND profile_id = ?"
          ).bind(userId, profileId).all();
          const { results: events } = await env.DB.prepare(
            "SELECT * FROM events WHERE user_id = ? AND profile_id = ?"
          ).bind(userId, profileId).all();

          const profilesOut = await decryptProfileRows(dataKey, profiles);

          const parsedTasks = [];
          for (const t of tasks || []) {
            const tr = { ...t };
            delete tr.content_hash;
            const nameDec = await decryptField(dataKey, tr.name);
            const descDec = tr.description != null ? await decryptField(dataKey, tr.description) : '';
            const nameOut = typeof nameDec === 'string' && nameDec !== ''
              ? nameDec
              : (typeof descDec === 'string' ? descDec : '');
            const urlOut = (await decryptField(dataKey, tr.url)) || '';
            const notesOut = (await decryptField(dataKey, tr.notes)) || '';
            const ticketOut = (await decryptField(dataKey, tr.ticket_number)) || '';
            const categoryOut = (await decryptField(dataKey, tr.category)) || null;
            const dateOut = (await decryptField(dataKey, tr.date)) || null;
            const timeOut = (await decryptField(dataKey, tr.time)) || null;
            const completedOut = (await decryptField(dataKey, tr.completed_at)) || '';
            const subRaw = await decryptField(dataKey, tr.subtasks || '[]');
            const depRaw = await decryptField(dataKey, tr.dependencies || '[]');
            let subtasks = [];
            let dependencyTaskIds = [];
            try {
              subtasks = JSON.parse(subRaw || '[]');
            } catch {
              subtasks = [];
            }
            try {
              dependencyTaskIds = JSON.parse(depRaw || '[]');
            } catch {
              dependencyTaskIds = [];
            }
            parsedTasks.push({
              ...tr,
              name: nameOut,
              url: typeof urlOut === 'string' ? urlOut : '',
              notes: typeof notesOut === 'string' ? notesOut : '',
              id: unscopedEntityId(profileId, tr.id),
              hideInKanbanDone: Boolean(tr.hide_in_kanban_done),
              subtasks,
              dependencyTaskIds,
              ticketNumber: typeof ticketOut === 'string' ? ticketOut : '',
              completedAt: typeof completedOut === 'string' && completedOut ? completedOut : '',
              category: categoryOut,
              date: dateOut,
              time: timeOut
            });
          }

          const parsedNotes = [];
          for (const note of notes || []) {
            const { created_at, updated_at, ...restIn } = note;
            const rest = { ...restIn };
            delete rest.content_hash;
            const titleDec = await decryptField(dataKey, rest.title);
            const textDec = await decryptField(dataKey, rest.text);
            parsedNotes.push({
              ...rest,
              title: typeof titleDec === 'string' ? titleDec : '',
              text: typeof textDec === 'string' ? textDec : '',
              id: unscopedEntityId(profileId, rest.id),
              createdAt: created_at,
              updatedAt: updated_at
            });
          }

          const parsedEvents = [];
          for (const event of events || []) {
            const { created_at, updated_at, ...evIn } = event;
            const ev = { ...evIn };
            delete ev.content_hash;
            const titleDec = await decryptField(dataKey, ev.title);
            const startDateDec = await decryptField(dataKey, ev.startDate);
            const endDateDec = await decryptField(dataKey, ev.endDate);
            const colorDec = await decryptField(dataKey, ev.color);
            const startTimeDec = await decryptField(dataKey, ev.startTime);
            const endTimeDec = await decryptField(dataKey, ev.endTime);
            const freqDec = await decryptField(dataKey, ev.recurrenceFrequency);
            const untilDec = await decryptField(dataKey, ev.recurrenceUntil);
            const freqStr = freqDec == null ? '' : String(freqDec);
            parsedEvents.push({
              ...ev,
              title: typeof titleDec === 'string' ? titleDec : '',
              startDate: typeof startDateDec === 'string' ? startDateDec : '',
              endDate: typeof endDateDec === 'string' ? endDateDec : '',
              color: typeof colorDec === 'string' ? colorDec : '#3b82f6',
              startTime: typeof startTimeDec === 'string' ? startTimeDec : '',
              endTime: typeof endTimeDec === 'string' ? endTimeDec : '',
              recurrenceFrequency: ['none', 'daily', 'weekly', 'monthly'].includes(freqStr)
                ? freqStr
                : 'none',
              recurrenceUntil: typeof untilDec === 'string' ? untilDec : '',
              id: unscopedEntityId(profileId, ev.id),
              createdAt: created_at,
              updatedAt: updated_at,
              allDay: ev.allDay === 0 || ev.allDay === false ? false : true,
              recurrenceInterval: Number.isFinite(Number(ev.recurrenceInterval)) && Number(ev.recurrenceInterval) > 0
                ? Number(ev.recurrenceInterval)
                : 1,
              recurrenceCount: Number.isFinite(Number(ev.recurrenceCount)) && Number(ev.recurrenceCount) > 0
                ? Number(ev.recurrenceCount)
                : null
            });
          }

          return json({
            tasks: parsedTasks,
            boardNotes: parsedNotes,
            events: parsedEvents,
            profiles: profilesOut,
            activeProfileId: profileId
          });
        }

        if (request.method === 'POST' && path === '/sync') {
          const syncStartedAt = Date.now();
          const body = await request.json();
          const normalizedBody = normalizeSyncBody(body);
          if (!normalizedBody) {
            return json({ error: 'Payload inválido' }, { status: 400 });
          }
          const limitCheck = checkSyncLimits(normalizedBody);
          if (!limitCheck.ok) {
            return json({ error: limitCheck.error }, { status: 413 });
          }
          const syncProfileId = await resolveProfileId(env, userId, normalizedBody.profileId, dataKey);
          const batch = [];
          let taskCount = 0;
          let noteCount = 0;
          let eventCount = 0;

          if (normalizedBody.mode === 'payload') {
            const { tasks, boardNotes, events } = normalizedBody.payload;
            taskCount = tasks.length;
            noteCount = boardNotes.length;
            eventCount = events.length;

            batch.push(
              env.DB.prepare("DELETE FROM tasks WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId),
              env.DB.prepare("DELETE FROM notes WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId),
              env.DB.prepare("DELETE FROM events WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId)
            );

            for (const t of tasks) {
              batch.push(await prepareTaskUpsert(env, dataKey, syncProfileId, userId, t, taskSchema));
            }
            for (const n of boardNotes) {
              batch.push(await prepareNoteUpsert(env, dataKey, syncProfileId, userId, n));
            }
            for (const e of events) {
              batch.push(await prepareEventUpsert(env, dataKey, syncProfileId, userId, e));
            }
          } else {
            const { tasks, notes, events } = normalizedBody.ops;
            taskCount = tasks.upserts.length + tasks.deletes.length;
            noteCount = notes.upserts.length + notes.deletes.length;
            eventCount = events.upserts.length + events.deletes.length;

            for (const taskId of tasks.deletes) {
              batch.push(
                env.DB.prepare("DELETE FROM tasks WHERE user_id = ? AND profile_id = ? AND id = ?")
                  .bind(userId, syncProfileId, scopedEntityId(syncProfileId, taskId))
              );
            }
            for (const noteId of notes.deletes) {
              batch.push(
                env.DB.prepare("DELETE FROM notes WHERE user_id = ? AND profile_id = ? AND id = ?")
                  .bind(userId, syncProfileId, scopedEntityId(syncProfileId, noteId))
              );
            }
            for (const eventId of events.deletes) {
              batch.push(
                env.DB.prepare("DELETE FROM events WHERE user_id = ? AND profile_id = ? AND id = ?")
                  .bind(userId, syncProfileId, scopedEntityId(syncProfileId, eventId))
              );
            }

            for (const t of tasks.upserts) {
              batch.push(await prepareTaskUpsert(env, dataKey, syncProfileId, userId, t, taskSchema));
            }
            for (const n of notes.upserts) {
              batch.push(await prepareNoteUpsert(env, dataKey, syncProfileId, userId, n));
            }
            for (const e of events.upserts) {
              batch.push(await prepareEventUpsert(env, dataKey, syncProfileId, userId, e));
            }
          }

          if (batch.length > 0) await env.DB.batch(batch);
          const userIdHash = await shortHashForLog(userId);
          console.log('[sync] write batch completed', {
            userIdHash,
            profileId: syncProfileId,
            mode: normalizedBody.mode,
            taskCount,
            noteCount,
            eventCount,
            statementCount: batch.length,
            elapsedMs: Date.now() - syncStartedAt
          });
          return json({ success: true, activeProfileId: syncProfileId });
        }
      } catch (err) {
        console.error('API error', path, err);
        return json({ error: 'internal_error' }, { status: 500 });
      }
    }

    // Modern Assets (2026): El Worker sirve los archivos de la carpeta assets configurada
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
