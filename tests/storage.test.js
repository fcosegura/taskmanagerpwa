import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidTask,
  isValidEvent,
  normalizeDataPayload,
  fetchWorkspaceData,
  fetchCloudReadWithRetry,
  loadData,
  saveData,
  didLastLoadPreferLocal,
} from '../src/storage.js';

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

test('normalizeDataPayload normaliza subtasks legacy y prioridad urgent (C2)', () => {
  const payload = {
    tasks: [
      {
        id: 't1',
        name: 'Legacy',
        status: 'not_done',
        priority: 'urgent',
        subtasks: [{ id: 5, title: 'Sub legacy', completed: true }],
        plannedSlots: []
      },
      { id: 42, name: 'Tarea inválida' },
      { id: 't2', name: 'Válida', status: 'in_progress', priority: 'high', subtasks: [], plannedSlots: [] }
    ],
    boardNotes: [],
    events: []
  };

  const { tasks } = normalizeDataPayload(payload);

  // Per-item sanitation: only the invalid task is dropped, never the whole dataset.
  assert.equal(tasks.length, 2);
  const legacy = tasks.find((task) => task.id === 't1');
  assert.ok(legacy);
  assert.equal(legacy.priority, 'critical');
  assert.deepEqual(legacy.subtasks, [{ id: '5', text: 'Sub legacy', done: true }]);
  assert.ok(tasks.some((task) => task.id === 't2'));
});

test('normalizeDataPayload no descarta el dataset por entradas null/no-objeto (R5)', () => {
  const validTask = { id: 't1', name: 'Válida', status: 'not_done', priority: 'medium', subtasks: [], plannedSlots: [] };
  const validNote = { id: 'n1', title: 'Nota', text: 'Texto', createdAt: '2026-05-01T10:00:00Z' };
  const validEvent = { id: 'e1', title: 'Evento', color: '#2563eb', startDate: '2026-05-10' };

  const payload = {
    tasks: [null, validTask, 'basura', 42],
    boardNotes: [null, validNote, undefined],
    events: [null, validEvent, []],
  };

  const normalized = normalizeDataPayload(payload);

  assert.equal(normalized.tasks.length, 1);
  assert.equal(normalized.tasks[0].id, 't1');
  assert.equal(normalized.boardNotes.length, 1);
  assert.equal(normalized.boardNotes[0].id, 'n1');
  assert.equal(normalized.events.length, 1);
  assert.equal(normalized.events[0].id, 'e1');
});

test('normalizeDataPayload canonicaliza y conserva tareas con fecha de IA sin rellenar (R1)', () => {
  // Simula el payload que genera la IA/import con `2026-5-3` antes del fix.
  const aiTask = {
    id: 'ai-1',
    name: 'Tarea IA',
    status: 'not_done',
    priority: 'high',
    date: '2026-5-3',
    endDate: '2026/5/4',
    subtasks: [],
    plannedSlots: [],
  };
  const aiEvent = {
    id: 'ai-e1',
    title: 'Evento IA',
    color: '#2563eb',
    startDate: '2026/5/3',
    endDate: '2026-5-4',
  };

  const normalized = normalizeDataPayload({ tasks: [aiTask], boardNotes: [], events: [aiEvent] });

  // La tarea SOBREVIVE (no se descarta por fecha no canónica) y queda canónica.
  assert.equal(normalized.tasks.length, 1);
  assert.equal(normalized.tasks[0].date, '2026-05-03');
  assert.equal(normalized.tasks[0].endDate, '2026-05-04');
  assert.equal(normalized.events.length, 1);
  assert.equal(normalized.events[0].startDate, '2026-05-03');
  assert.equal(normalized.events[0].endDate, '2026-05-04');
});

