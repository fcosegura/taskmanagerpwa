const VALID_STATUS = new Set(['not_done', 'started', 'in_progress', 'paused', 'blocked', 'done']);
const VALID_PRIORITY = new Set(['low', 'medium', 'high', 'critical']);
const SESSION_COOKIE = '__Host-taskmanager_session';
const LOCAL_SESSION_COOKIE = 'taskmanager_session';
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
    return `${LOCAL_SESSION_COOKIE}=${value}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`;
  }
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Strict`;
}

function clearSessionCookie(request) {
  const localCookie = `${LOCAL_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  const secureCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
  return isLocalRequest(request) ? localCookie : secureCookie;
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

function prepareTaskUpsert(env, profileId, userId, task, taskSchema) {
  const taskName = typeof task?.name === 'string'
    ? task.name
    : (typeof task?.description === 'string' ? task.description : '');
  const hasName = Boolean(taskSchema?.hasName);
  const hasDescription = Boolean(taskSchema?.hasDescription);
  const hasUrl = Boolean(taskSchema?.hasUrl);
  const hasNotes = Boolean(taskSchema?.hasNotes);
  const hasTicketNumber = Boolean(taskSchema?.hasTicketNumber);
  const hasCompletedAt = Boolean(taskSchema?.hasCompletedAt);

  const columns = ['id', 'user_id', 'profile_id'];
  const placeholders = ['?', '?', '?'];
  const bindings = [
    scopedEntityId(profileId, task.id),
    userId,
    profileId
  ];
  const updates = [];
  const changeChecks = [];

  if (hasName) {
    columns.push('name');
    placeholders.push('?');
    bindings.push(taskName);
    updates.push('name = excluded.name');
    changeChecks.push('tasks.name IS NOT excluded.name');
  }
  if (hasDescription) {
    // Legacy compatibility: keep description in sync when the old column still exists.
    columns.push('description');
    placeholders.push('?');
    bindings.push(taskName);
    updates.push('description = excluded.description');
    changeChecks.push('tasks.description IS NOT excluded.description');
  }
  if (hasUrl) {
    columns.push('url');
    placeholders.push('?');
    bindings.push(task.url || null);
    updates.push('url = excluded.url');
    changeChecks.push('tasks.url IS NOT excluded.url');
  }
  if (hasNotes) {
    columns.push('notes');
    placeholders.push('?');
    bindings.push(task.notes || null);
    updates.push('notes = excluded.notes');
    changeChecks.push('tasks.notes IS NOT excluded.notes');
  }
  if (hasTicketNumber) {
    columns.push('ticket_number');
    placeholders.push('?');
    bindings.push(typeof task.ticketNumber === 'string' ? task.ticketNumber.trim() : null);
    updates.push('ticket_number = excluded.ticket_number');
    changeChecks.push('tasks.ticket_number IS NOT excluded.ticket_number');
  }
  if (hasCompletedAt) {
    columns.push('completed_at');
    placeholders.push('?');
    const ca = typeof task.completedAt === 'string' && task.completedAt.trim()
      ? task.completedAt.trim()
      : (typeof task.completed_at === 'string' && task.completed_at.trim() ? task.completed_at.trim() : null);
    bindings.push(ca || null);
    updates.push('completed_at = excluded.completed_at');
    changeChecks.push('tasks.completed_at IS NOT excluded.completed_at');
  }

  columns.push('status', 'priority', 'category', 'date', 'time', 'subtasks', 'dependencies', 'hide_in_kanban_done');
  placeholders.push('?', '?', '?', '?', '?', '?', '?', '?');
  bindings.push(
    task.status,
    task.priority,
    task.category || null,
    task.date || null,
    task.time || null,
    JSON.stringify(task.subtasks || []),
    JSON.stringify(task.dependencyTaskIds || []),
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
  changeChecks.push(
    'tasks.status IS NOT excluded.status',
    'tasks.priority IS NOT excluded.priority',
    'tasks.category IS NOT excluded.category',
    'tasks.date IS NOT excluded.date',
    'tasks.time IS NOT excluded.time',
    'tasks.subtasks IS NOT excluded.subtasks',
    'tasks.dependencies IS NOT excluded.dependencies',
    'tasks.hide_in_kanban_done IS NOT excluded.hide_in_kanban_done'
  );

  const statement =
    `INSERT INTO tasks (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')} ` +
    `WHERE tasks.user_id = excluded.user_id AND tasks.profile_id = excluded.profile_id AND (${changeChecks.join(' OR ')})`;
  return env.DB.prepare(statement).bind(...bindings);
}

function prepareNoteUpsert(env, profileId, userId, note) {
  return env.DB.prepare(
    "INSERT INTO notes (id, user_id, profile_id, title, text, x, y) VALUES (?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title = excluded.title, text = excluded.text, x = excluded.x, y = excluded.y, updated_at = CURRENT_TIMESTAMP " +
    "WHERE notes.user_id = excluded.user_id AND notes.profile_id = excluded.profile_id AND (" +
    "notes.title IS NOT excluded.title OR notes.text IS NOT excluded.text OR notes.x IS NOT excluded.x OR notes.y IS NOT excluded.y)"
  ).bind(
    scopedEntityId(profileId, note.id),
    userId,
    profileId,
    note.title || '',
    note.text || '',
    note.x || 0,
    note.y || 0
  );
}

function prepareEventUpsert(env, profileId, userId, event) {
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
  return env.DB.prepare(
    "INSERT INTO events (id, user_id, profile_id, title, startDate, endDate, color, allDay, startTime, endTime, recurrenceFrequency, recurrenceInterval, recurrenceUntil, recurrenceCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title = excluded.title, startDate = excluded.startDate, endDate = excluded.endDate, color = excluded.color, " +
    "allDay = excluded.allDay, startTime = excluded.startTime, endTime = excluded.endTime, " +
    "recurrenceFrequency = excluded.recurrenceFrequency, recurrenceInterval = excluded.recurrenceInterval, recurrenceUntil = excluded.recurrenceUntil, recurrenceCount = excluded.recurrenceCount, " +
    "updated_at = CURRENT_TIMESTAMP " +
    "WHERE events.user_id = excluded.user_id AND events.profile_id = excluded.profile_id AND (" +
    "events.title IS NOT excluded.title OR events.startDate IS NOT excluded.startDate OR events.endDate IS NOT excluded.endDate OR " +
    "events.color IS NOT excluded.color OR events.allDay IS NOT excluded.allDay OR " +
    "events.startTime IS NOT excluded.startTime OR events.endTime IS NOT excluded.endTime OR " +
    "events.recurrenceFrequency IS NOT excluded.recurrenceFrequency OR events.recurrenceInterval IS NOT excluded.recurrenceInterval OR " +
    "events.recurrenceUntil IS NOT excluded.recurrenceUntil OR events.recurrenceCount IS NOT excluded.recurrenceCount)"
  ).bind(
    scopedEntityId(profileId, event.id),
    userId,
    profileId,
    event.title,
    event.startDate,
    event.endDate || null,
    event.color || '#3b82f6',
    allDay,
    startTime,
    endTime,
    recurrenceFrequency,
    recurrenceFrequency === 'none' ? 1 : recurrenceInterval,
    recurrenceUntil,
    recurrenceCount
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

async function ensureDefaultProfile(env, userId) {
  const defaultProfileId = `${userId}:work`;
  await env.DB.prepare(
    "INSERT OR IGNORE INTO profiles (id, user_id, name) VALUES (?, ?, ?)"
  ).bind(defaultProfileId, userId, 'Trabajo').run();

  // Migrate legacy rows with NULL profile_id into default profile.
  await env.DB.batch([
    env.DB.prepare("UPDATE tasks SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId),
    env.DB.prepare("UPDATE notes SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId),
    env.DB.prepare("UPDATE events SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId)
  ]);

  return defaultProfileId;
}

async function resolveProfileId(env, userId, requestedProfileId) {
  const defaultProfileId = await ensureDefaultProfile(env, userId);
  if (!requestedProfileId) return defaultProfileId;
  const row = await env.DB.prepare(
    "SELECT id FROM profiles WHERE id = ? AND user_id = ?"
  ).bind(requestedProfileId, userId).first();
  return row?.id || defaultProfileId;
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
  const token = getCookie(request, SESSION_COOKIE) || getCookie(request, LOCAL_SESSION_COOKIE);
  return verifyGoogleToken(token, env);
}

export default {
  // Worker Version: 2026.05.05.1
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (!env?.DB) {
        return json({ error: 'D1 binding missing: DB is not configured in this environment.' }, { status: 500 });
      }

      if (request.method === 'POST' && url.pathname === '/api/login') {
        try {
          const { credential } = await request.json();
          const userId = await verifyGoogleToken(credential, env);
          if (!userId) return json({ error: 'Token inválido' }, { status: 401 });
          return json(
            { success: true },
            { headers: { 'Set-Cookie': sessionCookie(credential, request) } }
          );
        } catch {
          return json({ error: 'Login inválido' }, { status: 400 });
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
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
        const requestedProfileId = url.searchParams.get('profileId');
        const profileId = await resolveProfileId(env, userId, requestedProfileId);

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
          await env.DB.prepare(
            "INSERT INTO profiles (id, user_id, name) VALUES (?, ?, ?)"
          ).bind(newProfile.id, userId, newProfile.name).run();
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
            return json({ error: 'El workspace no existe.', profiles: currentProfiles, activeProfileId: fallbackProfileId }, { status: 404 });
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
          return json({ success: true, profiles: remainingProfiles, activeProfileId: fallbackProfileId });
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
          
          const parsedTasks = tasks.map((t) => ({
            ...t,
            name: typeof t.name === 'string' ? t.name : (typeof t.description === 'string' ? t.description : ''),
            url: typeof t.url === 'string' ? t.url : '',
            notes: typeof t.notes === 'string' ? t.notes : '',
            id: unscopedEntityId(profileId, t.id),
            hideInKanbanDone: Boolean(t.hide_in_kanban_done),
            subtasks: JSON.parse(t.subtasks || '[]'),
            dependencyTaskIds: JSON.parse(t.dependencies || '[]'),
            ticketNumber: typeof t.ticket_number === 'string' ? t.ticket_number : '',
            completedAt: typeof t.completed_at === 'string' && t.completed_at ? t.completed_at : ''
          }));
          const parsedNotes = notes.map(({ created_at, updated_at, ...note }) => ({
            ...note,
            id: unscopedEntityId(profileId, note.id),
            createdAt: created_at,
            updatedAt: updated_at
          }));
          const parsedEvents = events.map(({ created_at, updated_at, ...event }) => ({
            ...event,
            id: unscopedEntityId(profileId, event.id),
            createdAt: created_at,
            updatedAt: updated_at,
            allDay: event.allDay === 0 || event.allDay === false ? false : true,
            startTime: typeof event.startTime === 'string' ? event.startTime : '',
            endTime: typeof event.endTime === 'string' ? event.endTime : '',
            recurrenceFrequency: ['none', 'daily', 'weekly', 'monthly'].includes(event.recurrenceFrequency)
              ? event.recurrenceFrequency
              : 'none',
            recurrenceInterval: Number.isFinite(Number(event.recurrenceInterval)) && Number(event.recurrenceInterval) > 0
              ? Number(event.recurrenceInterval)
              : 1,
            recurrenceUntil: typeof event.recurrenceUntil === 'string' ? event.recurrenceUntil : '',
            recurrenceCount: Number.isFinite(Number(event.recurrenceCount)) && Number(event.recurrenceCount) > 0
              ? Number(event.recurrenceCount)
              : null,
          }));
          return json({ tasks: parsedTasks, boardNotes: parsedNotes, events: parsedEvents, profiles, activeProfileId: profileId });
        }

        if (request.method === 'POST' && path === '/sync') {
          const syncStartedAt = Date.now();
          const body = await request.json();
          const normalizedBody = normalizeSyncBody(body);
          if (!normalizedBody) {
            return json({ error: 'Payload inválido' }, { status: 400 });
          }
          const syncProfileId = await resolveProfileId(env, userId, normalizedBody.profileId);
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
              batch.push(prepareTaskUpsert(env, syncProfileId, userId, t, taskSchema));
            }
            for (const n of boardNotes) {
              batch.push(prepareNoteUpsert(env, syncProfileId, userId, n));
            }
            for (const e of events) {
              batch.push(prepareEventUpsert(env, syncProfileId, userId, e));
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
              batch.push(prepareTaskUpsert(env, syncProfileId, userId, t, taskSchema));
            }
            for (const n of notes.upserts) {
              batch.push(prepareNoteUpsert(env, syncProfileId, userId, n));
            }
            for (const e of events.upserts) {
              batch.push(prepareEventUpsert(env, syncProfileId, userId, e));
            }
          }

          if (batch.length > 0) await env.DB.batch(batch);
          console.log('[sync] write batch completed', {
            userId,
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
        return json({ error: err.message }, { status: 500 });
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
