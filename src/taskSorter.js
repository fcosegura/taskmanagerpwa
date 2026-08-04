import { isJiraCategory } from './jiraTicket.js';
import { P_ORDER } from './constants.js';

function buildKindMap(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) return null;
  const map = new Map();
  for (const s of statuses) {
    if (s && typeof s.v === 'string' && typeof s.kind === 'string') {
      map.set(s.v, s.kind);
    }
  }
  return map;
}

const DEFAULT_KIND = { blocked: 'blocked', paused: 'waiting', done: 'done' };

/** Same ordering as the main Tasks list: Jira first, blocked/paused at the end, done last. */
export function compareTasksForTaskList(a, b, statuses) {
  const kindMap = Array.isArray(statuses) ? buildKindMap(statuses) : null;

  const getKind = (task) => {
    if (kindMap?.has(task.status)) return kindMap.get(task.status);
    return DEFAULT_KIND[task.status] || 'active';
  };

  const getTaskRank = (task) => {
    const kind = getKind(task);
    const isDone = kind === 'done';
    const isBlockedOrPaused = kind === 'blocked' || kind === 'waiting';
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
