import { STATUS, normalizeStatuses } from './constants.js';

export const STORAGE_KEY = 'nextFocusAllowedStatuses';

export function getDefaultNextFocusAllowedStatuses(statuses = STATUS) {
  return normalizeStatuses(statuses)
    .filter((s) => !s.isTerminal)
    .map((s) => s.v);
}

export function loadNextFocusAllowedStatuses(statuses = STATUS, storage = globalThis.localStorage) {
  const validKeys = new Set(normalizeStatuses(statuses).map((s) => s.v));
  const defaultAllowed = getDefaultNextFocusAllowedStatuses(statuses);

  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((v) => typeof v === 'string' && validKeys.has(v));
      }
    }
  } catch {
    // localStorage corrupto o inaccesible: caer al default.
  }

  return defaultAllowed;
}

export function saveNextFocusAllowedStatuses(allowed, storage = globalThis.localStorage) {
  const next = Array.isArray(allowed) ? allowed : [];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
