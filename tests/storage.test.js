import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTask, normalizeDataPayload, fetchWorkspaceData } from '../src/storage.js';

test('isValidTask validates standard task', () => {
  const task = {
    id: '1',
    name: 'Test Task',
    status: 'in_progress',
    priority: 'medium',
    subtasks: [],
    plannedSlots: []
  };
  assert.equal(isValidTask(task), true);
});

test('isValidTask validates task with custom status', () => {
  const task = {
    id: '1',
    name: 'Test Task',
    status: 'custom_qa_status',
    priority: 'medium',
    subtasks: [],
    plannedSlots: []
  };
  assert.equal(isValidTask(task), true);
});

test('isValidTask rejects task with empty status', () => {
  const task = {
    id: '1',
    name: 'Test Task',
    status: '',
    priority: 'medium',
    subtasks: [],
    plannedSlots: []
  };
  assert.equal(isValidTask(task), false);
});

test('normalizeDataPayload preserves custom status tasks', () => {
  const payload = {
    tasks: [
      {
        id: '1',
        name: 'Task 1',
        status: 'custom_status',
        priority: 'high',
        subtasks: [],
        plannedSlots: []
      }
    ],
    boardNotes: [],
    events: []
  };
  const normalized = normalizeDataPayload(payload);
  assert.equal(normalized.tasks.length, 1);
  assert.equal(normalized.tasks[0].status, 'custom_status');
});

function withFetchStub(handler, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.fetch = originalFetch;
    });
}

test('fetchWorkspaceData extrae y normaliza los customStatuses del perfil solicitado', async () => {
  await withFetchStub(
    async () => ({
      ok: true,
      json: async () => ({
        tasks: [],
        boardNotes: [],
        events: [],
        profiles: [
          {
            id: 'p1',
            name: 'Uno',
            customStatuses: [
              {
                v: 'custom_a',
                label: 'Estado A',
                theme: 'info',
                kind: 'active',
                tv: '--color-text-info',
                bv: '--color-background-info',
                bov: '--color-border-info',
              },
            ],
          },
          { id: 'p2', name: 'Dos', customStatuses: [{ v: 'custom_b', label: 'Estado B' }] },
        ],
      }),
    }),
    async () => {
      const data = await fetchWorkspaceData('p1');
      assert.ok(Array.isArray(data.customStatuses));
      assert.equal(data.customStatuses.length, 1);
      const status = data.customStatuses[0];
      assert.equal(status.v, 'custom_a');
      assert.equal(status.label, 'Estado A');
      assert.equal(status.kind, 'active');
      assert.equal(status.isTerminal, false);
      assert.equal(status.canBeFocused, true);
      assert.equal(status.sortWeight, 100);
      assert.equal(status.theme, 'info');
      assert.equal(status.tv, '--color-text-info');
      assert.equal(status.bv, '--color-background-info');
      assert.equal(status.bov, '--color-border-info');
    }
  );
});

test('fetchWorkspaceData no toma estados de otro perfil', async () => {
  await withFetchStub(
    async () => ({
      ok: true,
      json: async () => ({
        tasks: [],
        profiles: [
          { id: 'p1', name: 'Uno', customStatuses: [{ v: 'custom_a', label: 'Estado A' }] },
          { id: 'p2', name: 'Dos', customStatuses: [{ v: 'custom_b', label: 'Estado B', kind: 'done', isTerminal: true }] },
        ],
      }),
    }),
    async () => {
      const data = await fetchWorkspaceData('p2');
      assert.ok(Array.isArray(data.customStatuses));
      assert.equal(data.customStatuses.length, 1);
      assert.equal(data.customStatuses[0].v, 'custom_b');
      assert.equal(data.customStatuses[0].kind, 'done');
      assert.equal(data.customStatuses[0].isTerminal, true);
      assert.equal(data.customStatuses.some((s) => s.v === 'custom_a'), false);
    }
  );
});

test('fetchWorkspaceData normaliza estados legacy sin metadata semántica', async () => {
  await withFetchStub(
    async () => ({
      ok: true,
      json: async () => ({
        tasks: [],
        profiles: [
          { id: 'p1', name: 'Uno', customStatuses: [{ v: 'legacy_x', label: 'Legacy X' }] },
        ],
      }),
    }),
    async () => {
      const data = await fetchWorkspaceData('p1');
      const status = data.customStatuses[0];
      assert.equal(status.v, 'legacy_x');
      assert.equal(status.label, 'Legacy X');
      assert.equal(status.kind, 'backlog');
      assert.equal(status.isTerminal, false);
      assert.equal(status.canBeFocused, true);
      assert.equal(status.sortWeight, 50);
    }
  );
});

test('fetchWorkspaceData no falla si faltan profiles o customStatuses', async () => {
  await withFetchStub(
    async () => ({
      ok: true,
      json: async () => ({ tasks: [] }),
    }),
    async () => {
      const data = await fetchWorkspaceData('p1');
      assert.deepEqual(data.tasks, []);
      assert.equal('customStatuses' in data, false);
    }
  );

  await withFetchStub(
    async () => ({
      ok: true,
      json: async () => ({
        tasks: [],
        profiles: [{ id: 'p1', name: 'Uno' }],
      }),
    }),
    async () => {
      const data = await fetchWorkspaceData('p1');
      assert.equal('customStatuses' in data, false);
    }
  );
});

test('fetchWorkspaceData lanza error si la respuesta no es ok', async () => {
  await withFetchStub(
    async () => ({ ok: false, status: 500 }),
    async () => {
      await assert.rejects(() => fetchWorkspaceData('p1'), /No se pudo leer el workspace/);
    }
  );
});
