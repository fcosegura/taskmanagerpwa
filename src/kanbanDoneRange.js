import { STATUS, isTerminalStatus } from './constants.js';

/** Monday 00:00:00 local; week is Monday–Sunday. */
export function startOfLocalIsoWeekMs(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  const fromMonday = (dow + 6) % 7;
  x.setDate(x.getDate() - fromMonday);
  return x.getTime();
}

/**
 * Best-effort completion instant for a task: prefers `completedAt`, then falls
 * back to `updatedAt`, the latest status-log entry, and finally `createdAt`.
 * Returns '' when no timestamp can be determined.
 */
export function resolveTaskCompletionIso(task) {
  if (!task || typeof task !== 'object') return '';
  const direct = task.completedAt || task.completed_at;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const updated = task.updatedAt || task.updated_at;
  if (typeof updated === 'string' && updated.trim()) return updated.trim();
  if (Array.isArray(task.statusLog)) {
    for (let i = task.statusLog.length - 1; i >= 0; i -= 1) {
      const at = task.statusLog[i]?.at;
      if (typeof at === 'string' && at.trim()) return at.trim();
    }
  }
  const created = task.createdAt || task.created_at;
  if (typeof created === 'string' && created.trim()) return created.trim();
  return '';
}

/**
 * Whether a task's completion instant falls inside the Kanban "done" column time window.
 * Tasks without a determinable date are kept visible instead of silently disappearing.
 * @param {string} completedAtIso
 * @param {'week'|'two_weeks'|'month'|'all'} rangeKey
 */
export function isCompletedAtWithinKanbanRange(completedAtIso, rangeKey, now = new Date()) {
  if (rangeKey === 'all') return true;
  if (typeof completedAtIso !== 'string' || !completedAtIso.trim()) return true;
  const completed = new Date(completedAtIso.trim());
  if (!Number.isFinite(completed.getTime())) return true;
  const t = completed.getTime();
  if (rangeKey === 'week') {
    return t >= startOfLocalIsoWeekMs(now);
  }
  if (rangeKey === 'two_weeks') {
    const lower = new Date(now);
    lower.setHours(0, 0, 0, 0);
    lower.setDate(lower.getDate() - 13);
    return t >= lower.getTime();
  }
  if (rangeKey === 'month') {
    const lower = new Date(now);
    lower.setHours(0, 0, 0, 0);
    lower.setDate(lower.getDate() - 29);
    return t >= lower.getTime();
  }
  return true;
}

/** Sets `completedAt` when entering a terminal status, clears when leaving; preserves timestamp while terminal. */
export function mergeTaskCompletionMeta(prevTask, nextTask, statuses = STATUS) {
  const prevDone = isTerminalStatus(prevTask?.status, statuses);
  const nextDone = isTerminalStatus(nextTask.status, statuses);
  if (!nextDone) {
    return { ...nextTask, completedAt: '' };
  }
  if (!prevDone) {
    return { ...nextTask, completedAt: new Date().toISOString() };
  }
  const keep =
    (typeof prevTask?.completedAt === 'string' && prevTask.completedAt) ||
    (typeof nextTask?.completedAt === 'string' && nextTask.completedAt) ||
    '';
  return { ...nextTask, completedAt: keep || new Date().toISOString() };
}
