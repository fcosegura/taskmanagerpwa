export default {
  // Worker Version: 2026.05.05.1
  async fetch(request, env) {
    const url = new URL(request.url);

    // Lógica de la API (D1)
    if (url.pathname.startsWith('/api/')) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      let userId;
      
      try {
        const googleResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const info = await googleResp.json();
        if (!googleResp.ok || info.error) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401 });
        userId = info.sub;
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Error de autenticación' }), { status: 500 });
      }

      const path = url.pathname.replace('/api', '');
      
      try {
        if (request.method === 'GET' && path === '/data') {
          const { results: tasks } = await env.DB.prepare("SELECT * FROM tasks WHERE user_id = ?").bind(userId).all();
          const { results: notes } = await env.DB.prepare("SELECT * FROM notes WHERE user_id = ?").bind(userId).all();
          const { results: events } = await env.DB.prepare("SELECT * FROM events WHERE user_id = ?").bind(userId).all();
          
          const parsedTasks = tasks.map(t => ({ ...t, subtasks: JSON.parse(t.subtasks || '[]') }));
          return new Response(JSON.stringify({ tasks: parsedTasks, boardNotes: notes, events: events }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (request.method === 'POST' && path === '/sync') {
          const { tasks, boardNotes, events } = await request.json();
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
          return new Response(JSON.stringify({ success: true }));
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // Modern Assets (2026): El Worker sirve los archivos de la carpeta assets configurada
    return env.ASSETS.fetch(request);
  }
};
