/**
 * Open (non-done) child tasks linked via dependencyTaskIds — same rule as App.del().
 */
export function countOpenChildTasks(parentTask, allTasks = []) {
  const childIds = parentTask?.dependencyTaskIds || [];
  if (!childIds.length) return 0;
  return allTasks.filter((task) => (
    childIds.includes(task.id) && task.status !== 'done'
  )).length;
}
