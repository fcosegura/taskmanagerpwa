import { normalizeStatusLog } from './statusLog.js';

export const KANBAN_COLLAPSED_TASK_LIMIT = 5;

function parseIsoMs(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function getTaskStatusArrivalMs(task, status) {
  if (status === 'done') {
    return parseIsoMs(task?.completedAt ?? task?.completed_at);
  }

  return normalizeStatusLog(task?.statusLog)
    .filter((entry) => entry.toStatus === status)
    .reduce((latest, entry) => Math.max(latest, parseIsoMs(entry.at) ?? 0), 0) || null;
}

export function sortKanbanTasksByRecency(tasks, status) {
  return (Array.isArray(tasks) ? tasks : [])
    .map((task, originalIndex) => ({ task, originalIndex, arrivalMs: getTaskStatusArrivalMs(task, status) }))
    .sort((a, b) => {
      const timestampDifference = (b.arrivalMs ?? -1) - (a.arrivalMs ?? -1);
      return timestampDifference || b.originalIndex - a.originalIndex;
    })
    .map(({ task }) => task);
}

export function getVisibleKanbanTasks(tasks, isExpanded) {
  if (!Array.isArray(tasks) || tasks.length <= KANBAN_COLLAPSED_TASK_LIMIT || isExpanded) {
    return Array.isArray(tasks) ? tasks : [];
  }
  return tasks.slice(0, KANBAN_COLLAPSED_TASK_LIMIT);
}

export function getHiddenKanbanTaskCount(tasks, isExpanded) {
  if (!Array.isArray(tasks) || isExpanded) return 0;
  return Math.max(0, tasks.length - KANBAN_COLLAPSED_TASK_LIMIT);
}
