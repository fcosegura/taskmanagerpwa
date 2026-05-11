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
 * Whether a task's completion instant falls inside the Kanban "done" column time window.
 * @param {string} completedAtIso
 * @param {'week'|'two_weeks'|'month'|'all'} rangeKey
 */
export function isCompletedAtWithinKanbanRange(completedAtIso, rangeKey, now = new Date()) {
  if (rangeKey === 'all') return true;
  if (typeof completedAtIso !== 'string' || !completedAtIso.trim()) return false;
  const completed = new Date(completedAtIso.trim());
  if (!Number.isFinite(completed.getTime())) return false;
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

/** Sets `completedAt` when entering `done`, clears when leaving; preserves timestamp while staying done. */
export function mergeTaskCompletionMeta(prevTask, nextTask) {
  const prevDone = prevTask?.status === 'done';
  const nextDone = nextTask.status === 'done';
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
