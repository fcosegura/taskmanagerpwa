import { cacheNoteAiMetaLocal } from '../data/localStore.js';

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
