import {
  NOTE_ANALYZER_MODEL,
  NOTE_CLASSIFICATIONS,
  NOTE_EMBEDDING_MODEL,
} from './constants.js';
import { analyzeNoteFallback, sanitizeAnalysisResult } from './fallbacks.js';

/**
 * Adapter layer: swap model implementations without touching pipeline/business logic.
 */

export function createWorkersAiEmbeddingProvider(ai) {
  return {
    id: NOTE_EMBEDDING_MODEL,
    async embed(texts) {
      const list = (Array.isArray(texts) ? texts : [texts])
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .map((t) => (t.length ? t.slice(0, 8000) : ' '));
      if (!ai?.run) throw new Error('AI binding missing');
      const result = await ai.run(NOTE_EMBEDDING_MODEL, { text: list });
      const data = result?.data ?? result?.result?.data;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Empty embedding response');
      }
      return data.map((row) => {
        if (Array.isArray(row)) return row;
        if (row && Array.isArray(row.embedding)) return row.embedding;
        throw new Error('Unexpected embedding shape');
      });
    },
  };
}

export function createWorkersAiNoteAnalyzer(ai) {
  return {
    id: NOTE_ANALYZER_MODEL,
    async analyze({ title, text, prefs }) {
      if (!ai?.run) return analyzeNoteFallback(title, text, prefs);
      const prompt = [
        'Analiza la nota adhesiva en español. Responde SOLO JSON válido sin markdown:',
        '{"summary":"string max 2 frases","tags":["string"],"classification":"one of list",',
        '"entities":{"people":[],"projects":[],"tickets":[],"urls":[],"platforms":[],"dates":[]},',
        '"taskSuggestions":["acciones concretas opcionales"]}',
        `Clasificaciones válidas: ${NOTE_CLASSIFICATIONS.join(', ')}.`,
        'Si no hay datos para un campo, usa [] o "".',
        `Título: ${String(title || '').slice(0, 200)}`,
        `Texto: ${String(text || '').slice(0, 2500)}`,
      ].join('\n');

      try {
        const result = await ai.run(NOTE_ANALYZER_MODEL, {
          messages: [
            { role: 'system', content: 'Eres un organizador silencioso de notas. Solo JSON.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 420,
          temperature: 0.1,
        });
        const rawText = typeof result?.response === 'string'
          ? result.response
          : (typeof result?.result?.response === 'string' ? result.result.response : '');
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { ...analyzeNoteFallback(title, text, prefs), source: 'fallback' };
        const parsed = JSON.parse(jsonMatch[0]);
        return sanitizeAnalysisResult({ ...parsed, source: 'ai' }, prefs);
      } catch {
        return { ...analyzeNoteFallback(title, text, prefs), source: 'fallback' };
      }
    },
  };
}

export function createVectorizeStore(vectorize) {
  return {
    async upsert(vectors) {
      if (!vectorize?.upsert) return { skipped: true };
      return vectorize.upsert(vectors);
    },
    async query(vector, options) {
      if (!vectorize?.query) return { matches: [] };
      return vectorize.query(vector, options);
    },
    async deleteByIds(ids) {
      if (!vectorize?.deleteByIds || !ids?.length) return { skipped: true };
      return vectorize.deleteByIds(ids);
    },
  };
}

export function createNoteAiServices(env) {
  return {
    embeddings: createWorkersAiEmbeddingProvider(env?.AI),
    analyzer: createWorkersAiNoteAnalyzer(env?.AI),
    vectors: createVectorizeStore(env?.VECTORIZE),
  };
}
