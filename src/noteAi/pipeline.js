import {
  NOTE_AI_RELATED_MIN_SCORE,
  NOTE_AI_RELATED_TOP_K,
  NOTE_AI_SEARCH_MIN_SCORE,
  NOTE_AI_SEARCH_TOP_K,
  NOTE_AI_VECTOR_SCHEMA,
  DEFAULT_NOTE_AI_PREFS,
  NOTE_AI_CLUSTER_MIN_SCORE,
  NOTE_AI_CLUSTER_QUERY_TOP_K,
  NOTE_AI_DUPLICATE_MIN_SCORE,
  NOTE_AI_CLUSTER_MAX_NOTES,
  NOTE_AI_RAG_TOP_K,
  NOTE_AI_RAG_MIN_SCORE,
} from './constants.js';
import { createNoteAiServices } from './adapters.js';
import { analyzeNoteFallback, sanitizeAnalysisResult } from './fallbacks.js';
import { normalizeNoteAiPrefs } from './prefs.js';
import {
  buildSimilarityClusters,
  edgesFromRelatedMeta,
  findDuplicateGroups,
  layoutClusters,
} from './clustering.js';
import {
  answerFromNotesFallback,
  buildRagContextFromResults,
  sanitizeRagAnswer,
  sanitizeRagQuestion,
} from './rag.js';
import {
  decryptField,
  encryptField,
  importDataEncryptionKey,
  sha256HexOfUtf8,
  stableStringify,
  buildNoteAiContentHashInput,
} from '../d1-field-crypto.js';

export async function hashNoteAiContent(title, text) {
  return sha256HexOfUtf8(stableStringify(buildNoteAiContentHashInput(title, text)));
}

function noteTextForEmbed(title, text) {
  const t = `${title || ''}\n${text || ''}`.trim();
  return t || ' ';
}

/**
 * Vectorize vector IDs max 64 bytes. Scoped profile ids are often longer, so hash.
 * Isolation uses Vectorize `namespace` (no metadata index required).
 */
async function vectorNamespace(userId, profileId) {
  const hex = await sha256HexOfUtf8(`${userId}\n${profileId}`);
  return hex.slice(0, 48);
}

async function vectorIdForNote(userId, profileId, noteId) {
  const hex = await sha256HexOfUtf8(`${userId}\n${profileId}\n${noteId}`);
  return hex.slice(0, 32);
}

export async function ensureNoteAiSchema(env) {
  const safeExec = async (statement) => {
    try {
      await env.DB.prepare(statement).run();
    } catch {
      // resilient bootstrap
    }
  };
  await safeExec(`
    CREATE TABLE IF NOT EXISTS note_ai_meta (
      note_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      content_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      summary TEXT,
      tags TEXT,
      entities TEXT,
      classification TEXT,
      task_suggestions TEXT,
      related_ids TEXT,
      dismissed TEXT,
      error_message TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (note_id, profile_id)
    )
  `);
  await safeExec('CREATE INDEX IF NOT EXISTS idx_note_ai_meta_user_profile ON note_ai_meta(user_id, profile_id)');
  await safeExec('CREATE INDEX IF NOT EXISTS idx_note_ai_meta_status ON note_ai_meta(user_id, profile_id, status)');
  await safeExec('ALTER TABLE note_ai_meta ADD COLUMN vector_schema INTEGER DEFAULT 0');
}

function scopedNoteId(profileId, noteId) {
  return `${profileId}::${noteId}`;
}

