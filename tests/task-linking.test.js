import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStandaloneChildLink, normalizeTaskTicketFields } from '../src/taskLinking.js';

function baseTasks() {
  return [
    { id: 'parent', name: 'Padre', ticketNumber: 'ABC-1', category: 'Jira Task', dependencyTaskIds: [] },
    { id: 'child', name: 'Hijo', dependencyTaskIds: [] },
  ];
}

test('applyStandaloneChildLink añade la dependencia una sola vez (R6)', () => {
  const tasks = baseTasks();
  const next = applyStandaloneChildLink(tasks, {
    sourceTaskId: 'child',
    targetTaskId: 'parent',
    targetTask: tasks[0],
  });

  const parent = next.find((t) => t.id === 'parent');
  assert.deepEqual(parent.dependencyTaskIds, ['child']);
});

test('applyStandaloneChildLink es idempotente ante dos drops con snapshot obsoleto (R6)', () => {
  const tasks = baseTasks();
  const linkArgs = { sourceTaskId: 'child', targetTaskId: 'parent', targetTask: tasks[0] };

  const once = applyStandaloneChildLink(tasks, linkArgs);
  // Segundo drop aplicado sobre el MISMO snapshot obsoleto.
  const twice = applyStandaloneChildLink(tasks, linkArgs);

  assert.deepEqual(once.find((t) => t.id === 'parent').dependencyTaskIds, ['child']);
  assert.deepEqual(twice.find((t) => t.id === 'parent').dependencyTaskIds, ['child']);

  // Y aplicarlo sobre el resultado ya enlazado no duplica.
  const again = applyStandaloneChildLink(once, linkArgs);
  assert.deepEqual(again.find((t) => t.id === 'parent').dependencyTaskIds, ['child']);
});

test('applyStandaloneChildLink deduplica ids existentes y hereda el ticket (R6)', () => {
  const tasks = [
    { id: 'parent', name: 'Padre', ticketNumber: 'ABC-1', category: 'Jira Task', dependencyTaskIds: [] },
    { id: 'child', name: 'Hijo', dependencyTaskIds: ['x', 'x'] },
  ];
  const next = applyStandaloneChildLink(tasks, {
    sourceTaskId: 'child',
    targetTaskId: 'parent',
    targetTask: tasks[0],
  });
  const child = next.find((t) => t.id === 'child');
  assert.equal(child.ticketNumber, 'ABC-1');
  assert.equal(child.name, 'Hijo [ABC-1]');
  assert.deepEqual(next.find((t) => t.id === 'parent').dependencyTaskIds, ['child']);
});

test('normalizeTaskTicketFields normaliza categoría/ticket/nombre', () => {
  const normalized = normalizeTaskTicketFields({ name: '  arreglar bug  ', category: 'Jira Task', ticketNumber: ' abc-9 ' });
  assert.equal(normalized.ticketNumber, 'abc-9');
  assert.equal(normalized.name, 'arreglar bug [ABC-9]');
});
