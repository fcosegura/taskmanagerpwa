import { isJiraCategory } from './jiraTicket.js';
import { P_ORDER } from './constants.js';

/** Same ordering as the main Tasks list: Jira first, blocked/paused at the end, done last. */
export function compareTasksForTaskList(a, b) {
  const getTaskRank = (task) => {
    const isDone = task.status === 'done';
    const isBlockedOrPaused = task.status === 'blocked' || task.status === 'paused';
    const isJira = isJiraCategory(task.category);

    if (isDone) {
      return isJira ? 4 : 5;
    }
    if (isBlockedOrPaused) {
      return isJira ? 2 : 3;
    }
    return isJira ? 0 : 1;
  };

  const rankA = getTaskRank(a);
  const rankB = getTaskRank(b);
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return (P_ORDER[a.priority] ?? 3) - (P_ORDER[b.priority] ?? 3);
}
