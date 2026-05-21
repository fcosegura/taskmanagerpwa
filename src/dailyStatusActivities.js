import { normalizeStatusLog } from './statusLog.js';

function startOfLocalDayMs(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseIsoMs(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Inclusive window: from start of (today - (days-1)) through end of today (local). */
export function dailyStatusWindowMs(days, now = new Date()) {
  const safeDays = Math.min(7, Math.max(1, Number.parseInt(String(days), 10) || 2));
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(startOfLocalDayMs(now));
  start.setDate(start.getDate() - (safeDays - 1));
  return { startMs: start.getTime(), endMs: end.getTime(), days: safeDays };
}

function isWithinWindow(isoValue, startMs, endMs) {
  const ms = parseIsoMs(isoValue);
  if (ms == null) return false;
  return ms >= startMs && ms <= endMs;
}

export function collectDailyStatusActivities(tasks, days, now = new Date()) {
  const { startMs, endMs, days: safeDays } = dailyStatusWindowMs(days, now);
  const list = Array.isArray(tasks) ? tasks : [];
  const activities = [];

  for (const task of list) {
    if (!task || typeof task.id !== 'string') continue;
    const createdAt = typeof task.createdAt === 'string'
      ? task.createdAt
      : (typeof task.created_at === 'string' ? task.created_at : '');
    const completedAt = typeof task.completedAt === 'string' ? task.completedAt : '';
    const statusLog = normalizeStatusLog(task.statusLog);
    const statusChanges = statusLog.filter((entry) => isWithinWindow(entry.at, startMs, endMs));

    const createdInWindow = isWithinWindow(createdAt, startMs, endMs);
    const completedInWindow = isWithinWindow(completedAt, startMs, endMs);

    if (!createdInWindow && statusChanges.length === 0 && !completedInWindow) continue;

    const lastActivityMs = Math.max(
      createdInWindow ? parseIsoMs(createdAt) : 0,
      completedInWindow ? parseIsoMs(completedAt) : 0,
      ...statusChanges.map((e) => parseIsoMs(e.at) || 0),
    );

    activities.push({
      taskId: task.id,
      name: typeof task.name === 'string' ? task.name : '',
      ticketNumber: typeof task.ticketNumber === 'string' ? task.ticketNumber : '',
      category: typeof task.category === 'string' ? task.category : '',
      priority: typeof task.priority === 'string' ? task.priority : 'medium',
      currentStatus: typeof task.status === 'string' ? task.status : 'not_done',
      createdAt: createdAt || null,
      createdInWindow,
      completedAt: completedAt || null,
      completedInWindow,
      statusChanges,
      notes: typeof task.notes === 'string' ? task.notes.trim() : '',
      lastActivityMs,
    });
  }

  activities.sort((a, b) => (b.lastActivityMs || 0) - (a.lastActivityMs || 0));
  return { activities, days: safeDays, startMs, endMs };
}

export function clampDailyStatusDays(days) {
  const parsed = Number.parseInt(String(days), 10);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(7, Math.max(1, parsed));
}
