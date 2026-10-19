import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData, saveData } from '../src/data/cloudSync.js';
import { readLocalPayload } from '../src/data/localStore.js';

function setup(t) {
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  t.after(() => {
    globalThis.localStorage = previousStorage;
    globalThis.fetch = previousFetch;
  });
}
const task = (id, name) => ({ id, name, status: 'not_done', priority: 'medium', subtasks: [], plannedSlots: [] });
const payload = (tasks = []) => ({ tasks, boardNotes: [], events: [] });

test('local save is independent from network and scoped to the workspace', async (t) => {
  setup(t);
  globalThis.fetch = () => { throw new Error('local saves must not call the API'); };
  await saveData(payload([task('a', 'Trabajo')]), false, 'local-a');
  await saveData(payload([task('b', 'Personal')]), false, 'local-b');
  await saveData(payload([task('legacy', 'Legacy')]));
  assert.equal(readLocalPayload('local-a').tasks[0].name, 'Trabajo');
  assert.equal(readLocalPayload('local-b').tasks[0].name, 'Personal');
  assert.equal(readLocalPayload().tasks[0].name, 'Legacy');
});

test('loading and saving across modules preserves per-workspace delta snapshots', async (t) => {
  setup(t);
  globalThis.fetch = async (url) => {
    const id = new URL(url, 'https://example.com').searchParams.get('profileId');
    return Response.json({ ...payload([task(id, id)]), activeProfileId: id, profiles: [] });
  };
  const a = await loadData('delta-a');
  const b = await loadData('delta-b');
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ success: true });
  };
  await saveData(payload([{ ...a.tasks[0], name: 'Editada' }]), true, 'delta-a');
  await saveData(payload([b.tasks[0], task('new-b', 'Nueva')]), true, 'delta-b');
  assert.equal(requests[0].profileId, 'delta-a');
  assert.deepEqual(requests[0].ops.tasks.upserts.map(({ id }) => id), ['delta-a']);
  assert.deepEqual(requests[0].ops.tasks.deletes, []);
  assert.equal(requests[1].profileId, 'delta-b');
  assert.deepEqual(requests[1].ops.tasks.upserts.map(({ id }) => id), ['new-b']);
  assert.deepEqual(requests[1].ops.tasks.deletes, []);
});

test('failed cloud writes keep the local copy and retry against the last acknowledged snapshot', async (t) => {
  setup(t);
  globalThis.fetch = async () => Response.json({ ...payload([task('old', 'Anterior')]), activeProfileId: 'retry-profile', profiles: [] });
  await loadData('retry-profile');
  const next = payload([task('new', 'Pendiente')]);
  globalThis.fetch = async () => Response.json({ error: 'unavailable' }, { status: 503 });
  await assert.rejects(saveData(next, true, 'retry-profile'), /unavailable/);
  assert.equal(readLocalPayload('retry-profile').tasks[0].name, 'Pendiente');
  let sent;
  globalThis.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return Response.json({ success: true });
  };
  await saveData(next, true, 'retry-profile');
  assert.deepEqual(sent.ops.tasks.deletes, ['old']);
  assert.deepEqual(sent.ops.tasks.upserts.map(({ id }) => id), ['new']);
});
