/**
 * RAG helpers for contextual notes chat (Phase 3).
 * Strict grounding: answer only from retrieved note context.
 */

import {
  NOTE_AI_RAG_MAX_ANSWER_CHARS,
  NOTE_AI_RAG_MAX_QUESTION_CHARS,
  NOTE_AI_RAG_TOP_K,
} from './constants.js';

const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'para', 'por', 'con', 'del', 'que',
  'the', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'are', 'this', 'that', 'with',
  'qué', 'que', 'cómo', 'como', 'cuál', 'cual', 'dónde', 'donde', 'hay', 'sobre', 'mis', 'mi',
]);

/**
 * @param {unknown} question
 * @returns {string}
 */
export function sanitizeRagQuestion(question) {
  if (typeof question !== 'string') return '';
  return question.trim().slice(0, NOTE_AI_RAG_MAX_QUESTION_CHARS);
}

/**
 * @param {unknown} answer
 * @returns {string}
 */
export function sanitizeRagAnswer(answer) {
  if (typeof answer !== 'string') return '';
  return answer.trim().slice(0, NOTE_AI_RAG_MAX_ANSWER_CHARS);
}

/**
 * Normalize retrieval hits into a compact context list.
 * @param {Array<{ noteId?: string, title?: string, text?: string, summary?: string, score?: number }>} results
 * @param {number} [topK]
 */
export function buildRagContextFromResults(results, topK = NOTE_AI_RAG_TOP_K) {
  const list = Array.isArray(results) ? results : [];
  const out = [];
  const seen = new Set();
  for (const r of list) {
    const noteId = typeof r?.noteId === 'string' ? r.noteId : '';
    if (!noteId || seen.has(noteId)) continue;
    seen.add(noteId);
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    const summary = typeof r.summary === 'string' ? r.summary.trim() : '';
    const text = typeof r.text === 'string' ? r.text.trim() : '';
    const body = summary || text;
    out.push({
      noteId,
      title: title.slice(0, 120),
      excerpt: (body || title).slice(0, 500),
      score: Number.isFinite(r.score) ? r.score : 0,
    });
    if (out.length >= topK) break;
  }
  return out;
}

/**
 * Format context block for the LLM prompt (Spanish labels).
 * @param {Array<{ noteId: string, title: string, excerpt: string }>} contextNotes
 */
export function formatRagContextBlock(contextNotes) {
  const list = Array.isArray(contextNotes) ? contextNotes : [];
  if (!list.length) return '(sin notas en el contexto)';
  return list
    .map((n, i) => {
      const label = n.title || `Nota ${n.noteId}`;
      return `[${i + 1}] id=${n.noteId}\nTítulo: ${label}\nContenido: ${n.excerpt || '(vacío)'}`;
    })
    .join('\n\n');
}

/**
 * Strict system + user prompt: answer only from context, no generic chat memory.
 */
export function buildRagPrompt(question, contextNotes) {
  const q = sanitizeRagQuestion(question);
  const block = formatRagContextBlock(contextNotes);
  const system = [
    'Eres un asistente que responde SOLO con información de las notas del usuario proporcionadas en el contexto.',
    'Reglas estrictas:',
    '- Usa únicamente el bloque de contexto. No inventes datos.',
    '- Si el contexto no contiene la respuesta, di exactamente: "No encuentro eso en tus notas."',
    '- No uses conocimiento general ni memoria de conversaciones previas.',
    '- Responde en español, de forma breve y clara.',
    '- Puedes citar el título de la nota cuando ayude.',
  ].join('\n');

  const user = [
    'Contexto (notas del perfil activo):',
    block,
    '',
    `Pregunta: ${q}`,
  ].join('\n');

  return { system, user };
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-záéíóúüñ0-9#+-]+/i)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Deterministic extractive answer when Workers AI is unavailable.
 * @param {string} question
 * @param {Array<{ noteId: string, title: string, excerpt: string }>} contextNotes
 */
export function answerFromNotesFallback(question, contextNotes) {
  const q = sanitizeRagQuestion(question);
  const notes = Array.isArray(contextNotes) ? contextNotes : [];
  if (!notes.length) {
    return {
      answer: 'No encuentro eso en tus notas.',
      source: 'fallback',
      citedNoteIds: [],
    };
  }

  const tokens = tokenize(q);
  if (!tokens.length) {
    const first = notes[0];
    const label = first.title || 'una nota';
    return {
      answer: `Según tus notas, lo más cercano es «${label}»: ${first.excerpt.slice(0, 220)}`,
      source: 'fallback',
      citedNoteIds: [first.noteId],
    };
  }

  const scored = notes.map((n) => {
    const hay = `${n.title}\n${n.excerpt}`.toLowerCase();
    let hits = 0;
    for (const t of tokens) {
      if (hay.includes(t)) hits += 1;
    }
    return { note: n, hits };
  });
  scored.sort((a, b) => b.hits - a.hits);

  const best = scored.filter((s) => s.hits > 0).slice(0, 3);
  if (!best.length) {
    return {
      answer: 'No encuentro eso en tus notas.',
      source: 'fallback',
      citedNoteIds: [],
    };
  }

  const lines = best.map(({ note, hits }) => {
    const label = note.title || note.noteId;
    return `• ${label}: ${note.excerpt.slice(0, 180)}${hits ? '' : ''}`;
  });
  return {
    answer: sanitizeRagAnswer(
      `Según tus notas:\n${lines.join('\n')}`
    ),
    source: 'fallback',
    citedNoteIds: best.map((b) => b.note.noteId),
  };
}
