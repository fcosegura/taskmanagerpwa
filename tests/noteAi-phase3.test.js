import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNoteGraphModel,
  layoutNoteGraph,
  layoutNodesInCircle,
} from '../src/noteAi/graphLayout.js';
import {
  answerFromNotesFallback,
  buildRagContextFromResults,
  buildRagPrompt,
  sanitizeRagAnswer,
  sanitizeRagQuestion,
} from '../src/noteAi/rag.js';
import { edgesFromRelatedMeta } from '../src/noteAi/clustering.js';

test('layoutNodesInCircle places single node at center', () => {
  const pos = layoutNodesInCircle(['a'], { cx: 100, cy: 50, radius: 40 });
  assert.deepEqual(pos.a, { x: 100, y: 50 });
});

test('layoutNoteGraph connects related notes in one cluster', () => {
  const edges = edgesFromRelatedMeta({
    n1: { relatedIds: ['n2'] },
    n2: { relatedIds: ['n1'] },
    n3: { relatedIds: [] },
  }, ['n1', 'n2', 'n3']);
  const { positions, clusters } = layoutNoteGraph(['n1', 'n2', 'n3'], edges, {
    width: 800,
    height: 400,
  });
  assert.ok(clusters.some((c) => c.includes('n1') && c.includes('n2')));
  assert.ok(positions.n1);
  assert.ok(positions.n2);
  assert.ok(positions.n3);
  assert.notDeepEqual(positions.n1, positions.n2);
});

test('buildNoteGraphModel returns nodes and undirected edges', () => {
  const model = buildNoteGraphModel(
    [
      { id: 'a', title: 'Alpha', text: 'one' },
      { id: 'b', title: 'Beta', text: 'two' },
    ],
    {
      a: { relatedIds: ['b'], classification: 'Trabajo', tags: ['sprint'], summary: 'Resumen' },
      b: { relatedIds: [] },
    },
    { width: 600, height: 400 }
  );
  assert.equal(model.nodes.length, 2);
  assert.equal(model.edges.length, 1);
  assert.equal(model.edges[0].a, 'a');
  assert.equal(model.edges[0].b, 'b');
  assert.equal(model.nodes.find((n) => n.id === 'a').classification, 'Trabajo');
});

test('sanitizeRagQuestion clamps length', () => {
  assert.equal(sanitizeRagQuestion('  hola  '), 'hola');
  assert.equal(sanitizeRagQuestion('x'.repeat(700)).length, 600);
});

test('buildRagContextFromResults dedupes and caps topK', () => {
  const ctx = buildRagContextFromResults([
    { noteId: 'a', title: 'A', text: 'body a', score: 0.9 },
    { noteId: 'a', title: 'A2', text: 'dup', score: 0.8 },
    { noteId: 'b', title: 'B', summary: 'sum b', score: 0.7 },
  ], 1);
  assert.equal(ctx.length, 1);
  assert.equal(ctx[0].noteId, 'a');
});

test('buildRagPrompt insists on context-only answers', () => {
  const { system, user } = buildRagPrompt('¿sprint?', [
    { noteId: '1', title: 'Standup', excerpt: 'revisar tickets' },
  ]);
  assert.match(system, /SOLO/i);
  assert.match(system, /No encuentro eso en tus notas/);
  assert.match(user, /Standup/);
  assert.match(user, /¿sprint\?/);
});

test('answerFromNotesFallback extracts matching notes', () => {
  const result = answerFromNotesFallback('sprint jira', [
    { noteId: '1', title: 'Standup sprint', excerpt: 'revisar jira AUTH-1' },
    { noteId: '2', title: 'Compra', excerpt: 'leche y pan' },
  ]);
  assert.equal(result.source, 'fallback');
  assert.ok(result.citedNoteIds.includes('1'));
  assert.match(result.answer, /Standup|sprint|jira/i);
});

test('answerFromNotesFallback refuses when no overlap', () => {
  const result = answerFromNotesFallback('quantum physics xyz', [
    { noteId: '1', title: 'Lista compra', excerpt: 'pan leche' },
  ]);
  assert.equal(result.answer, 'No encuentro eso en tus notas.');
  assert.deepEqual(result.citedNoteIds, []);
});

test('sanitizeRagAnswer trims', () => {
  assert.equal(sanitizeRagAnswer('  ok  '), 'ok');
});
