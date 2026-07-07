import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modalSource = readFileSync(new URL('../src/components/StatusChangeCommentModal.jsx', import.meta.url), 'utf8');

test('StatusChangeCommentModal submits on Enter key press without modifiers', () => {
  assert.match(modalSource, /onKeyDown=\{handleKeyDown\}/);
  assert.match(modalSource, /event\.key === 'Enter'/);
  assert.match(modalSource, /event\.preventDefault\(\)/);
  assert.match(modalSource, /requestSubmit\(\)/);
});
