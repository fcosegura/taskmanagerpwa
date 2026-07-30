export const KANBAN_COLLAPSED_TASK_LIMIT = 5;

export function getVisibleKanbanTasks(tasks, isExpanded) {
  if (!Array.isArray(tasks) || tasks.length <= KANBAN_COLLAPSED_TASK_LIMIT || isExpanded) {
    return Array.isArray(tasks) ? tasks : [];
  }
  return tasks.slice(-KANBAN_COLLAPSED_TASK_LIMIT);
}

export function getHiddenKanbanTaskCount(tasks, isExpanded) {
  if (!Array.isArray(tasks) || isExpanded) return 0;
  return Math.max(0, tasks.length - KANBAN_COLLAPSED_TASK_LIMIT);
}
