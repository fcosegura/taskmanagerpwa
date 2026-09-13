import test from 'node:test';
import assert from 'node:assert/strict';
import { createVectorizeStore } from '../src/noteAi/adapters.js';
import {
  QUEUE_BATCH_LIMIT,
  enqueueNoteAiJobs,
  ensureNoteAiSchema,
  processNoteAiJob,
  vectorNamespace,
} from '../src/noteAi/pipeline.js';
import { layoutClusters } from '../src/noteAi/clustering.js';
import { decryptField, importDataEncryptionKey } from '../src/d1-field-crypto.js';
import worker from '../src/worker.js';

// --- B1: schema cache must stay cold until every critical DDL succeeds --------

test('ensureNoteAiSchema does not cache when critical DDL fails', async () => {
  let runCount = 0;
  const failingEnv = {
    DB: {
      prepare: () => ({
        run: async () => {
          runCount += 1;
          throw new Error('ddl unavailable');
        },
      }),
    },
  };
  await ensureNoteAiSchema(failingEnv);
  const afterFirst = runCount;
  assert.ok(afterFirst > 0, 'first call should attempt the DDL');
  await ensureNoteAiSchema(failingEnv);
  assert.ok(runCount > afterFirst, 'failed schema must be retried, not cached');
});

// --- A1: Vectorize delete must carry the per-profile namespace ----------------

test('createVectorizeStore.deleteByIds forwards the namespace option', async () => {
  const calls = [];
  const store = createVectorizeStore({
    deleteByIds: (ids, options) => {
      calls.push({ ids, options });
      return Promise.resolve();
    },
  });
  await store.deleteByIds(['a', 'b'], { namespace: 'ns-1' });
  await store.deleteByIds(['c']);
  assert.deepEqual(calls[0], { ids: ['a', 'b'], options: { namespace: 'ns-1' } });
  assert.equal(calls[1].options, undefined);
});

test('processNoteAiJob delete passes the vector namespace', async () => {
  const deleteCalls = [];
  const chain = (sql) => {
    const stmt = {
      sql,
      bindings: [],
      bind(...args) {
        stmt.bindings = args;
        return stmt;
      },
      run: async () => ({ success: true }),
      first: async () => null,
      all: async () => ({ results: [] }),
    };
    return stmt;
  };
  const env = {
    DB: { prepare: chain },
    VECTORIZE: {
      deleteByIds: (ids, options) => {
        deleteCalls.push({ ids, options });
        return Promise.resolve();
      },
    },
  };
  const result = await processNoteAiJob(env, null, {
    type: 'delete',
    userId: 'u1',
    profileId: 'p1',
    noteId: 'n1',
  });
  assert.equal(result.ok, true);
  const expectedNamespace = await vectorNamespace('u1', 'p1');
  assert.equal(deleteCalls.length, 1);
  assert.equal(deleteCalls[0].ids.length, 1);
  assert.deepEqual(deleteCalls[0].options, { namespace: expectedNamespace });
});

test('full-reset enqueues delete jobs for removed notes', async () => {
  const sendBatches = [];
  const db = {
    prepare: (sql) => {
      const stmt = {
        sql,
        bindings: [],
        bind(...args) {
          stmt.bindings = args;
          return stmt;
        },
        run: async () => ({ success: true }),
        first: async () => (sql.includes('FROM sessions') ? { user_id: 'u1' } : null),
        all: async () => {
          if (/PRAGMA table_info\((tasks|notes|events)\)/.test(sql)) {
            return {
              results: [
                { name: 'profile_id' },
                { name: 'name' },
                { name: 'description' },
                { name: 'url' },
                { name: 'notes' },
                { name: 'ticket_number' },
                { name: 'completed_at' },
                { name: 'status_log' },
                { name: 'end_date' },
              ],
            };
          }
          if (sql.includes('FROM notes')) {
            return { results: [{ id: 'u1:work::kept-note' }, { id: 'u1:work::removed-note' }] };
          }
          return { results: [] };
        },
      };
      return stmt;
    },
    batch: async (statements) => (statements || []).map(() => ({ success: true })),
  };
  const env = {
    DB: db,
    DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    NOTES_AI_QUEUE: {
      send: () => Promise.resolve(),
      sendBatch: (messages) => {
        sendBatches.push(messages);
        return Promise.resolve();
      },
    },
  };
  const request = new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: {
      Cookie: `taskmanager_session=${'b'.repeat(64)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payload: {
        tasks: [],
        boardNotes: [{ id: 'kept-note', title: 'Kept', text: 'body', x: 0, y: 0 }],
        events: [],
      },
    }),
  });
  const response = await worker.fetch(request, env, { waitUntil() {} });
  assert.equal(response.status, 200);
  const bodies = sendBatches.flat().map((message) => message.body);
  const deletes = bodies.filter((body) => body.type === 'delete');
  const analyzes = bodies.filter((body) => body.type === 'analyze');
  assert.deepEqual(deletes.map((body) => body.noteId), ['removed-note']);
  assert.deepEqual(analyzes.map((body) => body.noteId), ['kept-note']);
});

// --- A2: sendBatch must be chunked at 100 messages ----------------------------

test('enqueueNoteAiJobs chunks sendBatch at QUEUE_BATCH_LIMIT', async () => {
  const batches = [];
  const env = {
    NOTES_AI_QUEUE: {
      send: () => Promise.resolve(),
      sendBatch: (messages) => {
        batches.push(messages);
        return Promise.resolve();
      },
    },
  };
  const jobs = Array.from({ length: 250 }, (_, index) => ({ type: 'analyze', noteId: `n${index}` }));
  await enqueueNoteAiJobs(env, null, jobs);
  assert.equal(batches.length, 3);
  assert.ok(batches.every((batch) => batch.length <= QUEUE_BATCH_LIMIT));
  assert.deepEqual(batches.map((batch) => batch.length), [100, 100, 50]);
  assert.deepEqual(batches[0][0], { body: jobs[0] });
});

test('enqueueNoteAiJobs sends a single job via sendBatch', async () => {
  const batches = [];
  const env = {
    NOTES_AI_QUEUE: {
      send: () => Promise.resolve(),
      sendBatch: (messages) => {
        batches.push(messages);
        return Promise.resolve();
      },
    },
  };
  await enqueueNoteAiJobs(env, null, [{ type: 'analyze', noteId: 'only' }]);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 1);
});

// --- B5: layout options are clamped -------------------------------------------

test('layoutClusters clamps hostile layout options', () => {
  const positions = layoutClusters([['a']], {
    padding: -50,
    gapX: -10,
    gapY: -10,
    clusterGapX: -5,
    clusterGapY: -5,
    maxPerRow: -3,
    noteWidth: -100,
    noteHeight: -100,
    boardWidth: 0,
  });
  assert.deepEqual(positions.a, { x: 0, y: 0 });
});

// --- B3: ciphertext-shaped decrypt failures never leak ciphertext -------------

test('decryptField returns null for undecryptable ciphertext', async () => {
  const key = await importDataEncryptionKey('0'.repeat(64));
  assert.equal(await decryptField(key, 'legacy plaintext'), 'legacy plaintext');
  assert.equal(await decryptField(key, null), null);
  const malformed = `v1.${btoa('short')}`;
  assert.equal(await decryptField(key, malformed), null);
  const badCipher = `v1.${btoa('definitely-not-a-valid-ciphertext-blob')}`;
  assert.equal(await decryptField(key, badCipher), null);
});
