import { STATUS, isTerminalStatus } from './constants.js';

/**
 * Open (non-terminal) child tasks linked via dependencyTaskIds — same rule as App.del().
 */
export function countOpenChildTasks(parentTask, allTasks = [], statuses = STATUS) {
  const childIds = parentTask?.dependencyTaskIds || [];
  if (!childIds.length) return 0;
  return allTasks.filter((task) => (
    childIds.includes(task.id) && !isTerminalStatus(task.status, statuses)
  )).length;
}
