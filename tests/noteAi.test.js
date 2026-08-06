import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeNoteFallback,
  extractEntitiesFallback,
  classifyNoteFallback,
  sanitizeAnalysisResult,
} from '../src/noteAi/fallbacks.js';
import { normalizeNoteAiPrefs } from '../src/noteAi/prefs.js';
import { buildNoteAiContentHashInput, stableStringify } from '../src/d1-field-crypto.js';
import { mergeRelatedNoteIds } from '../src/noteAi/pipeline.js';

test('extractEntitiesFallback finds urls tickets and platforms', () => {
  const entities = extractEntitiesFallback(
    'AUTH-12 login',
    'Revisar https://jira.example.com/browse/AUTH-12 en Jira y Slack'
  );
  assert.ok(entities.urls.some((u) => u.includes('https://')));
  assert.ok(entities.tickets.includes('AUTH-12'));
  assert.ok(entities.platforms.map((p) => p.toLowerCase()).includes('jira'));
});

test('classifyNoteFallback picks trabajo for meeting language', () => {
  const c = classifyNoteFallback('Standup', 'reunión con cliente sobre sprint');
  assert.equal(c, 'Trabajo');
});

test('analyzeNoteFallback respects prefs off switches', () => {
  const result = analyzeNoteFallback('Idea', 'investigar paper sobre embeddings', {
    autotag: false,
    summary: false,
    entities: false,
    classification: false,
    taskSuggestions: false,
  });
  assert.deepEqual(result.tags, []);
  assert.equal(result.summary, '');
  assert.equal(result.classification, null);
  assert.deepEqual(result.taskSuggestions, []);
  assert.deepEqual(result.entities.urls, []);
});

test('sanitizeAnalysisResult clamps unknown classification', () => {
  const result = sanitizeAnalysisResult({
    summary: 'x',
    tags: ['a', 'a', 'b'],
    classification: 'NoExiste',
    entities: { people: ['Ana'], projects: [], tickets: [], urls: [], platforms: [], dates: [] },
    taskSuggestions: ['Hacer X'],
    source: 'ai',
  });
  assert.equal(result.classification, 'Otro');
  assert.deepEqual(result.tags, ['a', 'b']);
  assert.equal(result.source, 'ai');
});

test('normalizeNoteAiPrefs fills defaults', () => {
  const prefs = normalizeNoteAiPrefs({ summary: false, unknown: true });
  assert.equal(prefs.summary, false);
  assert.equal(prefs.autotag, true);
  assert.equal(prefs.unknown, undefined);
});

test('note AI content hash ignores position fields', () => {
  const a = stableStringify(buildNoteAiContentHashInput('t', 'body'));
  const b = stableStringify(buildNoteAiContentHashInput('t', 'body'));
  assert.equal(a, b);
  assert.ok(!a.includes('"x"'));
});

test('mergeRelatedNoteIds includes reverse links and vector matches', () => {
  const merged = mergeRelatedNoteIds(
    'a',
    ['b'],
    [
      { noteId: 'c', relatedIds: ['a'] },
      { noteId: 'd', relatedIds: ['z'] },
    ],
    ['e', 'b', 'a']
  );
  assert.deepEqual(merged, ['b', 'c', 'e']);
});
