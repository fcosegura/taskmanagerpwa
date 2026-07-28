import { findParentTask } from './kanbanTaskVisibility.js';

function normalizeStatus(status) {
  return status || 'not_done';
}

/**
 * Count tasks that match `matches`, collapsing parent/child pairs (or groups)
 * that share the same status into a single count.
 */
export function countTasksWithParentStatusDedup(allTasks, matches) {
  if (!Array.isArray(allTasks) || allTasks.length === 0) return 0;

  let count = 0;
  for (const task of allTasks) {
    if (!matches(task)) continue;

    const parent = findParentTask(allTasks, task.id);
    if (parent && matches(parent) && normalizeStatus(task.status) === normalizeStatus(parent.status)) {
      continue;
    }
    count += 1;
  }
  return count;
}

/** Per-status counts with parent/child deduplication when statuses match. */
export function countTasksByStatus(allTasks, statusKey) {
  return countTasksWithParentStatusDedup(
    allTasks,
    (task) => normalizeStatus(task.status) === statusKey,
  );
}
