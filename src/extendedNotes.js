// Notas extendidas: comparten título/texto con las notas rápidas (y por tanto todo el
// pipeline Note AI: tags, resumen, entidades, embeddings, búsqueda, RAG), pero en el
// tablero solo muestran un extracto y se editan en un modal dedicado.

export const NOTE_KIND_QUICK = 'quick';
export const NOTE_KIND_EXTENDED = 'extended';
export const EXTENDED_NOTE_PREVIEW_CHARS = 140;

export function isExtendedNote(note) {
  return note?.kind === NOTE_KIND_EXTENDED;
}

/** Solo 'extended' se persiste; cualquier otro valor equivale a nota rápida. */
export function normalizeNoteKind(kind) {
  return kind === NOTE_KIND_EXTENDED ? NOTE_KIND_EXTENDED : NOTE_KIND_QUICK;
}

export function isValidNoteKind(kind) {
  return kind === undefined || kind === null || kind === NOTE_KIND_QUICK || kind === NOTE_KIND_EXTENDED;
}

/** Extracto de una sola línea para la tarjeta del tablero (colapsa espacios y saltos). */
export function buildExtendedNotePreview(text, maxChars = EXTENDED_NOTE_PREVIEW_CHARS) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= maxChars) return flat;
  const cut = flat.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

export function countWords(text) {
  const flat = String(text || '').trim();
  return flat ? flat.split(/\s+/).length : 0;
}

export function createExtendedNote({ id, x = 24, y = 20, now = new Date() } = {}) {
  return {
    id,
    kind: NOTE_KIND_EXTENDED,
    title: '',
    text: '',
    createdAt: now.toISOString(),
    x,
    y,
  };
}
