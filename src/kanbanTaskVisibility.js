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
 * Done column: show root/parent tasks when done; show a child only if its parent is not done.
 */
export function shouldShowTaskInKanbanDoneColumn(task, allTasks) {
  const parent = findParentTask(allTasks, task?.id);
  if (!parent) return true;
  return parent.status !== 'done';
}