test('isValidTask valida formato de fecha sin romper con campos opcionales vacíos (A7)', () => {
  const base = { id: 't', name: 'T', status: 'not_done', priority: 'medium', subtasks: [], plannedSlots: [] };
  assert.equal(isValidTask({ ...base, date: '2026-05-10' }), true);
  assert.equal(isValidTask({ ...base, date: '' }), true);
  assert.equal(isValidTask({ ...base, date: null }), true);
  assert.equal(isValidTask({ ...base }), true);
  assert.equal(isValidTask({ ...base, date: 'no-date' }), false);
  assert.equal(isValidTask({ ...base, date: '10/05/2026' }), false);
  assert.equal(isValidTask({ ...base, endDate: '2026/05/10' }), false);
});

test('isValidEvent valida formato de fecha de inicio (A7)', () => {
  const base = { id: 'e', title: 'Evento', color: '#2563eb' };
  assert.equal(isValidEvent({ ...base, startDate: '2026-05-10' }), true);
  assert.equal(isValidEvent({ ...base, startDate: '', endDate: '' }), false);
  assert.equal(isValidEvent({ ...base, startDate: 'no-date' }), false);
  assert.equal(isValidEvent({ ...base, startDate: '2026-05-10', endDate: '2026-05-12' }), true);
  assert.equal(isValidEvent({ ...base, startDate: '2026-05-10', endDate: '12/05/2026' }), false);
});

function createLocalStorageStub(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => store.clear(),
  };
}

test('loadData conserva local ante nube vacía con perfil explícito (C1)', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const localPayload = {
    tasks: [{ id: 't1', name: 'Local', status: 'not_done', priority: 'medium', subtasks: [], plannedSlots: [] }],
    boardNotes: [],
    events: []
  };
  globalThis.localStorage = createLocalStorageStub({
    'taskmanager_v1:p1': JSON.stringify(localPayload)
  });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      tasks: [],
      boardNotes: [],
      events: [],
      profiles: [{ id: 'p1', name: 'Uno' }],
      activeProfileId: 'p1'
    })
  });

  try {
    const data = await loadData('p1');
    assert.equal(data.tasks.length, 1);
    assert.equal(data.tasks[0].id, 't1');
    assert.equal(data.preferredLocal, true);
    assert.equal(didLastLoadPreferLocal(), true);

    // Kept local data must NOT be treated as synced: the next save pushes it up.
    let syncBody = null;
    globalThis.fetch = async (url, init) => {
      syncBody = JSON.parse(init.body);
      return { ok: true, status: 200 };
    };
    await saveData({ tasks: data.tasks, boardNotes: [], events: [] }, true, 'p1');
    assert.ok(syncBody.ops, 'esperaba un sync incremental (ops)');
    assert.equal(syncBody.ops.tasks.upserts.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }
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

test('fetchCloudReadWithRetry no reintenta respuestas no transitorias', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: false, status: 500 };
  };
  const resp = await fetchCloudReadWithRetry('/api/data', {}, { fetchImpl, wait: async () => {} });
  assert.equal(resp.status, 500);
  assert.equal(calls, 1);
});

test('fetchCloudReadWithRetry reintenta un 503 transitorio y devuelve el éxito', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return calls < 3 ? { ok: false, status: 503 } : { ok: true, status: 200 };
  };
  const resp = await fetchCloudReadWithRetry('/api/data', {}, { fetchImpl, wait: async () => {} });
  assert.equal(resp.status, 200);
  assert.equal(calls, 3);
});

test('fetchCloudReadWithRetry devuelve el último 503 tras agotar los intentos', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: false, status: 503 };
  };
  const resp = await fetchCloudReadWithRetry('/api/data', {}, { fetchImpl, wait: async () => {} });
  assert.equal(resp.status, 503);
  assert.equal(calls, 3);
});

test('fetchCloudReadWithRetry reintenta errores de red y propaga el último', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error('network down');
  };
  await assert.rejects(
    () => fetchCloudReadWithRetry('/api/data', {}, { fetchImpl, wait: async () => {} }),
    /network down/
  );
  assert.equal(calls, 3);
});
