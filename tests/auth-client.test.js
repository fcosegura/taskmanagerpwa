import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSession, logoutSession } from '../src/api/auth.js';

function withFetch(t, impl) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = impl;
  t.after(() => { globalThis.fetch = previousFetch; });
}

test('checkSession reports an expired session only on 401', async (t) => {
  withFetch(t, async () => new Response('{}', { status: 401 }));
  assert.equal(await checkSession(), false);
});

test('checkSession reports an active session on 2xx', async (t) => {
  withFetch(t, async () => Response.json({ authenticated: true }));
  assert.equal(await checkSession(), true);
});

test('checkSession throws on transient server errors so the session is kept', async (t) => {
  withFetch(t, async () => new Response('{}', { status: 503 }));
  await assert.rejects(checkSession(), /503/);
});

test('logoutSession surfaces network errors to the caller', async (t) => {
  withFetch(t, async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(logoutSession(), /Failed to fetch/);
});
