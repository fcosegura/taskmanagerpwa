import {
  inheritTicketFromParentTask,
  isJiraCategory,
  normalizeTicketNumber,
  applyTicketNumberToTaskName,
} from './jiraTicket.js';

/** Normaliza categoría/ticket/nombre de una tarea (equivalente al helper previo de App). */
export function normalizeTaskTicketFields(taskInput) {
  const category = typeof taskInput?.category === 'string' ? taskInput.category : '';
  const ticketNumber = normalizeTicketNumber(taskInput?.ticketNumber || '');
  const normalizedName = isJiraCategory(category) && ticketNumber
    ? applyTicketNumberToTaskName(taskInput?.name || '', ticketNumber)
    : (typeof taskInput?.name === 'string' ? taskInput.name.trim() : '');
  return {
    ...taskInput,
    category,
    ticketNumber,
    name: normalizedName,
  };
}

/**
 * Aplica de forma pura e IDEMPOTENTE el link "tarea arrastrada = hija de destino".
 * No añade el hijo si ya está presente y deduplica `dependencyTaskIds`, de modo que
 * dos drops del mismo par sobre un snapshot obsoleto no duplican la dependencia.
 */
export function applyStandaloneChildLink(previousTasks, { sourceTaskId, targetTaskId, targetTask } = {}) {
  if (!Array.isArray(previousTasks) || !sourceTaskId || !targetTaskId) return previousTasks;
  return previousTasks.map((task) => {
    if (!task || typeof task !== 'object') return task;
    if (task.id === targetTaskId) {
      const deps = Array.isArray(task.dependencyTaskIds) ? task.dependencyTaskIds : [];
      if (deps.includes(sourceTaskId)) return task;
      return { ...task, dependencyTaskIds: [...new Set([...deps, sourceTaskId])] };
    }
    if (task.id === sourceTaskId) {
      return normalizeTaskTicketFields(inheritTicketFromParentTask(targetTask, task));
    }
    return task;
  });
}
