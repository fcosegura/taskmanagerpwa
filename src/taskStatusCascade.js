import { PARENT_CASCADE_STATUSES, STATUS } from './constants.js';
import { mergeTaskCompletionMeta } from './kanbanDoneRange.js';

export function shouldCascadeStatusToChildren(status) {
  return PARENT_CASCADE_STATUSES.has(status);
}

export function getChildIdsForParent(parentTask) {
  return [...new Set((parentTask?.dependencyTaskIds || []).filter((id) => typeof id === 'string' && id))];
}

/**
 * When a parent moves to blocked, paused, or done, children get the same status.
 * Propagation is recursive (grandchildren included) and cycle-safe.
 */
export function applyStatusWithChildCascade(tasks, parentId, nextStatus, statuses = STATUS) {
  const parentTask = tasks.find((task) => task.id === parentId);
  if (!parentTask) return tasks;

  const affected = new Set([parentId]);

  if (shouldCascadeStatusToChildren(nextStatus)) {
    const queue = [parentId];
    while (queue.length > 0) {
      const currentId = queue.shift();
      const current = tasks.find((task) => task.id === currentId);
      if (!current) continue;
      for (const childId of getChildIdsForParent(current)) {
        if (affected.has(childId)) continue;
        affected.add(childId);
        queue.push(childId);
      }
    }
  }

  return tasks.map((task) => (
    affected.has(task.id)
      ? mergeTaskCompletionMeta(task, { ...task, status: nextStatus }, statuses)
      : task
  ));
}
