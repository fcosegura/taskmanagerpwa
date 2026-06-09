import { PARENT_CASCADE_STATUSES } from './constants.js';
import { mergeTaskCompletionMeta } from './kanbanDoneRange.js';

export function shouldCascadeStatusToChildren(status) {
  return PARENT_CASCADE_STATUSES.has(status);
}

export function getChildIdsForParent(parentTask) {
  return [...new Set((parentTask?.dependencyTaskIds || []).filter((id) => typeof id === 'string' && id))];
}

/** When parent moves to blocked, paused, or done, children get the same status. */
export function applyStatusWithChildCascade(tasks, parentId, nextStatus) {
  const parentTask = tasks.find((task) => task.id === parentId);
  if (!parentTask) return tasks;

  const childIds = shouldCascadeStatusToChildren(nextStatus)
    ? new Set(getChildIdsForParent(parentTask))
    : new Set();

  return tasks.map((task) => {
    if (task.id !== parentId && !childIds.has(task.id)) return task;
    return mergeTaskCompletionMeta(task, { ...task, status: nextStatus });
  });
}
