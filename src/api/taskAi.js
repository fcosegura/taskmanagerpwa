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
