import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.js';

// Exercise the HTTP entry point against real SQL, including encryption, schema
// bootstrap, profile scoping, and the integration between extracted routes.
function createEnvironment(t) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  t.after(() => sql.close());
  const prepare = (query) => {
    const statement = sql.prepare(query);
    let args = [];
    const bound = {
      bind(...values) { args = values; return bound; },
      async run() { return statement.run(...args); },
      async first() { return statement.get(...args) || null; },
      async all() { return { results: statement.all(...args) }; },
    };
    return bound;
  };
  const token = 'a'.repeat(64);
  sql.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(token, 'user-a', Math.floor(Date.now() / 1000) + 3600);
  const jobs = [];
  const env = {
    DB: { prepare, async batch(statements) {
      sql.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sql.exec('COMMIT');
        return results;
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    } },
    DATA_ENCRYPTION_KEY: '11'.repeat(32),
    NOTES_AI_QUEUE: { async send(body) { jobs.push({ body }); }, async sendBatch(batch) { jobs.push(...batch); } },
    ASSETS: { async fetch() { return new Response('asset fallback'); } },
  };
  async function call(path, body, sessionToken = token) {
    return worker.fetch(new Request(`https://example.com/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Cookie': `__Host-taskmanager_session=${sessionToken}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), env, {});
  }
  return { sql, env, call, jobs };
}
const task = (id, name) => ({ id, name, status: 'not_done', priority: 'high', subtasks: [], dependencyTaskIds: [], plannedSlots: [] });
const empty = () => ({ tasks: [], boardNotes: [], events: [] });

test('Worker preserves encrypted full/delta sync and tenant isolation through extracted routes', async (t) => {
  const { call, sql, jobs } = createEnvironment(t);
  const note = { id: 'note-1', title: 'Privado', text: 'Contenido sensible', x: 1, y: 2 };
  const event = { id: 'event-1', title: 'Reunión', startDate: '2026-10-19', color: '#2563eb' };
  const response = await call('/sync', { profileId: 'user-a:work', payload: { tasks: [task('t1', 'Trabajo')], boardNotes: [note], events: [event] } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const stored = sql.prepare('SELECT id, name FROM tasks').get();
  assert.equal(stored.id, 'user-a:work::t1');
  assert.match(stored.name, /^v1\./);
  assert.notEqual(stored.name, 'Trabajo');
  const loaded = await (await call('/data?profileId=user-a%3Awork')).json();
  assert.equal(loaded.tasks[0].name, 'Trabajo');
  assert.equal(loaded.tasks[0].id, 't1');
  assert.equal(loaded.boardNotes[0].text, note.text);
  assert.equal(loaded.events[0].title, event.title);
  assert.ok(jobs.some(({ body }) => body.type === 'analyze' && body.noteId === note.id));

  const delta = await call('/sync', { profileId: 'user-a:work', ops: {
    tasks: { upserts: [task('t2', 'Siguiente')], deletes: ['t1'] },
    notes: { upserts: [], deletes: ['note-1'] },
    events: { upserts: [], deletes: ['event-1'] },
  } });
  assert.equal(delta.status, 200);
  const updated = await (await call('/data')).json();
  assert.deepEqual(updated.tasks.map(({ id }) => id), ['t2']);
  assert.deepEqual(updated.boardNotes, []);
  assert.deepEqual(updated.events, []);
  assert.ok(jobs.some(({ body }) => body.type === 'delete' && body.noteId === note.id));

  sql.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run('b'.repeat(64), 'user-b', Math.floor(Date.now() / 1000) + 3600);
  const other = await (await call('/data?profileId=user-a%3Awork', undefined, 'b'.repeat(64))).json();
  assert.equal(other.activeProfileId, 'user-b:work');
  assert.deepEqual(other.tasks, []);
});

test('Worker keeps profile CRUD, custom statuses and last-workspace protection', async (t) => {
  const { call } = createEnvironment(t);
  const created = await (await call('/profiles', { name: 'Personal' })).json();
  assert.equal(created.profile.name, 'Personal');
  const id = created.profile.id;
  const statuses = [{ v: 'review', label: 'Revisión', kind: 'active', canBeFocused: true }];
  assert.equal((await call('/profiles/update', { profileId: id, customStatuses: statuses })).status, 200);
  assert.equal((await call('/sync', { profileId: id, payload: { ...empty(), tasks: [task('personal', 'Personal')] } })).status, 200);
  const loaded = await (await call(`/data?profileId=${encodeURIComponent(id)}`)).json();
  assert.equal(loaded.tasks[0].id, 'personal');
  assert.deepEqual(loaded.profiles.find((p) => p.id === id).customStatuses, statuses);
  assert.equal((await call('/profiles/delete', { profileId: id })).status, 200);
  assert.equal((await call('/profiles/delete', { profileId: 'user-a:work' })).status, 400);
});

test('Worker preserves auth boundaries, logout revocation and security headers', async (t) => {
  const { call } = createEnvironment(t);
  assert.equal((await call('/session')).status, 200);
  assert.equal((await call('/session', undefined, 'c'.repeat(64))).status, 401);
  const loggedOut = await call('/logout', {});
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.get('Set-Cookie'), /Max-Age=0; HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await call('/session')).status, 401);
});

test('Worker rejects malformed sync and keeps deterministic task AI fallback and rate limit', async (t) => {
  const { call, sql } = createEnvironment(t);
  assert.equal((await call('/sync', { tasks: [{}] })).status, 400);
  const parsed = await (await call('/ai/parse-task', { text: 'Preparar informe importante' })).json();
  assert.equal(parsed.source, 'fallback');
  assert.equal(typeof parsed.task.title, 'string');
  assert.equal((await call('/ai/parse-task', { text: '' })).status, 400);
  const generated = await (await call('/ai/generate-tasks', { text: 'Preparar informe y revisar datos' })).json();
  assert.equal(generated.source, 'fallback');
  assert.ok(generated.mainTasks.length > 0);
  const daily = await (await call('/ai/daily-status', {
    days: 2, activities: [{ name: 'Informe', currentStatus: 'in_progress' }],
  })).json();
  assert.equal(daily.source, 'fallback');
  assert.match(daily.report, /Hoy/);
  sql.prepare('UPDATE ai_rate_limits SET request_count = 48 WHERE user_id = ?').run('user-a');
  assert.equal((await call('/ai/parse-task', { text: 'Otra tarea' })).status, 429);
});


test('Worker preserves Note AI route dispatch and disabled-feature responses', async (t) => {
  const { call } = createEnvironment(t);
  const meta = await (await call('/notes/ai')).json();
  assert.deepEqual(meta.meta, []);
  const search = await (await call('/notes/search', { query: 'informe', prefs: { semanticSearch: false } })).json();
  assert.equal(search.source, 'disabled');
  const duplicates = await (await call('/notes/duplicates', { prefs: { duplicates: false } })).json();
  assert.equal(duplicates.source, 'disabled');
  const organize = await (await call('/notes/organize', { prefs: { organizeBoard: false } })).json();
  assert.equal(organize.source, 'disabled');
  const chat = await (await call('/notes/chat', { question: '¿Qué tengo pendiente?', prefs: { ragChat: false } })).json();
  assert.equal(chat.source, 'disabled');
});
