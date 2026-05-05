/**
 * Cloudflare Pages Function - API Handler
 * Path: /functions/api/[[path]].js
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');

  // 1. Validar Autenticación
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  
  let userId;
  try {
    // Verificamos el token directamente con Google
    const googleResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const info = await googleResp.json();
    
    if (!googleResp.ok || info.error) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401 });
    }
    
    // El 'sub' es el ID único y permanente del usuario en Google
    userId = info.sub; 
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error de autenticación' }), { status: 500 });
  }

  // 2. Manejar Rutas
  try {
    // GET /api/data -> Cargar todo
    if (request.method === 'GET' && path === '/data') {
      const { results: tasks } = await env.DB.prepare("SELECT * FROM tasks WHERE user_id = ?").bind(userId).all();
      const { results: notes } = await env.DB.prepare("SELECT * FROM notes WHERE user_id = ?").bind(userId).all();
      const { results: events } = await env.DB.prepare("SELECT * FROM events WHERE user_id = ?").bind(userId).all();
      
      // Parsear subtasks que vienen como string JSON
      const parsedTasks = tasks.map(t => ({
        ...t,
        subtasks: JSON.parse(t.subtasks || '[]')
      }));

      return new Response(JSON.stringify({
        tasks: parsedTasks,
        boardNotes: notes,
        events: events
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // POST /api/sync -> Sincronizar estado completo
    if (request.method === 'POST' && path === '/sync') {
      const { tasks, boardNotes, events } = await request.json();
      
      // Usamos una transacción para asegurar que no se pierdan datos
      const batch = [
        env.DB.prepare("DELETE FROM tasks WHERE user_id = ?").bind(userId),
        env.DB.prepare("DELETE FROM notes WHERE user_id = ?").bind(userId),
        env.DB.prepare("DELETE FROM events WHERE user_id = ?").bind(userId)
      ];

      // Insertar nuevas tareas
      for (const t of tasks) {
        batch.push(env.DB.prepare("INSERT INTO tasks (id, user_id, description, status, priority, category, date, time, subtasks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(t.id, userId, t.description, t.status, t.priority, t.category || null, t.date || null, t.time || null, JSON.stringify(t.subtasks || [])));
      }

      // Insertar nuevas notas
      for (const n of boardNotes) {
        batch.push(env.DB.prepare("INSERT INTO notes (id, user_id, title, text, x, y) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(n.id, userId, n.title || '', n.text || '', n.x || 0, n.y || 0));
      }

      // Insertar nuevos eventos
      for (const e of events) {
        batch.push(env.DB.prepare("INSERT INTO events (id, user_id, title, startDate, endDate, color) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(e.id, userId, e.title, e.startDate, e.endDate || null, e.color || '#3b82f6'));
      }

      await env.DB.batch(batch);
      
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// Función auxiliar para verificar token (Esquema)
async function verifyGoogleToken(token) {
  const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
  const info = await resp.json();
  if (info.error) throw new Error("Invalid Token");
  return info; // Contiene email, sub (user_id), etc.
}
