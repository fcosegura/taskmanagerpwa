import { STATUS, isTerminalStatus } from './constants.js';

/** Task whose id appears in another task's dependencyTaskIds. */
export function findParentTask(allTasks, taskId) {
  if (!taskId || !Array.isArray(allTasks)) return null;
  return allTasks.find((candidate) => (
    Array.isArray(candidate.dependencyTaskIds) &&
    candidate.dependencyTaskIds.includes(taskId)
  )) || null;
}

export function isChildTask(allTasks, taskId) {
  return Boolean(findParentTask(allTasks, taskId));
}

/**
 * Done column: show root/parent tasks when done; show a child only if its parent is not terminal.
 */
export function shouldShowTaskInKanbanDoneColumn(task, allTasks, statuses = STATUS) {
  const parent = findParentTask(allTasks, task?.id);
  if (!parent) return true;
  return !isTerminalStatus(parent.status, statuses);
}

/**
 * Whether a task is hidden because one of its ancestors is collapsed.
 * Cycle-safe: a repeated node in the ancestry stops the walk and keeps the task visible.
 */
export function isTaskHiddenByCollapse(taskId, parentByChild, expandedParentIds) {
  if (!parentByChild || typeof parentByChild.get !== 'function') return false;
  let cur = taskId;
  const visited = new Set();
  while (parentByChild.has(cur)) {
    if (visited.has(cur)) return false;
    visited.add(cur);
    const parentId = parentByChild.get(cur);
    if (!expandedParentIds || !expandedParentIds.has(parentId)) return true;
    cur = parentId;
  }
  return false;
}
