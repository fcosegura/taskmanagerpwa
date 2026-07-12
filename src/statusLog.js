export const MAX_STATUS_LOG_ENTRIES = 100;

export function isValidStatusLogEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const { id, toStatus, comment, at, fromStatus } = entry;
  if (typeof id !== 'string' || typeof toStatus !== 'string' || typeof comment !== 'string' || typeof at !== 'string') {
    return false;
  }
  if (toStatus.trim().length === 0) return false;
  if (fromStatus != null && fromStatus !== '' && typeof fromStatus !== 'string') return false;
  return comment.trim().length >= 1 && !Number.isNaN(Date.parse(at));
}

export function normalizeStatusLog(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidStatusLogEntry).slice(-MAX_STATUS_LOG_ENTRIES);
}

export function appendStatusLogEntry(task, { fromStatus, toStatus, comment, at = new Date().toISOString(), id }) {
  const entry = {
    id: typeof id === 'string' ? id : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    fromStatus: fromStatus ?? null,
    toStatus,
    comment: String(comment || '').trim(),
    at,
  };
  if (!isValidStatusLogEntry(entry)) {
    throw new Error('Entrada de historial de estado inválida.');
  }
  const previous = normalizeStatusLog(task?.statusLog);
  return {
    ...task,
    statusLog: [...previous, entry].slice(-MAX_STATUS_LOG_ENTRIES),
  };
}
