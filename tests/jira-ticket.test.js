import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTicketNumberToTaskName,
  extractJiraTicketFromUrl,
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
