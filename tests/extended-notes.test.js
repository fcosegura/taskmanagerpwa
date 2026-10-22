import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  NOTE_KIND_EXTENDED,
  buildExtendedNotePreview,
  countWords,
  createExtendedNote,
  isExtendedNote,
  isValidNoteKind,
  normalizeNoteKind,
} from '../src/extendedNotes.js';
import { buildNoteAiDisplay } from '../src/noteAi/display.js';
import { isValidBoardNote, normalizeDataPayload } from '../src/data/normalize.js';
import { buildNotePlainSnapshot } from '../src/d1-field-crypto.js';

const boardViewSource = readFileSync(new URL('../src/components/BoardView.jsx', import.meta.url), 'utf8');
const modalSource = readFileSync(new URL('../src/components/ExtendedNoteModal.jsx', import.meta.url), 'utf8');

describe('extendedNotes helpers', () => {
  test('detects and normalizes the extended kind', () => {
    assert.equal(isExtendedNote({ kind: 'extended' }), true);
    assert.equal(isExtendedNote({ kind: 'quick' }), false);
    assert.equal(isExtendedNote({}), false);
    assert.equal(isExtendedNote(null), false);
    assert.equal(normalizeNoteKind('extended'), 'extended');
    assert.equal(normalizeNoteKind('otro'), 'quick');
    assert.equal(normalizeNoteKind(undefined), 'quick');
    assert.equal(isValidNoteKind(undefined), true);
    assert.equal(isValidNoteKind('quick'), true);
    assert.equal(isValidNoteKind('extended'), true);
    assert.equal(isValidNoteKind('huge'), false);
  });

  test('builds a single-line preview truncated on a word boundary', () => {
    assert.equal(buildExtendedNotePreview('  Hola\n\nmundo  '), 'Hola mundo');
    const long = 'palabra '.repeat(40);
    const preview = buildExtendedNotePreview(long, 30);
    assert.ok(preview.endsWith('…'));
    assert.ok(preview.length <= 31);
    assert.doesNotMatch(preview, /palab…$/);
    assert.equal(buildExtendedNotePreview(''), '');
  });

  test('counts words', () => {
    assert.equal(countWords(''), 0);
    assert.equal(countWords('  uno dos\ntres  '), 3);
  });

  test('creates an empty extended note', () => {
    const note = createExtendedNote({ id: 'n1', now: new Date('2026-10-22T10:00:00Z') });
    assert.deepEqual(note, {
      id: 'n1', kind: NOTE_KIND_EXTENDED, title: '', text: '', createdAt: '2026-10-22T10:00:00.000Z', x: 24, y: 20,
    });
    assert.equal(isValidBoardNote(note), true);
  });
});

describe('extended notes persistence', () => {
  test('normalize keeps extended kind and drops unknown kinds', () => {
    const payload = normalizeDataPayload({
      tasks: [],
      boardNotes: [
        { id: 'a', title: 'A', text: 'x', createdAt: '2026-01-01', kind: 'extended' },
        { id: 'b', title: 'B', text: 'y', createdAt: '2026-01-01', kind: 'quick' },
      ],
    });
    assert.equal(payload.boardNotes[0].kind, 'extended');
    assert.equal('kind' in payload.boardNotes[1], false);
    assert.equal(isValidBoardNote({ id: 'c', title: '', text: '', createdAt: 'x', kind: 'raro' }), false);
  });

  test('note snapshot hash only changes for extended notes', () => {
    const base = { title: 't', text: 'x', x: 1, y: 2 };
    assert.deepEqual(buildNotePlainSnapshot(base), buildNotePlainSnapshot({ ...base, kind: 'quick' }));
    assert.equal(buildNotePlainSnapshot({ ...base, kind: 'extended' }).kind, 'extended');
    assert.equal('kind' in buildNotePlainSnapshot(base), false);
  });
});

describe('buildNoteAiDisplay', () => {
  const meta = {
    status: 'ready',
    summary: 'Resumen',
    classification: 'Trabajo',
    tags: ['auth', 'login'],
    taskSuggestions: ['Revisar login', 'Deploy'],
    entities: { tickets: ['MAPP-1'], urls: ['https://a.test'], people: ['Ana'] },
    dismissed: ['tag:login', 'task:Deploy', 'person:Ana'],
  };

  test('filters dismissed suggestions and respects prefs', () => {
    const view = buildNoteAiDisplay(meta, {});
    assert.deepEqual(view.tags, ['auth']);
    assert.deepEqual(view.taskSuggestions, ['Revisar login']);
    assert.deepEqual(view.entityChips.map((e) => e.v), ['MAPP-1', 'https://a.test']);
    assert.equal(view.summary, 'Resumen');
    assert.equal(view.classification, 'Trabajo');
    assert.equal(view.pending, false);

    const off = buildNoteAiDisplay(meta, { autotag: false, summary: false, classification: false, taskSuggestions: false, entities: false });
    assert.deepEqual(off.tags, []);
    assert.equal(off.summary, '');
    assert.equal(off.classification, null);
    assert.deepEqual(off.taskSuggestions, []);
    assert.deepEqual(off.entityChips, []);
  });

  test('handles missing meta', () => {
    const view = buildNoteAiDisplay(undefined, undefined);
    assert.deepEqual(view.tags, []);
    assert.equal(view.pending, false);
  });
});

describe('extended note UI wiring', () => {
  test('BoardView offers creation, expansion and modal opening', () => {
    assert.match(boardViewSource, /\+ Nota extendida/);
    assert.match(boardViewSource, /Convertir en nota extendida/);
    assert.match(boardViewSource, /<ExtendedNoteModal/);
    assert.match(boardViewSource, /buildExtendedNotePreview\(note\.text\)/);
  });

  test('ExtendedNoteModal uses useModalDialog and guards unsaved changes', () => {
    assert.match(modalSource, /useModalDialog\(/);
    assert.doesNotMatch(modalSource, /<dialog/);
    assert.match(modalSource, /Tienes cambios sin guardar/);
    assert.match(modalSource, /event\.key\.toLowerCase\(\) === 's'/);
  });
});
