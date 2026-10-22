import { json } from '../http.js';
import { resolveProfileId } from '../profiles.js';
import { scopedEntityId, unscopedEntityId } from '../entityIds.js';
import { shortHashForLog } from '../logging.js';
import { normalizeSyncBody, checkSyncLimits } from '../syncValidation.js';
import { prepareTaskUpsert, prepareNoteUpsert, prepareEventUpsert, readWorkspaceData } from '../repositories/entities.js';
import { enqueueNoteAiJobs } from '../../noteAi/pipeline.js';

export async function handleDataRoutes({ request, path, env, ctx, userId, profileId, dataKey, taskSchema }) {
  if (request.method === 'GET' && path === '/data') {
    return json(await readWorkspaceData(env, dataKey, userId, profileId));
  }
  if (request.method === 'POST' && path === '/sync') {
    const syncStartedAt = Date.now();
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }
    const normalizedBody = normalizeSyncBody(body);
    if (!normalizedBody) {
      return json({ error: 'Payload inválido' }, { status: 400 });
    }
    const limitCheck = checkSyncLimits(normalizedBody);
    if (!limitCheck.ok) {
      return json({ error: limitCheck.error }, { status: 413 });
    }
    const syncProfileId = await resolveProfileId(env, userId, normalizedBody.profileId, dataKey);
    const batch = [];
    let taskCount = 0;
    let noteCount = 0;
    let eventCount = 0;
    const noteAiJobs = [];

    if (normalizedBody.mode === 'payload') {
      const { tasks, boardNotes, events } = normalizedBody.payload;
      taskCount = tasks.length;
      noteCount = boardNotes.length;
      eventCount = events.length;

      // Full reset replaces the whole note set, so vectors for notes that
      // no longer exist would otherwise be orphaned. Detect the removed ids
      // before the batch deletes them and enqueue best-effort vector cleanup.
      let storedNoteIds = [];
      try {
        const { results } = await env.DB.prepare(
          'SELECT id FROM notes WHERE user_id = ? AND profile_id = ?'
        ).bind(userId, syncProfileId).all();
        storedNoteIds = (results || [])
          .map((row) => unscopedEntityId(syncProfileId, row.id))
          .filter(Boolean);
      } catch (err) {
        console.error('[sync] full-reset note id lookup failed', err?.name || 'error');
      }
      const nextNoteIds = new Set(boardNotes.map((n) => n?.id).filter(Boolean));
      for (const removedId of storedNoteIds) {
        if (nextNoteIds.has(removedId)) continue;
        noteAiJobs.push({
          type: 'delete',
          userId,
          profileId: syncProfileId,
          noteId: removedId,
        });
      }

      batch.push(
        env.DB.prepare("DELETE FROM tasks WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId),
        env.DB.prepare("DELETE FROM notes WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId),
        env.DB.prepare("DELETE FROM events WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId),
        env.DB.prepare("DELETE FROM note_ai_meta WHERE user_id = ? AND profile_id = ?").bind(userId, syncProfileId)
      );

      for (const t of tasks) {
        batch.push(await prepareTaskUpsert(env, dataKey, syncProfileId, userId, t, taskSchema));
      }
      for (const n of boardNotes) {
        batch.push(await prepareNoteUpsert(env, dataKey, syncProfileId, userId, n));
        if (n?.id) {
          noteAiJobs.push({
            type: 'analyze',
            userId,
            profileId: syncProfileId,
            noteId: n.id,
          });
        }
      }
      for (const e of events) {
        batch.push(await prepareEventUpsert(env, dataKey, syncProfileId, userId, e));
      }
    } else {
      const { tasks, notes, events } = normalizedBody.ops;
      taskCount = tasks.upserts.length + tasks.deletes.length;
      noteCount = notes.upserts.length + notes.deletes.length;
      eventCount = events.upserts.length + events.deletes.length;

      for (const taskId of tasks.deletes) {
        batch.push(
          env.DB.prepare("DELETE FROM tasks WHERE user_id = ? AND profile_id = ? AND id = ?")
            .bind(userId, syncProfileId, scopedEntityId(syncProfileId, taskId))
        );
      }
      for (const noteId of notes.deletes) {
        batch.push(
          env.DB.prepare("DELETE FROM notes WHERE user_id = ? AND profile_id = ? AND id = ?")
            .bind(userId, syncProfileId, scopedEntityId(syncProfileId, noteId))
        );
        noteAiJobs.push({
          type: 'delete',
          userId,
          profileId: syncProfileId,
          noteId,
        });
      }
      for (const eventId of events.deletes) {
        batch.push(
          env.DB.prepare("DELETE FROM events WHERE user_id = ? AND profile_id = ? AND id = ?")
            .bind(userId, syncProfileId, scopedEntityId(syncProfileId, eventId))
        );
      }

      for (const t of tasks.upserts) {
        batch.push(await prepareTaskUpsert(env, dataKey, syncProfileId, userId, t, taskSchema));
      }
      for (const n of notes.upserts) {
        batch.push(await prepareNoteUpsert(env, dataKey, syncProfileId, userId, n));
        if (n?.id) {
          noteAiJobs.push({
            type: 'analyze',
            userId,
            profileId: syncProfileId,
            noteId: n.id,
          });
        }
      }
      for (const e of events.upserts) {
        batch.push(await prepareEventUpsert(env, dataKey, syncProfileId, userId, e));
      }
    }

    if (batch.length > 0) await env.DB.batch(batch);
    // Best-effort: the D1 batch is already committed, so a queue hiccup must
    // not turn a successful sync into a 500 the client would retry.
    try {
      await enqueueNoteAiJobs(env, ctx, noteAiJobs);
    } catch (err) {
      console.error('note-ai enqueue failed', {
        profile: await shortHashForLog(syncProfileId),
        error: String(err?.message || err),
      });
    }
    const userIdHash = await shortHashForLog(userId);
    console.log('[sync] write batch completed', {
      userIdHash,
      profileHash: await shortHashForLog(syncProfileId),
      mode: normalizedBody.mode,
      taskCount,
      noteCount,
      eventCount,
      noteAiJobs: noteAiJobs.length,
      statementCount: batch.length,
      elapsedMs: Date.now() - syncStartedAt
    });
    return json({ success: true, activeProfileId: syncProfileId });
  }
  return null;
}
