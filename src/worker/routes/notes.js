import { json } from '../http.js';
import { resolveProfileId } from '../profiles.js';
import { consumeNoteAiRateLimit, consumeNoteRagRateLimit } from '../rateLimits.js';
import {
  dismissNoteAiSuggestion, enqueueStaleNoteAiReindex, getRelatedNotesForNote,
  listNoteAiMeta, semanticSearchNotes, detectNoteDuplicates, organizeNotesLayout, answerNotesRagChat,
} from '../../noteAi/pipeline.js';
import { normalizeNoteAiPrefs } from '../../noteAi/prefs.js';
import { NOTE_AI_RAG_MAX_QUESTION_CHARS } from '../../noteAi/constants.js';

export async function handleNoteRoutes({ request, path, env, ctx, userId, profileId, dataKey }) {
  if (request.method === 'GET' && path === '/notes/ai') {
    const meta = await listNoteAiMeta(env, dataKey, userId, profileId);
    // Refresh notes indexed with older analysis/vector rules (non-blocking).
    await enqueueStaleNoteAiReindex(env, ctx, userId, profileId);
    return json({ meta });
  }

  if (request.method === 'GET' && path.startsWith('/notes/') && path.endsWith('/related')) {
    const noteId = decodeURIComponent(path.slice('/notes/'.length, -'/related'.length));
    if (!noteId) return json({ error: 'noteId inválido' }, { status: 400 });
    const rateLimited = await consumeNoteAiRateLimit(env, userId);
    if (rateLimited) return rateLimited;
    const result = await getRelatedNotesForNote(env, dataKey, userId, profileId, noteId);
    return json(result);
  }

  if (request.method === 'POST' && path === '/notes/search') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido' }, { status: 400 });
    }
    const queryText = typeof body?.query === 'string' ? body.query.trim() : '';
    if (!queryText) return json({ error: 'query es requerido' }, { status: 400 });
    if (queryText.length > 500) return json({ error: 'query demasiado largo (max 500)' }, { status: 400 });
    const rateLimited = await consumeNoteAiRateLimit(env, userId);
    if (rateLimited) return rateLimited;
    const prefs = normalizeNoteAiPrefs(body?.prefs);
    const searchProfileId = typeof body?.profileId === 'string' && body.profileId
      ? await resolveProfileId(env, userId, body.profileId, dataKey)
      : profileId;
    const result = await semanticSearchNotes(env, dataKey, userId, searchProfileId, queryText, prefs);
    return json(result);
  }

  if (request.method === 'POST' && path === '/notes/ai/dismiss') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido' }, { status: 400 });
    }
    const noteId = typeof body?.noteId === 'string' ? body.noteId : '';
    const kind = typeof body?.kind === 'string' ? body.kind : '';
    const value = typeof body?.value === 'string' ? body.value : '';
    if (!noteId || !kind) return json({ error: 'noteId y kind son requeridos' }, { status: 400 });
    const meta = await dismissNoteAiSuggestion(env, dataKey, userId, profileId, noteId, kind, value);
    if (!meta) return json({ error: 'Meta no encontrada' }, { status: 404 });
    return json({ meta });
  }

  if (request.method === 'POST' && path === '/notes/duplicates') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const rateLimited = await consumeNoteAiRateLimit(env, userId);
    if (rateLimited) return rateLimited;
    const prefs = normalizeNoteAiPrefs(body?.prefs);
    const dupProfileId = typeof body?.profileId === 'string' && body.profileId
      ? await resolveProfileId(env, userId, body.profileId, dataKey)
      : profileId;
    const result = await detectNoteDuplicates(env, dataKey, userId, dupProfileId, prefs);
    return json(result);
  }

  if (request.method === 'POST' && path === '/notes/organize') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const rateLimited = await consumeNoteAiRateLimit(env, userId);
    if (rateLimited) return rateLimited;
    const prefs = normalizeNoteAiPrefs(body?.prefs);
    const orgProfileId = typeof body?.profileId === 'string' && body.profileId
      ? await resolveProfileId(env, userId, body.profileId, dataKey)
      : profileId;
    const layoutOptions = body?.layout && typeof body.layout === 'object' ? body.layout : {};
    const result = await organizeNotesLayout(
      env, dataKey, userId, orgProfileId, prefs, layoutOptions
    );
    return json(result);
  }

  if (request.method === 'POST' && path === '/notes/chat') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido' }, { status: 400 });
    }
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) return json({ error: 'question es requerido' }, { status: 400 });
    if (question.length > NOTE_AI_RAG_MAX_QUESTION_CHARS) {
      return json(
        { error: `question demasiado largo (max ${NOTE_AI_RAG_MAX_QUESTION_CHARS})` },
        { status: 400 }
      );
    }
    const rateLimited = await consumeNoteRagRateLimit(env, userId);
    if (rateLimited) return rateLimited;
    const prefs = normalizeNoteAiPrefs(body?.prefs);
    const chatProfileId = typeof body?.profileId === 'string' && body.profileId
      ? await resolveProfileId(env, userId, body.profileId, dataKey)
      : profileId;
    const result = await answerNotesRagChat(
      env, dataKey, userId, chatProfileId, question, prefs
    );
    return json(result);
  }
  return null;
}
