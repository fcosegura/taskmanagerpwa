import { DEFAULT_NOTE_AI_PREFS, NOTE_AI_PREFS_STORAGE_KEY } from './constants.js';

export function normalizeNoteAiPrefs(raw) {
  const base = { ...DEFAULT_NOTE_AI_PREFS };
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(base)) {
    if (typeof raw[key] === 'boolean') base[key] = raw[key];
  }
  return base;
}

export function loadNoteAiPrefsFromStorage(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(NOTE_AI_PREFS_STORAGE_KEY);
    if (!raw) return normalizeNoteAiPrefs(null);
    return normalizeNoteAiPrefs(JSON.parse(raw));
  } catch {
    return normalizeNoteAiPrefs(null);
  }
}

export function saveNoteAiPrefsToStorage(prefs, storage = globalThis.localStorage) {
  const normalized = normalizeNoteAiPrefs(prefs);
  try {
    storage?.setItem?.(NOTE_AI_PREFS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore quota / private mode
  }
  return normalized;
}
