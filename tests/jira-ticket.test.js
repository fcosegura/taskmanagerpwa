import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyJiraAutofillFromUrl,
  applyTicketNumberToTaskName,
  extractJiraTicketFromUrl,
  getJiraTaskDefaultsFromUrl,
  inheritTicketFromParentTask,
  isJiraCategory,
} from '../src/jiraTicket.js';

test('isJiraCategory detects jira case-insensitive', () => {
  assert.equal(isJiraCategory('Jira Backend'), true);
  assert.equal(isJiraCategory('mi JIRA board'), true);
  assert.equal(isJiraCategory('backend'), false);
});

test('applyTicketNumberToTaskName appends suffix once', () => {
  assert.equal(applyTicketNumberToTaskName('Implementar login', 'ABC-123'), 'Implementar login [ABC-123]');
  assert.equal(applyTicketNumberToTaskName('Implementar login [ABC-123]', 'ABC-123'), 'Implementar login [ABC-123]');
});

test('applyTicketNumberToTaskName replaces an existing ticket token', () => {
  assert.equal(applyTicketNumberToTaskName('Tarea [OLD-1]', 'NEW-2'), 'Tarea [NEW-2]');
});

test('applyTicketNumberToTaskName uses the ticket as title when name is empty', () => {
  assert.equal(applyTicketNumberToTaskName('', 'MAPP-1'), '[MAPP-1]');
});

test('inheritTicketFromParentTask copies missing child ticket and appends name', () => {
  const child = { id: 'child-1', name: 'Sub tarea', ticketNumber: '' };
  const parent = { id: 'parent-1', name: 'Padre', ticketNumber: 'XYZ-7' };
  const inherited = inheritTicketFromParentTask(parent, child);
  assert.equal(inherited.ticketNumber, 'XYZ-7');
  assert.equal(inherited.name, 'Sub tarea [XYZ-7]');
});

test('inheritTicketFromParentTask keeps child ticket when already defined', () => {
  const child = { id: 'child-1', name: 'Sub tarea [OWN-1]', ticketNumber: 'OWN-1' };
  const parent = { id: 'parent-1', name: 'Padre', ticketNumber: 'XYZ-7' };
  const inherited = inheritTicketFromParentTask(parent, child);
  assert.equal(inherited.ticketNumber, 'OWN-1');
  assert.equal(inherited.name, 'Sub tarea [OWN-1]');
});


test('extractJiraTicketFromUrl copies ticket from Jira browse URL', () => {
  assert.equal(
    extractJiraTicketFromUrl('https://betssongroup.atlassian.net/browse/MAPP-17394'),
    'MAPP-17394'
  );
  assert.equal(
    extractJiraTicketFromUrl('https://betssongroup.atlassian.net/browse/mapp-17394?focusedCommentId=1'),
    'MAPP-17394'
  );
  assert.equal(extractJiraTicketFromUrl('https://example.com/issues/MAPP-17394'), '');
});

test('getJiraTaskDefaultsFromUrl returns Jira Task defaults for MAPP tickets', () => {
  assert.deepEqual(
    getJiraTaskDefaultsFromUrl('https://betssongroup.atlassian.net/browse/MAPP-17394'),
    { category: 'Jira Task', priority: 'high' }
  );
  assert.equal(getJiraTaskDefaultsFromUrl('https://betssongroup.atlassian.net/browse/OTHER-1'), null);
});

test('applyJiraAutofillFromUrl fills ticket, category and priority for MAPP browse URLs', () => {
  const url = 'https://betssongroup.atlassian.net/browse/MAPP-17394';
  const result = applyJiraAutofillFromUrl(
    { name: 'Nueva tarea', priority: 'medium', category: '', ticketNumber: '', url: '' },
    url
  );

  assert.deepEqual(result, {
    name: 'Nueva tarea',
    priority: 'high',
    category: 'Jira Task',
    ticketNumber: 'MAPP-17394',
    url: '',
  });
});

test('applyJiraAutofillFromUrl keeps an explicit non-medium priority', () => {
  const url = 'https://betssongroup.atlassian.net/browse/MAPP-17394';
  const result = applyJiraAutofillFromUrl(
    { priority: 'critical', category: '', ticketNumber: '' },
    url
  );

  assert.equal(result.priority, 'critical');
  assert.equal(result.category, 'Jira Task');
});
