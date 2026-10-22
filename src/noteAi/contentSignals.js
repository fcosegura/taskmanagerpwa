/** Shared, accent-insensitive content signals for tags, search and relationships. */
export function normalizeNoteText(value) {
  return String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const STOPWORDS = new Set(`de la el en y a los las un una para por con del que al es son se su sus lo le les o u como cuando donde quien cual cuales
si no ni ya aun hay fue era ser estar esta este esto estas estos esa ese eso esas esos estoy esta estan estaba estaban
mi mis tu tus te me nos os yo nosotros vosotros ellos ellas nosotros nuestro nuestra nuestros nuestras
mas menos muy mucho mucha muchos muchas poco poca pocos pocas algo alguien alguno alguna algunos algunas nada nadie
paso pasos otro otra otros otras todo toda todos todas solo sobre bajo entre hasta desde hacia sin ante tras pero porque pues aunque tambien tampoco
asi aqui ahi alli ahora luego antes despues siempre nunca cada vez tanto tanta mismo misma mismos mismas tiene tienen tener habia haber
puede pueden poder podria podemos hacer hace hecho dicho sea sino mientras durante mediante contra parece sobre todo
and the or to of in on for is are this that with from as at by an it its be been being was were has have had do does did
not but so only also just some any all into about than then there their them they we you your our out up down over under
these those such very more most other another each both either neither through can could should would will shall may might
`.split(/\s+/).filter(Boolean));

export function noteTokens(value, { meaningful = true, minLength = 3 } = {}) {
  const words = normalizeNoteText(value).match(/[\p{L}\p{N}]+(?:[+#-][\p{L}\p{N}]+)*/gu) || [];
  return words.filter((word) => word.length >= minLength && /\p{L}/u.test(word) && (!meaningful || !STOPWORDS.has(word)));
}

export function cleanNoteTags(tags) {
  const seen = new Set();
  return (Array.isArray(tags) ? tags : []).flatMap((tag) => {
    if (typeof tag !== 'string') return [];
    const label = tag.trim().replace(/^#+/, '').slice(0, 40);
    const key = normalizeNoteText(label);
    if (!label || seen.has(key) || !noteTokens(label, { minLength: 2 }).length) return [];
    seen.add(key);
    return [label];
  }).slice(0, 8);
}

/** All meaningful query terms must match for a short search, not a substring of another word. */
export function lexicalNoteScore(query, note) {
  const tokens = [...new Set(noteTokens(query, { minLength: 2 }))];
  // A query made entirely of stopwords can still be searched literally.
  const needles = tokens.length ? tokens : [...new Set(noteTokens(query, { meaningful: false, minLength: 1 }))];
  if (!needles.length) return 0;
  const title = new Set(noteTokens(note.title, { meaningful: false, minLength: 1 }));
  const body = new Set(noteTokens(note.text, { meaningful: false, minLength: 1 }));
  const hits = needles.filter((word) => title.has(word) || body.has(word));
  const coverage = hits.length / needles.length;
  if (coverage < (needles.length <= 2 ? 1 : 0.5)) return 0;
  return coverage * 0.8 + hits.filter((word) => title.has(word)).length / needles.length * 0.2;
}

/** Content overlap supplements unavailable/stale vector metadata, including offline. */
export function contentRelatedEdges(notes, topK = 6) {
  const list = (Array.isArray(notes) ? notes : []).filter((note) => note?.id);
  const tokensById = new Map();
  const postings = new Map();
  for (const note of list) {
    const words = new Set(noteTokens(`${note.title || ''}\n${note.text || ''}`));
    tokensById.set(note.id, words);
    for (const word of words) {
      if (!postings.has(word)) postings.set(word, []);
      postings.get(word).push(note.id);
    }
  }
  const edges = new Map();
  for (const [id, words] of tokensById) {
    const intersections = new Map();
    for (const word of words) {
      for (const other of postings.get(word)) {
        if (other !== id) intersections.set(other, (intersections.get(other) || 0) + 1);
      }
    }
    const candidates = [...intersections].map(([other, shared]) => ({
      a: id, b: other, score: shared / (words.size + tokensById.get(other).size - shared),
    })).filter((edge) => edge.score >= 0.25)
      .sort((a, b) => b.score - a.score || a.b.localeCompare(b.b)).slice(0, topK);
    for (const edge of candidates) {
      const key = JSON.stringify([edge.a, edge.b].sort());
      if (!edges.has(key)) edges.set(key, edge);
    }
  }
  return [...edges.values()];
}
