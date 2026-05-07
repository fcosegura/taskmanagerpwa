const VALID_STATUS = new Set(['not_done', 'started', 'in_progress', 'blocked', 'done']);
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
    "connect-src 'self'",
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
  return (
    task &&
    typeof task === 'object' &&
    typeof task.id === 'string' &&
    typeof task.description === 'string' &&
    VALID_STATUS.has(task.status) &&
    VALID_PRIORITY.has(task.priority) &&
    (task.hideInKanbanDone === undefined || typeof task.hideInKanbanDone === 'boolean') &&
    Array.isArray(task.subtasks) &&
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
    typeof event.color === 'string'
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

function prepareTaskUpsert(env, profileId, userId, task) {
  return env.DB.prepare(
    "INSERT INTO tasks (id, user_id, profile_id, description, status, priority, category, date, time, subtasks, hide_in_kanban_done) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "description = excluded.description, status = excluded.status, priority = excluded.priority, category = excluded.category, " +
    "date = excluded.date, time = excluded.time, subtasks = excluded.subtasks, hide_in_kanban_done = excluded.hide_in_kanban_done, updated_at = CURRENT_TIMESTAMP " +
    "WHERE tasks.user_id = excluded.user_id AND tasks.profile_id = excluded.profile_id AND (" +
    "tasks.description IS NOT excluded.description OR tasks.status IS NOT excluded.status OR tasks.priority IS NOT excluded.priority OR " +
    "tasks.category IS NOT excluded.category OR tasks.date IS NOT excluded.date OR tasks.time IS NOT excluded.time OR " +
    "tasks.subtasks IS NOT excluded.subtasks OR tasks.hide_in_kanban_done IS NOT excluded.hide_in_kanban_done)"
  ).bind(
    scopedEntityId(profileId, task.id),
    userId,
    profileId,
    task.description,
    task.status,
    task.priority,
    task.category || null,
    task.date || null,
    task.time || null,
    JSON.stringify(task.subtasks || []),
    task.hideInKanbanDone ? 1 : 0
  );
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
  return env.DB.prepare(
    "INSERT INTO events (id, user_id, profile_id, title, startDate, endDate, color) VALUES (?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title = excluded.title, startDate = excluded.startDate, endDate = excluded.endDate, color = excluded.color, updated_at = CURRENT_TIMESTAMP " +
    "WHERE events.user_id = excluded.user_id AND events.profile_id = excluded.profile_id AND (" +
    "events.title IS NOT excluded.title OR events.startDate IS NOT excluded.startDate OR events.endDate IS NOT excluded.endDate OR events.color IS NOT excluded.color)"
  ).bind(
    scopedEntityId(profileId, event.id),
    userId,
    profileId,
    event.title,
    event.startDate,
    event.endDate || null,
    event.color || '#3b82f6'
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

function summarizeWorkspaceFallback(tasks, events) {
  const statusCounts = tasks.reduce((acc, task) => {
    const key = typeof task.status === 'string' ? task.status : 'not_done';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const overdue = tasks.filter((task) => task.status !== 'done' && typeof task.date === 'string' && task.date && task.date < new Date().toISOString().slice(0, 10)).length;
  const highPriorityPending = tasks
    .filter((task) => task.status !== 'done' && ['high', 'critical'].includes(task.priority))
    .slice(0, 5)
    .map((task) => task.description)
    .filter(Boolean);
  const summary = `Tienes ${tasks.length} tareas en este workspace. ${statusCounts.done || 0} completadas, ${statusCounts.blocked || 0} bloqueadas y ${overdue} vencidas.`;
  const actionPlan = [
    overdue > 0 ? `Resuelve primero ${overdue} tarea(s) vencidas.` : 'No hay tareas vencidas; prioriza las próximas fechas.',
    highPriorityPending.length > 0 ? `Enfócate en prioridades altas: ${highPriorityPending.slice(0, 2).join(' · ')}` : 'Define 1-2 tareas de alto impacto para hoy.',
    events.length > 0 ? `Coordina tus ${events.length} eventos del calendario con tareas clave.` : 'Reserva un bloque de tiempo para avanzar en tareas importantes.'
  ];
  return {
    summary,
    actionPlan,
    metrics: {
      totalTasks: tasks.length,
      completedTasks: statusCounts.done || 0,
      blockedTasks: statusCounts.blocked || 0,
      overdueTasks: overdue,
      events: events.length
    }
  };
}

async function generateWorkspaceSummaryWithAi(tasks, events, env) {
  if (!env?.AI?.run) return null;
  const compactTasks = tasks.slice(0, 25).map((task) => ({
    description: task.description,
    status: task.status,
    priority: task.priority,
    date: task.date || null,
    category: task.category || null
  }));
  const compactEvents = events.slice(0, 12).map((event) => ({
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate || null
  }));
  const prompt = [
    'Genera un resumen ejecutivo breve del workspace y un plan de accion concreto.',
    'Responde SOLO JSON valido con este formato exacto:',
    '{"summary":"string","actionPlan":["paso 1","paso 2","paso 3"],"metrics":{"focus":"string"}}',
    'summary maximo 240 caracteres.',
    'actionPlan debe tener 3 items maximo 120 caracteres cada uno.',
    `Tareas: ${JSON.stringify(compactTasks)}`,
    `Eventos: ${JSON.stringify(compactEvents)}`
  ].join('\n');
  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 220,
    temperature: 0.2
  });
  const raw = typeof result?.response === 'string' ? result.response.trim() : '';
  if (!raw) return null;
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    if (!parsed || typeof parsed !== 'object') return null;
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 240) : '';
    const actionPlan = Array.isArray(parsed.actionPlan)
      ? parsed.actionPlan.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim().slice(0, 120)).slice(0, 3)
      : [];
    if (!summary || actionPlan.length === 0) return null;
    return {
      summary,
      actionPlan,
      metrics: typeof parsed.metrics === 'object' && parsed.metrics ? parsed.metrics : {}
    };
  } catch {
    return null;
  }
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
        await ensureProfilesSchema(env);
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

        if (request.method === 'POST' && path === '/ai/workspace-summary') {
          const { results: tasks } = await env.DB.prepare(
            "SELECT description, status, priority, category, date FROM tasks WHERE user_id = ? AND profile_id = ?"
          ).bind(userId, profileId).all();
          const { results: events } = await env.DB.prepare(
            "SELECT title, startDate, endDate FROM events WHERE user_id = ? AND profile_id = ?"
          ).bind(userId, profileId).all();
          const fallbackSummary = summarizeWorkspaceFallback(tasks || [], events || []);
          try {
            const aiSummary = await generateWorkspaceSummaryWithAi(tasks || [], events || [], env);
            if (!aiSummary) return json({ ...fallbackSummary, source: 'fallback' });
            return json({
              ...fallbackSummary,
              summary: aiSummary.summary,
              actionPlan: aiSummary.actionPlan,
              source: 'ai'
            });
          } catch {
            return json({ ...fallbackSummary, source: 'fallback' });
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
            id: unscopedEntityId(profileId, t.id),
            hideInKanbanDone: Boolean(t.hide_in_kanban_done),
            subtasks: JSON.parse(t.subtasks || '[]')
          }));
          const parsedNotes = notes.map(({ created_at, updated_at, ...note }) => ({
            ...note,
            id: unscopedEntityId(profileId, note.id),
            createdAt: created_at,
            updatedAt: updated_at
          }));
          const parsedEvents = events.map((event) => ({
            ...event,
            id: unscopedEntityId(profileId, event.id)
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
              batch.push(prepareTaskUpsert(env, syncProfileId, userId, t));
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
              batch.push(prepareTaskUpsert(env, syncProfileId, userId, t));
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
