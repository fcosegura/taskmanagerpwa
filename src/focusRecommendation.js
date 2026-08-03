import { STATUS, normalizeStatuses } from './constants.js';

/**
 * Returns the recommended focus task using deterministic, explainable scoring rules.
 * Does NOT mutate tasks or input arrays.
 *
 * @param {Object} params
 * @param {Array} params.tasks - List of tasks
 * @param {string} [params.today] - YYYY-MM-DD date string
 * @param {Date|string|number} [params.now] - Current date/time reference
 * @param {Array} [params.statuses] - Custom or standard statuses list
 * @returns {{ task: Object|null, reason: string, reasonCode: string }}
 */
export function recommendNextFocusTask({
  tasks = [],
  today,
  now,
  statuses = STATUS,
} = {}) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { task: null, reason: '', reasonCode: 'none' };
  }

  const normalizedStatuses = normalizeStatuses(statuses);
  const statusMap = new Map(normalizedStatuses.map((s) => [s.v, s]));

  const nowDate = now instanceof Date ? now : (now ? new Date(now) : new Date());

  let todayStr = today;
  if (!todayStr || typeof todayStr !== 'string') {
    const yyyy = nowDate.getFullYear();
    const mm = String(nowDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nowDate.getDate()).padStart(2, '0');
    todayStr = `${yyyy}-${mm}-${dd}`;
  }

  const priorityWeightMap = {
    critical: 30,
    urgent: 30,
    high: 20,
    medium: 10,
    low: 5,
  };

  const priorityRankMap = {
    critical: 4,
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Helper to evaluate a task
  const evaluateTask = (task) => {
    if (!task) return null;

    const sDef = statusMap.get(task.status) || {
      v: task.status,
      kind: 'backlog',
      isTerminal: task.status === 'done',
      canBeFocused: true,
      sortWeight: 50,
    };

    // Terminal / done tasks are strictly excluded
    if (sDef.isTerminal || task.status === 'done') {
      return null;
    }

    let isOverdue = false;
    let isToday = false;
    let isPastTimeToday = false;
    let isUpcomingTime = false;

    if (task.date) {
      if (task.date < todayStr) {
        isOverdue = true;
      } else if (task.date === todayStr) {
        isToday = true;
        if (task.time) {
          const [h, m] = task.time.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            const taskTimeDate = new Date(nowDate);
            taskTimeDate.setHours(h, m, 0, 0);
            if (nowDate.getTime() > taskTimeDate.getTime()) {
              isPastTimeToday = true;
              isOverdue = true;
            } else {
              isUpcomingTime = true;
            }
          }
        }
      }
    }

    let score = 0;

    // Date / Time scores
    if (isOverdue) {
      score += 100;
    } else if (isToday) {
      score += 80;
    }

    // Status kind scores
    if (sDef.kind === 'active') {
      score += 40;
    } else if (sDef.kind === 'waiting') {
      score -= 60;
    } else if (sDef.kind === 'blocked') {
      score -= 80;
    }

    // Priority scores
    const pWeight = priorityWeightMap[task.priority] ?? 0;
    score += pWeight;

    // Upcoming time score
    if (isUpcomingTime || task.time) {
      score += 5;
    }

    // Normalized sort weight
    score += typeof sDef.sortWeight === 'number' ? sDef.sortWeight : 0;

    return {
      task,
      sDef,
      score,
      isOverdue,
      isToday,
      isPastTimeToday,
      isUpcomingTime,
      priorityRank: priorityRankMap[task.priority] ?? 0,
    };
  };

  const evaluatedCandidates = tasks
    .map(evaluateTask)
    .filter(Boolean);

  if (evaluatedCandidates.length === 0) {
    return { task: null, reason: '', reasonCode: 'none' };
  }

  // Deterministic sorter
  const sortCandidates = (list) => {
    return [...list].sort((a, b) => {
      // 1. Higher score first
      if (b.score !== a.score) return b.score - a.score;
      // 2. Higher priority rank first
      if (b.priorityRank !== a.priorityRank) return b.priorityRank - a.priorityRank;
      // 3. Earliest date first (e.g. '2026-07-30' before '2026-07-31')
      const dateA = a.task.date || '9999-99-99';
      const dateB = b.task.date || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      // 4. Earliest time first
      const timeA = a.task.time || '99:99';
      const timeB = b.task.time || '99:99';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      // 5. Deterministic tie break by task ID or name
      const idA = String(a.task.id || a.task.name || '');
      const idB = String(b.task.id || b.task.name || '');
      return idA.localeCompare(idB);
    });
  };

  // Filter 1: Actionable candidates (canBeFocused: true AND kind NOT blocked/waiting)
  const actionableCandidates = evaluatedCandidates.filter(
    (c) => c.sDef.canBeFocused && c.sDef.kind !== 'blocked' && c.sDef.kind !== 'waiting'
  );

  let selected = null;

  if (actionableCandidates.length > 0) {
    selected = sortCandidates(actionableCandidates)[0];
  } else {
    // Filter 2: canBeFocused: true (if any custom state has canBeFocused true but waiting/blocked)
    const focusableCandidates = evaluatedCandidates.filter((c) => c.sDef.canBeFocused);
    if (focusableCandidates.length > 0) {
      selected = sortCandidates(focusableCandidates)[0];
    } else {
      // Filter 3: Fallback candidates (blocked or waiting)
      const sortedAll = sortCandidates(evaluatedCandidates);
      selected = sortedAll[0];
    }
  }

  if (!selected) {
    return { task: null, reason: '', reasonCode: 'none' };
  }

  const { task, sDef, isOverdue, isToday } = selected;

  // Reason & ReasonCode calculation
  let reasonCode = 'none';
  let reason = '';

  if (sDef.kind === 'blocked') {
    reasonCode = 'blocked';
    reason = 'Bloqueo pendiente';
  } else if (sDef.kind === 'waiting') {
    reasonCode = 'waiting';
    reason = 'Esperando respuesta';
  } else if (isOverdue) {
    reasonCode = 'overdue';
    reason = 'Vencida';
  } else if (sDef.kind === 'active') {
    reasonCode = 'active';
    reason = 'En progreso';
  } else if (task.priority === 'critical' || task.priority === 'urgent' || task.priority === 'high') {
    reasonCode = 'priority';
    reason = isToday ? 'Alta prioridad para hoy' : 'Alta prioridad';
  } else if (isToday) {
    reasonCode = 'due_today';
    reason = 'Programada para hoy';
  } else if (task.date || task.time) {
    reasonCode = 'upcoming';
    reason = task.time ? 'Próxima tarea programada' : 'Próxima tarea';
  } else {
    reasonCode = 'upcoming';
    reason = 'Próxima tarea';
  }

  return {
    task,
    reason,
    reasonCode,
  };
}
