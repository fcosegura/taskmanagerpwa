const VALID_STATUS = new Set(['not_done', 'started', 'in_progress', 'blocked', 'done']);
const VALID_PRIORITY = new Set(['low', 'medium', 'high', 'critical']);

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
}

function isValidTask(task) {
  return (
    task &&
    typeof task === 'object' &&
    typeof task.id === 'string' &&
    typeof task.description === 'string' &&
    VALID_STATUS.has(task.status) &&
    VALID_PRIORITY.has(task.priority) &&
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

export default {
  // Worker Version: 2026.05.05.1
  async fetch(request, env) {
    const url = new URL(request.url);

    // Lógica de la API (D1)
    if (url.pathname.startsWith('/api/')) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return json({ error: 'No autorizado' }, { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      let userId;
      
      try {
        const googleResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const info = await googleResp.json();
        if (!googleResp.ok || info.error) return json({ error: 'Token inválido' }, { status: 401 });
        
        // FIX CRÍTICO: Verificar que el token sea para TU app
        if (info.aud !== env.GOOGLE_CLIENT_ID) {
          return json({ error: 'Audience mismatch' }, { status: 401 });
        }

        userId = info.sub;
      } catch {
        return json({ error: 'Error de autenticación' }, { status: 500 });
      }

      const path = url.pathname.replace('/api', '');
      
      try {
        if (request.method === 'GET' && path === '/data') {
          const { results: tasks } = await env.DB.prepare("SELECT * FROM tasks WHERE user_id = ?").bind(userId).all();
          const { results: notes } = await env.DB.prepare("SELECT * FROM notes WHERE user_id = ?").bind(userId).all();
          const { results: events } = await env.DB.prepare("SELECT * FROM events WHERE user_id = ?").bind(userId).all();
          
          const parsedTasks = tasks.map(t => ({ ...t, subtasks: JSON.parse(t.subtasks || '[]') }));
          const parsedNotes = notes.map(({ created_at, updated_at, ...note }) => ({
            ...note,
            createdAt: created_at,
            updatedAt: updated_at
          }));
          return json({ tasks: parsedTasks, boardNotes: parsedNotes, events });
        }

        if (request.method === 'POST' && path === '/sync') {
          const payload = await request.json();
          if (!isValidPayload(payload)) {
            return json({ error: 'Payload inválido' }, { status: 400 });
          }

          const { tasks, boardNotes, events } = payload;
          const batch = [
            env.DB.prepare("DELETE FROM tasks WHERE user_id = ?").bind(userId),
            env.DB.prepare("DELETE FROM notes WHERE user_id = ?").bind(userId),
            env.DB.prepare("DELETE FROM events WHERE user_id = ?").bind(userId)
          ];

          for (const t of tasks) {
            batch.push(env.DB.prepare("INSERT INTO tasks (id, user_id, description, status, priority, category, date, time, subtasks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
              .bind(t.id, userId, t.description, t.status, t.priority, t.category || null, t.date || null, t.time || null, JSON.stringify(t.subtasks || [])));
          }
          for (const n of boardNotes) {
            batch.push(env.DB.prepare("INSERT INTO notes (id, user_id, title, text, x, y) VALUES (?, ?, ?, ?, ?, ?)")
              .bind(n.id, userId, n.title || '', n.text || '', n.x || 0, n.y || 0));
          }
          for (const e of events) {
            batch.push(env.DB.prepare("INSERT INTO events (id, user_id, title, startDate, endDate, color) VALUES (?, ?, ?, ?, ?, ?)")
              .bind(e.id, userId, e.title, e.startDate, e.endDate || null, e.color || '#3b82f6'));
          }

          await env.DB.batch(batch);
          return json({ success: true });
        }
      } catch (err) {
        return json({ error: err.message }, { status: 500 });
      }
    }

    // Modern Assets (2026): El Worker sirve los archivos de la carpeta assets configurada
    return env.ASSETS.fetch(request);
  }
};
