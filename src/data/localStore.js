import { STORAGE_KEY } from '../constants.js';
import { normalizeDataPayload } from './normalize.js';

export const ACTIVE_PROFILE_STORAGE_KEY = 'taskmanager_active_profile';

export function profileStorageKey(profileId) {
  return profileId ? `${STORAGE_KEY}:${profileId}` : STORAGE_KEY;
}

export function readLocalPayload(profileId) {
  try {
    const primaryRaw = localStorage.getItem(profileStorageKey(profileId));
    if (primaryRaw) return normalizeDataPayload(JSON.parse(primaryRaw));
  } catch (e) {
    console.error("Error cargando local (perfil):", e);
  }
  if (!profileId) {
    // Legacy fallback only for default/no-profile scope.
    try {
      const legacyRaw = localStorage.getItem(STORAGE_KEY);
      if (legacyRaw) return normalizeDataPayload(JSON.parse(legacyRaw));
    } catch (e) {
      console.error("Error cargando local (legacy):", e);
    }
  }
  return { tasks: [], boardNotes: [], events: [] };
}

export function hasAnyData(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return (
    (Array.isArray(payload.tasks) && payload.tasks.length > 0) ||
    (Array.isArray(payload.boardNotes) && payload.boardNotes.length > 0) ||
    (Array.isArray(payload.events) && payload.events.length > 0)
  );
}

export function writeLocalPayload(payload, profileId = null) {
  localStorage.setItem(profileStorageKey(profileId), JSON.stringify(payload));
}

const CUSTOM_STATUSES_STORAGE_KEY = 'taskmanager_custom_statuses';

function customStatusesStorageKey(profileId) {
  return `${CUSTOM_STATUSES_STORAGE_KEY}_${profileId || 'default'}`;
}

/** Custom statuses cached for a profile (falls back to the legacy global key), or null. */
export function readLocalCustomStatuses(profileId) {
  try {
    const stored = localStorage.getItem(customStatusesStorageKey(profileId))
      || localStorage.getItem(CUSTOM_STATUSES_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalCustomStatuses(profileId, statuses) {
  try {
    localStorage.setItem(customStatusesStorageKey(profileId), JSON.stringify(statuses));
  } catch {
    // El guardado local puede fallar por cuota o modo privado.
  }
}

const NOTE_AI_META_CACHE_PREFIX = 'taskmanager_note_ai_meta:';

export function cacheNoteAiMetaLocal(profileId, metaList) {
  if (!profileId) return;
  try {
    localStorage.setItem(
      `${NOTE_AI_META_CACHE_PREFIX}${profileId}`,
      JSON.stringify({ at: Date.now(), meta: Array.isArray(metaList) ? metaList : [] })
    );
  } catch {
    // ignore
  }
}

export function loadCachedNoteAiMeta(profileId) {
  if (!profileId) return [];
  try {
    const raw = localStorage.getItem(`${NOTE_AI_META_CACHE_PREFIX}${profileId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.meta) ? parsed.meta : [];
  } catch {
    return [];
  }
}
