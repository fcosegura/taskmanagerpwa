import { sampleNoteForAnalysis } from '../src/noteAi/tagging.js';
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


test('extended note tags cover its themes regardless of paragraph order or generic title', () => {
  const paragraphs = [
    'El ritual de empezar una mañana tranquila tiene algo casi hipnótico, sobre todo cuando el resto del mundo parece empeñado en acelerar sin rumbo fijo. Todo comienza con ese rumor familiar del agua al calentarse, un murmullo constante que rompe el silencio denso de las primeras horas. No hace falta mirar el reloj; basta con ver cómo la luz del amanecer se filtra poco a poco por las rendijas de la persiana, proyectando líneas doradas sobre el suelo de madera y anunciando un día despejado.',
    'Sostener la taza caliente entre las manos es un pequeño ancla a la realidad. El vapor sube en espirales perezosas, trayendo consigo ese aroma tostado e intenso que despierta la mente mucho antes de que el primer sorbo haga su magia. En esos diez minutos de tregua no hay correos electrónicos urgentes que responder, ni listas interminables de pendientes, ni notificaciones parpadeando en la esquina de una pantalla. Solo existe la calma suspendida de quien observa la calle todavía desierta a través de la ventana, donde apenas cruza algún paseante solitario con paso pausado.',
    'A veces olvidamos que estos momentos diminutos son los que verdaderamente sostienen el ritmo de la rutina. Nos pasamos la vida planificando el siguiente gran paso, ajustando agendas y buscando una eficiencia implacable en cada rincón del día a día, pero la verdadera lucidez suele aparecer justo en estas pausas involuntarias. Una bocanada de aire fresco al abrir el balcón, el sonido lejano de la ciudad que empieza a desperezarse y la sensación de que, al menos por unos instantes, el tiempo no corre en nuestra contra. Es un espacio breve pero suficiente para ordenar los pensamientos y encarar la jornada con serenidad.',
  ];
  const tags = extractTagsFallback('Test1', paragraphs.join('\n\n'));
  assert.ok(tags.includes('calma'));
  assert.ok(tags.includes('rutina'));
  assert.ok(tags.includes('reflexión'));
  assert.ok(!tags.some((tag) => ['test1', 'empezar'].includes(tag)));
  assert.deepEqual(tags, extractTagsFallback('Otro título', [...paragraphs].reverse().join('\n\n')));
});

test('analyzer receives complete short notes and samples the middle and end of long notes', async () => {
  const text = 'A'.repeat(10000) + 'M'.repeat(10000) + 'Z'.repeat(10000);
  const excerpt = sampleNoteForAnalysis(text);
  assert.ok(excerpt.length <= 8000);
  assert.ok(excerpt.includes('MMMM'));
  assert.ok(excerpt.startsWith('AAAA'));
  assert.ok(excerpt.endsWith('ZZZZ'));
  const short = 'Ritual al inicio. ' + 'Texto de la nota. '.repeat(250) + 'Conclusión: calma y serenidad.';
  let prompt;
  const ai = { async run(model, options) { prompt = options.messages[1].content; return { response: '{"tags":["calma"]}' }; } };
  await createWorkersAiNoteAnalyzer(ai).analyze({ title: 'Test1', text: short, prefs: {} });
  assert.ok(prompt.includes(short));
});