function unscopedNoteId(profileId, id) {
  const prefix = `${profileId}::`;
  return typeof id === 'string' && id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

async function markPending(env, { userId, profileId, noteId, contentHash }) {
  const scoped = scopedNoteId(profileId, noteId);
  await env.DB.prepare(
    `INSERT INTO note_ai_meta (note_id, user_id, profile_id, content_hash, status, updated_at)
     VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
     ON CONFLICT(note_id, profile_id) DO UPDATE SET
       content_hash = excluded.content_hash,
       status = 'pending',
       error_message = NULL,
       updated_at = CURRENT_TIMESTAMP
     WHERE note_ai_meta.user_id = excluded.user_id`
  ).bind(scoped, userId, profileId, contentHash || null).run();
}

async function loadNotePlain(env, dataKey, userId, profileId, noteId) {
  const scoped = scopedNoteId(profileId, noteId);
  const row = await env.DB.prepare(
    'SELECT id, title, text FROM notes WHERE user_id = ? AND profile_id = ? AND id = ?'
  ).bind(userId, profileId, scoped).first();
  if (!row) return null;
  const title = (await decryptField(dataKey, row.title)) || '';
  const text = (await decryptField(dataKey, row.text)) || '';
  return { id: noteId, title, text };
}

async function saveAnalysis(env, dataKey, {
  userId, profileId, noteId, contentHash, analysis, relatedIds, status = 'ready', errorMessage = null,
}) {
  const scoped = scopedNoteId(profileId, noteId);
  const encSummary = await encryptField(dataKey, analysis.summary || '');
  const encTags = await encryptField(dataKey, JSON.stringify(analysis.tags || []));
  const encEntities = await encryptField(dataKey, JSON.stringify(analysis.entities || {}));
  const encClass = await encryptField(dataKey, analysis.classification || '');
  const encTasks = await encryptField(dataKey, JSON.stringify(analysis.taskSuggestions || []));
  const encRelated = await encryptField(dataKey, JSON.stringify(relatedIds || []));

  await env.DB.prepare(
    `INSERT INTO note_ai_meta (
      note_id, user_id, profile_id, content_hash, status,
      summary, tags, entities, classification, task_suggestions, related_ids, error_message, vector_schema, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(note_id, profile_id) DO UPDATE SET
      content_hash = excluded.content_hash,
      status = excluded.status,
      summary = excluded.summary,
      tags = excluded.tags,
      entities = excluded.entities,
      classification = excluded.classification,
      task_suggestions = excluded.task_suggestions,
      related_ids = excluded.related_ids,
      error_message = excluded.error_message,
      vector_schema = excluded.vector_schema,
      updated_at = CURRENT_TIMESTAMP
    WHERE note_ai_meta.user_id = excluded.user_id`
  ).bind(
    scoped,
    userId,
    profileId,
    contentHash,
    status,
    encSummary,
    encTags,
    encEntities,
    encClass,
    encTasks,
    encRelated,
    errorMessage,
    NOTE_AI_VECTOR_SCHEMA
  ).run();
}

async function decryptMetaRow(dataKey, row, profileId) {
  const parseJson = async (field, fallback) => {
    const plain = await decryptField(dataKey, field);
    if (!plain) return fallback;
    try {
      return JSON.parse(plain);
    } catch {
      return fallback;
    }
  };
  const dismissed = await parseJson(row.dismissed, []);
  return {
    noteId: unscopedNoteId(profileId, row.note_id),
    status: row.status || 'pending',
    contentHash: row.content_hash || null,
    summary: (await decryptField(dataKey, row.summary)) || '',
    tags: await parseJson(row.tags, []),
    entities: await parseJson(row.entities, {
      people: [], projects: [], tickets: [], urls: [], platforms: [], dates: [],
    }),
    classification: (await decryptField(dataKey, row.classification)) || null,
    taskSuggestions: await parseJson(row.task_suggestions, []),
    relatedIds: await parseJson(row.related_ids, []),
    dismissed: Array.isArray(dismissed) ? dismissed : [],
    errorMessage: row.error_message || null,
    updatedAt: row.updated_at || null,
    source: undefined,
  };
}

/**
 * Process one analyze/delete job. Safe to call from queue or waitUntil.
 */
export async function processNoteAiJob(env, dataKey, job, prefsInput = DEFAULT_NOTE_AI_PREFS) {
  await ensureNoteAiSchema(env);
  const prefs = normalizeNoteAiPrefs(prefsInput);
  const services = createNoteAiServices(env);
  const { type, userId, profileId, noteId } = job || {};
  if (!userId || !profileId || !noteId) return { ok: false, reason: 'invalid_job' };

  if (type === 'delete') {
    const scoped = scopedNoteId(profileId, noteId);
    await env.DB.prepare(
      'DELETE FROM note_ai_meta WHERE user_id = ? AND profile_id = ? AND note_id = ?'
    ).bind(userId, profileId, scoped).run();
    try {
      const vid = await vectorIdForNote(userId, profileId, noteId);
      await services.vectors.deleteByIds([vid]);
    } catch {
      // vector delete best-effort
    }
    return { ok: true, type: 'delete' };
  }

  const note = await loadNotePlain(env, dataKey, userId, profileId, noteId);
  if (!note) {
    await env.DB.prepare(
      'DELETE FROM note_ai_meta WHERE user_id = ? AND profile_id = ? AND note_id = ?'
    ).bind(userId, profileId, scopedNoteId(profileId, noteId)).run();
    return { ok: false, reason: 'note_missing' };
  }

  const contentHash = await hashNoteAiContent(note.title, note.text);
  const existing = await env.DB.prepare(
    'SELECT content_hash, status, vector_schema FROM note_ai_meta WHERE user_id = ? AND profile_id = ? AND note_id = ?'
  ).bind(userId, profileId, scopedNoteId(profileId, noteId)).first();

  if (
    existing?.content_hash === contentHash
    && existing?.status === 'ready'
    && Number(existing?.vector_schema) >= NOTE_AI_VECTOR_SCHEMA
  ) {
    return { ok: true, skipped: true, reason: 'unchanged' };
  }

  await markPending(env, { userId, profileId, noteId, contentHash });

  let analysis;
  try {
    analysis = await services.analyzer.analyze({
      title: note.title,
      text: note.text,
      prefs,
    });
    analysis = sanitizeAnalysisResult(analysis, prefs);
  } catch {
    analysis = analyzeNoteFallback(note.title, note.text, prefs);
  }

  let relatedIds = [];
  try {
    const [embedding] = await services.embeddings.embed([noteTextForEmbed(note.title, note.text)]);
    if (embedding) {
      const ns = await vectorNamespace(userId, profileId);
      const vid = await vectorIdForNote(userId, profileId, noteId);
      await services.vectors.upsert([{
        id: vid,
        values: embedding,
        namespace: ns,
        metadata: { noteId },
      }]);

      if (prefs.related !== false) {
        const query = await services.vectors.query(embedding, {
          topK: NOTE_AI_RELATED_TOP_K + 1,
          returnMetadata: 'all',
          namespace: ns,
        });
        relatedIds = (query?.matches || [])
          .filter((m) => m.id !== vid && (m.score ?? 0) >= NOTE_AI_RELATED_MIN_SCORE)
          .slice(0, NOTE_AI_RELATED_TOP_K)
          .map((m) => m.metadata?.noteId)
          .filter(Boolean);
      }
    }
  } catch (err) {
    // Embeddings/vector optional: still persist LLM/fallback analysis.
    console.error('[noteAi] embed/upsert failed', err?.message || err);
    await saveAnalysis(env, dataKey, {
      userId,
      profileId,
      noteId,
      contentHash,
      analysis,
      relatedIds: [],
      status: 'ready',
      errorMessage: err?.message ? String(err.message).slice(0, 200) : 'embed_failed',
    });
    return { ok: true, partial: true, source: analysis.source };
  }

  await saveAnalysis(env, dataKey, {
    userId,
    profileId,
    noteId,
    contentHash,
    analysis,
    relatedIds,
    status: 'ready',
  });

  return { ok: true, source: analysis.source, relatedCount: relatedIds.length };
}

export async function listNoteAiMeta(env, dataKey, userId, profileId) {
  await ensureNoteAiSchema(env);
  const { results } = await env.DB.prepare(
    'SELECT * FROM note_ai_meta WHERE user_id = ? AND profile_id = ?'
  ).bind(userId, profileId).all();
  const out = [];
  for (const row of results || []) {
    out.push(await decryptMetaRow(dataKey, row, profileId));
  }
  return out;
}

export async function getNoteAiMeta(env, dataKey, userId, profileId, noteId) {
  await ensureNoteAiSchema(env);
  const row = await env.DB.prepare(
    'SELECT * FROM note_ai_meta WHERE user_id = ? AND profile_id = ? AND note_id = ?'
  ).bind(userId, profileId, scopedNoteId(profileId, noteId)).first();
  if (!row) return null;
  return decryptMetaRow(dataKey, row, profileId);
}

/**
 * Merge forward related ids, reverse links, and live vector matches.
 * Relationships are otherwise one-way (only stored on the note that was analyzed last).
 */
export function mergeRelatedNoteIds(noteId, forwardIds, allMetaList, vectorIds = []) {
  const out = [];
  const seen = new Set();
  const push = (id) => {
    if (!id || id === noteId || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const id of forwardIds || []) push(id);
  for (const meta of allMetaList || []) {
    if (!meta || meta.noteId === noteId) continue;
    if ((meta.relatedIds || []).includes(noteId)) push(meta.noteId);
  }
  for (const id of vectorIds || []) push(id);
  return out.slice(0, NOTE_AI_RELATED_TOP_K);
}

async function hydrateRelatedNotes(env, dataKey, userId, profileId, relatedIds) {
  const related = [];
  for (const rid of relatedIds) {
    const note = await loadNotePlain(env, dataKey, userId, profileId, rid);
    if (!note) continue;
    related.push({
      noteId: rid,
      title: note.title || '',
      text: note.text || '',
    });
  }
  return related;
}

/**
 * Related notes for a selection: stored + reverse + live Vectorize query.
 */
export async function getRelatedNotesForNote(env, dataKey, userId, profileId, noteId) {
  await ensureNoteAiSchema(env);
  const meta = await getNoteAiMeta(env, dataKey, userId, profileId, noteId);
  const allMeta = await listNoteAiMeta(env, dataKey, userId, profileId);
  const forwardIds = meta?.relatedIds || [];

  let vectorIds = [];
  try {
    const note = await loadNotePlain(env, dataKey, userId, profileId, noteId);
    if (note && env?.VECTORIZE?.query) {
      const services = createNoteAiServices(env);
      const [embedding] = await services.embeddings.embed([noteTextForEmbed(note.title, note.text)]);
      const ns = await vectorNamespace(userId, profileId);
      const vid = await vectorIdForNote(userId, profileId, noteId);
      const query = await services.vectors.query(embedding, {
        topK: NOTE_AI_RELATED_TOP_K + 1,
        returnMetadata: 'all',
        namespace: ns,
      });
      vectorIds = (query?.matches || [])
        .filter((m) => m.id !== vid && (m.score ?? 0) >= NOTE_AI_RELATED_MIN_SCORE)
        .map((m) => m.metadata?.noteId)
        .filter(Boolean);
    }
  } catch (err) {
    console.error('[noteAi] live related query failed', err?.message || err);
  }

  const relatedIds = mergeRelatedNoteIds(noteId, forwardIds, allMeta, vectorIds);
  const related = await hydrateRelatedNotes(env, dataKey, userId, profileId, relatedIds);
  return {
    noteId,
    related,
    status: meta?.status || null,
    source: vectorIds.length ? 'vector+meta' : 'meta',
  };
}

export async function dismissNoteAiSuggestion(env, dataKey, userId, profileId, noteId, kind, value) {
  await ensureNoteAiSchema(env);
  const meta = await getNoteAiMeta(env, dataKey, userId, profileId, noteId);
  if (!meta) return null;
  const entry = `${kind}:${String(value || '').slice(0, 120)}`;
  const dismissed = [...new Set([...(meta.dismissed || []), entry])].slice(-50);
  const scoped = scopedNoteId(profileId, noteId);
  const enc = await encryptField(dataKey, JSON.stringify(dismissed));
  await env.DB.prepare(
    `UPDATE note_ai_meta SET dismissed = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND profile_id = ? AND note_id = ?`
  ).bind(enc, userId, profileId, scoped).run();
  return { ...meta, dismissed };
}

export async function semanticSearchNotes(env, dataKey, userId, profileId, queryText, prefsInput) {
  const prefs = normalizeNoteAiPrefs(prefsInput);
  if (prefs.semanticSearch === false) return { results: [], source: 'disabled' };
  const q = typeof queryText === 'string' ? queryText.trim() : '';
  if (!q) return { results: [], source: 'empty' };

  const services = createNoteAiServices(env);
  try {
    if (!env?.VECTORIZE?.query) {
      throw new Error('VECTORIZE binding missing');
    }
    const [embedding] = await services.embeddings.embed([q.slice(0, 2000)]);
    const ns = await vectorNamespace(userId, profileId);
    const query = await services.vectors.query(embedding, {
      topK: NOTE_AI_SEARCH_TOP_K,
      returnMetadata: 'all',
      namespace: ns,
    });
    const matches = (query?.matches || [])
      .filter((m) => (m.score ?? 0) >= NOTE_AI_SEARCH_MIN_SCORE)
      .slice(0, NOTE_AI_SEARCH_TOP_K);

    const results = [];
    for (const m of matches) {
      const noteId = m.metadata?.noteId;
      if (!noteId) continue;
      const note = await loadNotePlain(env, dataKey, userId, profileId, noteId);
      if (!note) continue;
      const meta = await getNoteAiMeta(env, dataKey, userId, profileId, noteId);
      results.push({
        noteId,
        score: m.score,
        title: note.title,
        text: note.text,
        summary: meta?.summary || '',
        tags: meta?.tags || [],
        classification: meta?.classification || null,
      });
    }
    if (results.length > 0) {
      return { results, source: 'vector', matchCount: matches.length };
    }
    // Empty vector hits: still try keyword fallback below.
    throw new Error('no_vector_matches');
  } catch (err) {
    if (err?.message !== 'no_vector_matches') {
      console.error('[noteAi] semantic search failed', err?.message || err);
    }
    // Keyword fallback: any token match (not only full phrase).
    const { results: rows } = await env.DB.prepare(
      'SELECT id, title, text FROM notes WHERE user_id = ? AND profile_id = ? LIMIT 200'
    ).bind(userId, profileId).all();
    const tokens = q.toLowerCase().split(/[^a-záéíóúüñ0-9#+-]+/i).filter((t) => t.length >= 3);
    const needles = tokens.length ? tokens : [q.toLowerCase()];
    const scored = [];
    for (const row of rows || []) {
      const title = (await decryptField(dataKey, row.title)) || '';
      const text = (await decryptField(dataKey, row.text)) || '';
      const hay = `${title}\n${text}`.toLowerCase();
      let hits = 0;
      for (const n of needles) {
        if (hay.includes(n)) hits += 1;
      }
      if (hits === 0) continue;
      scored.push({
        noteId: unscopedNoteId(profileId, row.id),
        score: hits / needles.length,
        title,
        text,
        summary: '',
        tags: [],
        classification: null,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return {
      results: scored.slice(0, NOTE_AI_SEARCH_TOP_K),
      source: 'keyword_fallback',
    };
  }
}

/**
 * Re-queue notes whose vectors still use the old id/filter scheme.
 */
export async function enqueueStaleNoteAiReindex(env, ctx, userId, profileId) {
  await ensureNoteAiSchema(env);
  const { results: noteRows } = await env.DB.prepare(
    'SELECT id FROM notes WHERE user_id = ? AND profile_id = ? LIMIT 200'
  ).bind(userId, profileId).all();
  const { results: metaRows } = await env.DB.prepare(
    'SELECT note_id, vector_schema FROM note_ai_meta WHERE user_id = ? AND profile_id = ?'
  ).bind(userId, profileId).all();

  const schemaByScopedId = new Map();
  for (const row of metaRows || []) {
    schemaByScopedId.set(row.note_id, Number(row.vector_schema) || 0);
  }

  const jobs = [];
  for (const row of noteRows || []) {
    const schema = schemaByScopedId.has(row.id) ? schemaByScopedId.get(row.id) : -1;
    if (schema >= NOTE_AI_VECTOR_SCHEMA) continue;
    jobs.push({
      type: 'analyze',
      userId,
      profileId,
      noteId: unscopedNoteId(profileId, row.id),
    });
    if (jobs.length >= 80) break;
  }
  if (!jobs.length) return { enqueued: 0 };
  await enqueueNoteAiJobs(env, ctx, jobs);
  return { enqueued: jobs.length };
}

export async function enqueueNoteAiJobs(env, ctx, jobs) {
  const list = Array.isArray(jobs) ? jobs.filter(Boolean) : [];
  if (!list.length) return;

  if (env?.NOTES_AI_QUEUE?.send) {
    if (typeof env.NOTES_AI_QUEUE.sendBatch === 'function' && list.length > 1) {
      await env.NOTES_AI_QUEUE.sendBatch(list.map((body) => ({ body })));
    } else {
      for (const body of list) {
        await env.NOTES_AI_QUEUE.send(body);
      }
    }
    return;
  }

  // Local / missing queue: fire-and-forget via waitUntil when available.
  const dataKey = await importDataEncryptionKey(env.DATA_ENCRYPTION_KEY);
  if (!dataKey) return;
  const run = async () => {
    for (const job of list) {
      try {
        await processNoteAiJob(env, dataKey, job);
      } catch (err) {
        console.error('[noteAi] waitUntil job failed', err?.message || err);
      }
    }
  };
  if (ctx?.waitUntil) ctx.waitUntil(run());
  else await run();
}

/**
 * Collect undirected similarity edges from Vectorize (or related_ids fallback).
 * Scores are cosine from Vectorize when available.
 * @param {{ relatedFallbackScore?: number|null }} [options]
 *   When Vectorize yields no edges and relatedFallbackScore is a number, build edges
 *   from stored relatedIds at that score (organize). Pass null to skip (duplicates).
 */
async function collectSimilarityEdges(env, dataKey, userId, profileId, noteIds, minScore, options = {}) {
  const relatedFallbackScore = options.relatedFallbackScore;
  const ids = (noteIds || []).slice(0, NOTE_AI_CLUSTER_MAX_NOTES);
  const idSet = new Set(ids);
  const edgeMap = new Map();
  const pushEdge = (a, b, score) => {
    if (!a || !b || a === b) return;
    if (!idSet.has(a) || !idSet.has(b)) return;
    if ((score ?? 0) < minScore) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const prev = edgeMap.get(key);
    if (!prev || (score ?? 0) > (prev.score ?? 0)) {
      edgeMap.set(key, { a: a < b ? a : b, b: a < b ? b : a, score: score ?? 0 });
    }
  };

  let source = 'empty';
  try {
    if (env?.VECTORIZE?.query && env?.AI?.run && ids.length) {
      const services = createNoteAiServices(env);
      const ns = await vectorNamespace(userId, profileId);
      let vectorHits = 0;
      for (const noteId of ids) {
        const note = await loadNotePlain(env, dataKey, userId, profileId, noteId);
        if (!note) continue;
        const [embedding] = await services.embeddings.embed([noteTextForEmbed(note.title, note.text)]);
        if (!embedding) continue;
        const query = await services.vectors.query(embedding, {
          topK: NOTE_AI_CLUSTER_QUERY_TOP_K + 1,
          returnMetadata: 'all',
          namespace: ns,
        });
        const selfVid = await vectorIdForNote(userId, profileId, noteId);
        for (const m of query?.matches || []) {
          if (m.id === selfVid) continue;
          const otherId = m.metadata?.noteId;
          if (!otherId) continue;
          pushEdge(noteId, otherId, m.score ?? 0);
          vectorHits += 1;
        }
      }
      if (vectorHits > 0 || edgeMap.size > 0) source = 'vector';
    }
  } catch (err) {
    console.error('[noteAi] collectSimilarityEdges vector failed', err?.message || err);
  }

  if (edgeMap.size === 0 && relatedFallbackScore != null && Number.isFinite(relatedFallbackScore)) {
    const allMeta = await listNoteAiMeta(env, dataKey, userId, profileId);
    const metaById = {};
    for (const m of allMeta) {
      if (m?.noteId) metaById[m.noteId] = m;
    }
    for (const e of edgesFromRelatedMeta(metaById, ids)) {
      pushEdge(e.a, e.b, relatedFallbackScore);
    }
    if (edgeMap.size > 0) source = 'related_meta';
  }

  return { edges: [...edgeMap.values()], source };
}

async function listProfileNoteIds(env, userId, profileId) {
  const { results } = await env.DB.prepare(
    'SELECT id FROM notes WHERE user_id = ? AND profile_id = ? LIMIT ?'
  ).bind(userId, profileId, NOTE_AI_CLUSTER_MAX_NOTES).all();
  return (results || []).map((row) => unscopedNoteId(profileId, row.id)).filter(Boolean);
}

/**
 * Near-duplicate groups via high cosine threshold (+ related_ids fallback).
 */
export async function detectNoteDuplicates(env, dataKey, userId, profileId, prefsInput) {
  const prefs = normalizeNoteAiPrefs(prefsInput);
  if (prefs.duplicates === false) return { groups: [], source: 'disabled' };

  await ensureNoteAiSchema(env);
  const noteIds = await listProfileNoteIds(env, userId, profileId);
  if (noteIds.length < 2) return { groups: [], source: 'empty' };

  const { edges, source } = await collectSimilarityEdges(
    env, dataKey, userId, profileId, noteIds, NOTE_AI_DUPLICATE_MIN_SCORE, { relatedFallbackScore: null }
  );
  const groups = findDuplicateGroups(noteIds, edges, NOTE_AI_DUPLICATE_MIN_SCORE);

  const hydrated = [];
  for (const members of groups) {
    const notes = [];
    let maxScore = 0;
    for (const edge of edges) {
      if (members.includes(edge.a) && members.includes(edge.b)) {
        maxScore = Math.max(maxScore, edge.score ?? 0);
      }
    }
    for (const mid of members) {
      const note = await loadNotePlain(env, dataKey, userId, profileId, mid);
      if (!note) continue;
      notes.push({
        noteId: mid,
        title: note.title || '',
        text: (note.text || '').slice(0, 160),
      });
    }
    if (notes.length >= 2) {
      hydrated.push({
        id: members.slice().sort().join('|'),
        noteIds: members,
        score: maxScore,
        notes,
      });
    }
  }

  return { groups: hydrated, source, edgeCount: edges.length };
}

/**
 * Suggest board x/y from similarity clusters (Vectorize or related meta).
 */
export async function organizeNotesLayout(env, dataKey, userId, profileId, prefsInput, layoutOptions = {}) {
  const prefs = normalizeNoteAiPrefs(prefsInput);
  if (prefs.organizeBoard === false) {
    return { positions: {}, clusters: [], source: 'disabled' };
  }

  await ensureNoteAiSchema(env);
  const noteIds = await listProfileNoteIds(env, userId, profileId);
  if (!noteIds.length) return { positions: {}, clusters: [], source: 'empty' };

  const { edges, source } = await collectSimilarityEdges(
    env,
    dataKey,
    userId,
    profileId,
    noteIds,
    NOTE_AI_CLUSTER_MIN_SCORE,
    { relatedFallbackScore: NOTE_AI_CLUSTER_MIN_SCORE }
  );
  const clusters = buildSimilarityClusters(noteIds, edges);
  const positions = layoutClusters(clusters, layoutOptions);

  return {
    positions,
    clusters,
    source,
    edgeCount: edges.length,
  };
}

/**
 * Phase 3: contextual RAG chat — retrieve top-K notes for this profile, then answer
 * strictly from that context (no generic chatbot memory).
 */
export async function answerNotesRagChat(env, dataKey, userId, profileId, questionInput, prefsInput) {
  const prefs = normalizeNoteAiPrefs(prefsInput);
  if (prefs.ragChat === false) {
    return {
      answer: 'El chat de notas está desactivado en Ajustes.',
      source: 'disabled',
      citedNoteIds: [],
      context: [],
    };
  }

  const question = sanitizeRagQuestion(questionInput);
  if (!question) {
    return {
      answer: 'Escribe una pregunta sobre tus notas.',
      source: 'empty',
      citedNoteIds: [],
      context: [],
    };
  }

  // Force semantic retrieval on (chat is profile-scoped; ignore search toggle for retrieve).
  const search = await semanticSearchNotes(env, dataKey, userId, profileId, question, {
    ...prefs,
    semanticSearch: true,
  });
  const filtered = (search.results || []).filter((r) => (r.score ?? 0) >= NOTE_AI_RAG_MIN_SCORE);
  const context = buildRagContextFromResults(filtered.length ? filtered : search.results, NOTE_AI_RAG_TOP_K);

  if (!context.length) {
    return {
      answer: 'No encuentro eso en tus notas.',
      source: search.source || 'empty',
      citedNoteIds: [],
      context: [],
    };
  }

  const services = createNoteAiServices(env);
  try {
    const result = await services.rag.answer({ question, contextNotes: context });
    return {
      answer: sanitizeRagAnswer(result?.answer) || answerFromNotesFallback(question, context).answer,
      source: result?.source === 'ai' ? 'ai' : 'fallback',
      citedNoteIds: Array.isArray(result?.citedNoteIds) ? result.citedNoteIds : context.map((c) => c.noteId),
      context,
      retrieveSource: search.source,
    };
  } catch (err) {
    console.error('[noteAi] rag chat failed', err?.message || err);
    const fallback = answerFromNotesFallback(question, context);
    return {
      ...fallback,
      context,
      retrieveSource: search.source,
    };
  }
}

export { markPending, scopedNoteId, unscopedNoteId, vectorIdForNote, vectorNamespace };
