import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const copyTicketButtonSource = readFileSync(new URL('../src/components/CopyTicketButton.jsx', import.meta.url), 'utf8');
const taskRowSource = readFileSync(new URL('../src/components/TaskRow.jsx', import.meta.url), 'utf8');
const kanbanViewSource = readFileSync(new URL('../src/components/KanbanView.jsx', import.meta.url), 'utf8');

test('CopyTicketButton only renders when a ticket number is present and copies it', () => {
  assert.match(copyTicketButtonSource, /if \(!ticketNumber\) return null/);
  assert.match(copyTicketButtonSource, /navigator\.clipboard\.writeText\(ticketNumber\)/);
  assert.match(copyTicketButtonSource, /copiado/);
});

test('CopyTicketButton prevents card click and drag interactions', () => {
  assert.match(copyTicketButtonSource, /event\.stopPropagation\(\)/);
  assert.match(copyTicketButtonSource, /event\.preventDefault\(\)/);
  assert.match(copyTicketButtonSource, /draggable=\{false\}/);
});

test('TaskRow renders the copy ticket button with task ticketNumber', () => {
  assert.match(taskRowSource, /import CopyTicketButton from '\.\/CopyTicketButton\.jsx';/);
  assert.match(taskRowSource, /<CopyTicketButton ticketNumber=\{task\.ticketNumber\} \/>/);
});

test('KanbanView renders the copy ticket button with task ticketNumber', () => {
  assert.match(kanbanViewSource, /import CopyTicketButton from '\.\/CopyTicketButton\.jsx';/);
  assert.match(kanbanViewSource, /<CopyTicketButton ticketNumber=\{task\.ticketNumber\} \/>/);
});
