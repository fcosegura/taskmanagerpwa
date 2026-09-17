import { STATUS, normalizeStatuses } from './constants.js';

export const STORAGE_KEY = 'childTaskAllowedStatuses';

export function getDefaultChildTaskAllowedStatuses(statuses = STATUS) {
  return normalizeStatuses(statuses)
    .filter((s) => !s.isTerminal)
    .map((s) => s.v);
}

export function loadChildTaskAllowedStatuses(statuses = STATUS, storage = globalThis.localStorage) {
  const validKeys = new Set(normalizeStatuses(statuses).map((s) => s.v));
  const defaultAllowed = getDefaultChildTaskAllowedStatuses(statuses);

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

export function saveChildTaskAllowedStatuses(allowed, storage = globalThis.localStorage) {
  const next = Array.isArray(allowed) ? allowed : [];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/**
 * Whether a task in `statusId` can be offered as a child task.
 * A missing/undefined allowlist means no extra filter (legacy behavior).
 */
export function isChildTaskStatusAllowed(statusId, allowedStatuses) {
  if (!Array.isArray(allowedStatuses)) return true;
  return allowedStatuses.includes(statusId);
}
