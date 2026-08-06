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
import {
  buildSimilarityClusters,
  findDuplicateGroups,
  layoutClusters,
  organizeNotesFromMeta,
} from '../src/noteAi/clustering.js';

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

test('buildSimilarityClusters unions connected notes', () => {
  const clusters = buildSimilarityClusters(
    ['a', 'b', 'c', 'd'],
    [
      { a: 'a', b: 'b', score: 0.9 },
      { a: 'b', b: 'c', score: 0.7 },
    ]
  );
  assert.equal(clusters.length, 2);
  assert.deepEqual(clusters[0], ['a', 'b', 'c']);
  assert.deepEqual(clusters[1], ['d']);
});

test('findDuplicateGroups drops singletons and respects threshold', () => {
  const groups = findDuplicateGroups(
    ['a', 'b', 'c'],
    [
      { a: 'a', b: 'b', score: 0.95 },
      { a: 'b', b: 'c', score: 0.5 },
    ],
    0.88
  );
  assert.deepEqual(groups, [['a', 'b']]);
});

test('layoutClusters places members without overlap in cluster', () => {
  const positions = layoutClusters([['a', 'b'], ['c']], {
    noteWidth: 120,
    noteHeight: 120,
    boardWidth: 600,
    gapX: 10,
    gapY: 10,
    clusterGapX: 20,
    padding: 0,
    maxPerRow: 2,
  });
  assert.deepEqual(positions.a, { x: 0, y: 0 });
  assert.deepEqual(positions.b, { x: 130, y: 0 });
  assert.ok(positions.c.x >= 270);
});

test('organizeNotesFromMeta uses related ids offline', () => {
  const result = organizeNotesFromMeta(
    ['n1', 'n2', 'n3'],
    {
      n1: { relatedIds: ['n2'] },
      n2: { relatedIds: ['n1'] },
      n3: { relatedIds: [] },
    },
    { noteWidth: 100, boardWidth: 600, padding: 10 }
  );
  assert.equal(result.source, 'related_meta');
  assert.equal(result.clusters[0].length, 2);
  assert.ok(result.positions.n1);
  assert.ok(result.positions.n3);
});

test('normalizeNoteAiPrefs includes phase-2 toggles', () => {
  const prefs = normalizeNoteAiPrefs({});
  assert.equal(prefs.duplicates, true);
  assert.equal(prefs.organizeBoard, true);
  const off = normalizeNoteAiPrefs({ duplicates: false, organizeBoard: false });
  assert.equal(off.duplicates, false);
  assert.equal(off.organizeBoard, false);
});

test('normalizeNoteAiPrefs includes phase-3 graph and ragChat', () => {
  const prefs = normalizeNoteAiPrefs({});
  assert.equal(prefs.graph, true);
  assert.equal(prefs.ragChat, true);
  const off = normalizeNoteAiPrefs({ graph: false, ragChat: false });
  assert.equal(off.graph, false);
  assert.equal(off.ragChat, false);
});
