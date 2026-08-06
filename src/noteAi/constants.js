/** Model IDs — swap here only; business logic uses adapters. */
export const NOTE_EMBEDDING_MODEL = '@cf/baai/bge-m3';
export const NOTE_EMBEDDING_DIMENSIONS = 1024;
export const NOTE_ANALYZER_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export const NOTE_CLASSIFICATIONS = [
  'Trabajo',
  'Personal',
  'Ideas',
  'Investigación',
  'Pendientes',
  'Referencia',
  'Otro',
];

export const DEFAULT_NOTE_AI_PREFS = Object.freeze({
  autotag: true,
  summary: true,
  entities: true,
  classification: true,
  related: true,
  taskSuggestions: true,
  semanticSearch: true,
  duplicates: true,
  organizeBoard: true,
});

export const NOTE_AI_PREFS_STORAGE_KEY = 'taskmanager_note_ai_prefs';

export const NOTE_AI_RELATED_TOP_K = 6;
export const NOTE_AI_SEARCH_TOP_K = 12;
export const NOTE_AI_RELATED_MIN_SCORE = 0.45;
export const NOTE_AI_SEARCH_MIN_SCORE = 0.22;

/** Phase 2: cluster / organize edges (cosine). */
export const NOTE_AI_CLUSTER_MIN_SCORE = 0.55;
export const NOTE_AI_CLUSTER_QUERY_TOP_K = 8;
/** Near-duplicate threshold (cosine); higher = stricter. */
export const NOTE_AI_DUPLICATE_MIN_SCORE = 0.88;
/** Cap notes scanned per duplicates/organize Vectorize pass. */
export const NOTE_AI_CLUSTER_MAX_NOTES = 80;

/** Bump when vector id / namespace scheme changes to force re-embed. */
export const NOTE_AI_VECTOR_SCHEMA = 2;

export const NOTE_AI_RATE_WINDOW_SEC = 60;
export const NOTE_AI_RATE_MAX_PER_WINDOW = 30;
