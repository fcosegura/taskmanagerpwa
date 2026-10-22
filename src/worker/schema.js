const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Evita ejecutar las migraciones (decenas de DDL) en cada request, que dispara
 * la carga sobre D1 (causa probable de 503 intermitentes). Revalida cada TTL.
 */
function createSchemaCache(runner) {
  let cached = null;
  return async function ensureSchema(env) {
    const now = Date.now();
    if (cached && now - cached.at < SCHEMA_CACHE_TTL_MS) {
      return cached.value;
    }
    const entry = { at: now, value: null };
    entry.value = (async () => {
      const value = await runner(env);
      entry.at = Date.now();
      return value;
    })();
    cached = entry;
    try {
      return await entry.value;
    } catch (error) {
      if (cached === entry) cached = null;
      throw error;
    }
  };
}

export const ensureSecuritySchema = createSchemaCache(async (env) => {
  const safeExec = async (statement) => {
    try {
      await env.DB.prepare(statement).run();
    } catch (err) {
      const msg = err?.message || String(err);
      if (!msg.toLowerCase().includes('already exists') && !msg.toLowerCase().includes('duplicate column')) {
        console.warn('Schema migration warning:', msg);
      }
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
});

export const ensureProfilesSchema = createSchemaCache(async (env) => {
  const safeExec = async (statement, ...bindings) => {
    try {
      await env.DB.prepare(statement).bind(...bindings).run();
    } catch (err) {
      // Keep schema bootstrap resilient across mixed DB versions.
      const msg = err?.message || String(err);
      if (!msg.toLowerCase().includes('already exists') && !msg.toLowerCase().includes('duplicate column')) {
        console.warn('Schema migration warning:', msg);
      }
    }
  };

  await safeExec("CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, custom_statuses TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  await safeExec("CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id)");
  await safeExec("ALTER TABLE profiles ADD COLUMN custom_statuses TEXT");
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
  await safeExec("ALTER TABLE notes ADD COLUMN kind TEXT DEFAULT 'quick'");
  await safeExec("ALTER TABLE events ADD COLUMN content_hash TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN planned_slots TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN status_log TEXT");
  await safeExec("ALTER TABLE tasks ADD COLUMN end_date TEXT");

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
    hasCompletedAt: taskColumns.includes('completed_at'),
    hasStatusLog: taskColumns.includes('status_log'),
    hasEndDate: taskColumns.includes('end_date')
  };
});
