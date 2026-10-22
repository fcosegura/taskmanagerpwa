import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanNoteTags, contentRelatedEdges, lexicalNoteScore } from '../src/noteAi/contentSignals.js';
import { extractTagsFallback, sanitizeAnalysisResult } from '../src/noteAi/fallbacks.js';
import { buildNoteGraphModel } from '../src/noteAi/graphLayout.js';
import { createWorkersAiNoteAnalyzer } from '../src/noteAi/adapters.js';

const examples = [
  { id: 'a', title: 'Prueba', text: 'Esta ews solo una prueba' },
  { id: 'b', title: 'prueba 2', text: 'otra prueba' },
  { id: 'c', title: 'Prueba', text: 'El ritual de empezar una mañana tranquila tiene algo casi hipnótico, sobre todo cuando el resto del mundo parece empeñado en acelerar sin rumbo fijo.' },
];

test('tags discard filler, deduplicate accents and preserve meaningful explicit topics', () => {
  assert.deepEqual(cleanNoteTags(['esta', 'solo', 'otra', 'sobre', 'todo', 'poco', 'paso', 'pero', '#ritual', 'RÍTUAL']), ['ritual']);
  const tags = extractTagsFallback('Rutina', 'El ritual de empezar una mañana tranquila, sobre todo cuando todo parece ir deprisa. #bienestar');
  assert.ok(tags.includes('bienestar'));
  assert.ok(tags.includes('ritual'));
  assert.ok(!tags.some((tag) => ['sobre', 'todo', 'pero', 'esta'].includes(tag)));
  assert.deepEqual(extractTagsFallback('Prueba', 'Esta ews solo una prueba'), ['prueba']);
});

test('partial AI responses keep useful tags rather than throwing into fallback', async () => {
  const ai = { async run() { return { response: JSON.stringify({ tags: ['sobre', 'ritual'], summary: 'Una rutina tranquila.' }) }; } };
  const result = await createWorkersAiNoteAnalyzer(ai).analyze({ title: '', text: examples[2].text, prefs: {} });
  assert.equal(result.source, 'ai');
  assert.deepEqual(result.tags, ['ritual']);
  assert.deepEqual(sanitizeAnalysisResult({ tags: ['ritual'] }).entities.people, []);
});

test('ritual search matches actual words and not unrelated notes or substrings', () => {
  assert.equal(lexicalNoteScore('ritual', examples[0]), 0);
  assert.equal(lexicalNoteScore('ritual', examples[1]), 0);
  assert.ok(lexicalNoteScore('ritual', examples[2]) > 0);
  assert.equal(lexicalNoteScore('ritual', { text: 'espiritual' }), 0);
  assert.ok(lexicalNoteScore('manana tranquila', examples[2]) > 0);
});

test('graph and related notes share deterministic content edges without AI metadata', () => {
  const edges = contentRelatedEdges(examples);
  assert.ok(edges.some((edge) => [edge.a, edge.b].sort().join(',') === 'a,b'));
  assert.ok(!edges.some((edge) => edge.a === 'c' || edge.b === 'c'), 'a generic shared title must not connect unrelated long content');
  assert.deepEqual(contentRelatedEdges([{ id: 'a', text: 'Sobre todo pero solo otra' }, { id: 'b', text: 'Sobre todo pero solo otra' }]), []);
  const graph = buildNoteGraphModel(examples, {});
  assert.ok(graph.clusters.some((ids) => ids.includes('a') && ids.includes('b')));
  assert.equal(graph.edges.length, 1);
});
