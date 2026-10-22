import { json } from './http.js';
import {
  NOTE_AI_RATE_MAX_PER_WINDOW, NOTE_AI_RATE_WINDOW_SEC,
  NOTE_AI_RAG_RATE_MAX_PER_WINDOW, NOTE_AI_RAG_RATE_WINDOW_SEC,
} from '../noteAi/constants.js';

const AI_RATE_WINDOW_SEC = 60;
const AI_RATE_MAX_PER_WINDOW = 48;

export async function consumeAiRateLimit(env, userId) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / AI_RATE_WINDOW_SEC) * AI_RATE_WINDOW_SEC;
  const row = await env.DB.prepare(
    'SELECT window_start, request_count FROM ai_rate_limits WHERE user_id = ?'
  ).bind(userId).first();

  if (!row || row.window_start < windowStart) {
    await env.DB.prepare(
      'INSERT INTO ai_rate_limits (user_id, window_start, request_count) VALUES (?, ?, 1) ' +
        'ON CONFLICT(user_id) DO UPDATE SET window_start = excluded.window_start, request_count = 1'
    ).bind(userId, windowStart).run();
    return null;
  }

  if (row.request_count >= AI_RATE_MAX_PER_WINDOW) {
    return json(
      { error: 'Demasiadas solicitudes de IA. Prueba de nuevo en un minuto.' },
      { status: 429 }
    );
  }

  await env.DB.prepare(
    'UPDATE ai_rate_limits SET request_count = request_count + 1 WHERE user_id = ?'
  ).bind(userId).run();
  return null;
}

export async function consumeNoteAiRateLimit(env, userId) {
  const key = `note-ai:${userId}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / NOTE_AI_RATE_WINDOW_SEC) * NOTE_AI_RATE_WINDOW_SEC;
  const row = await env.DB.prepare(
    'SELECT window_start, request_count FROM ai_rate_limits WHERE user_id = ?'
  ).bind(key).first();

  if (!row || row.window_start < windowStart) {
    await env.DB.prepare(
      'INSERT INTO ai_rate_limits (user_id, window_start, request_count) VALUES (?, ?, 1) ' +
        'ON CONFLICT(user_id) DO UPDATE SET window_start = excluded.window_start, request_count = 1'
    ).bind(key, windowStart).run();
    return null;
  }

  if (row.request_count >= NOTE_AI_RATE_MAX_PER_WINDOW) {
    return json(
      { error: 'Demasiadas solicitudes de IA de notas. Prueba de nuevo en un minuto.' },
      { status: 429 }
    );
  }

  await env.DB.prepare(
    'UPDATE ai_rate_limits SET request_count = request_count + 1 WHERE user_id = ?'
  ).bind(key).run();
  return null;
}

export async function consumeNoteRagRateLimit(env, userId) {
  const key = `note-rag:${userId}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / NOTE_AI_RAG_RATE_WINDOW_SEC) * NOTE_AI_RAG_RATE_WINDOW_SEC;
  const row = await env.DB.prepare(
    'SELECT window_start, request_count FROM ai_rate_limits WHERE user_id = ?'
  ).bind(key).first();

  if (!row || row.window_start < windowStart) {
    await env.DB.prepare(
      'INSERT INTO ai_rate_limits (user_id, window_start, request_count) VALUES (?, ?, 1) ' +
        'ON CONFLICT(user_id) DO UPDATE SET window_start = excluded.window_start, request_count = 1'
    ).bind(key, windowStart).run();
    return null;
  }

  if (row.request_count >= NOTE_AI_RAG_RATE_MAX_PER_WINDOW) {
    return json(
      { error: 'Demasiadas preguntas al chat de notas. Prueba de nuevo en un minuto.' },
      { status: 429 }
    );
  }

  await env.DB.prepare(
    'UPDATE ai_rate_limits SET request_count = request_count + 1 WHERE user_id = ?'
  ).bind(key).run();
  return null;
}

const RATE_LIMIT_RETENTION_SEC = 24 * 60 * 60;

/**
 * Best-effort cleanup of stale rate-limit rows. Runs on the same low-frequency
 * path as pruneExpiredSessions (login), never on the hot request path.
 */
export async function pruneStaleRateLimits(env) {
  const cutoff = Math.floor(Date.now() / 1000) - RATE_LIMIT_RETENTION_SEC;
  try {
    await env.DB.prepare('DELETE FROM ai_rate_limits WHERE window_start < ?').bind(cutoff).run();
  } catch {
    // ignore
  }
}
