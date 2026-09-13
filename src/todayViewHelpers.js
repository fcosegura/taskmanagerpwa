export function normalizeTaskUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export function formatTaskUrlLabel(url) {
  const href = normalizeTaskUrl(url);
  if (!href) return '';
  try {
    const parsed = new URL(href);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return href.length > 36 ? `${href.slice(0, 36)}…` : href;
  }
}

export function getDisplayDescription(task) {
  if (!task) return '';
  const rawDesc = task.notes || task.description;
  if (!rawDesc || typeof rawDesc !== 'string') return '';
  const trimmed = rawDesc.trim();
  if (!trimmed) return '';

  const isTechnicalToken =
    trimmed.startsWith('v1.') ||
    trimmed.startsWith('eyJ') ||
    (trimmed.length > 30 && !trimmed.includes(' '));

  if (isTechnicalToken) return '';
  return trimmed;
}

function parseLocalDateOnly(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) return null;
  return date;
}

function priorityWeight(priority) {
  return { critical: 4, urgent: 4, high: 3, medium: 2, low: 1 }[priority] || 0;
}

export function getUpcomingTasks(tasks, todayStr, days = 5) {
  const today = parseLocalDateOnly(todayStr);
  const safeDays = Number.isInteger(days) && days > 0 ? days : 5;
  if (!today || !Array.isArray(tasks)) return [];

  const lastDate = new Date(today);
  lastDate.setDate(lastDate.getDate() + safeDays);
  const firstDateStr = toDateString(today);
  const lastDateStr = toDateString(lastDate);

  return tasks
    .map((task, index) => ({ task, index, dateStr: typeof task?.date === 'string' ? task.date.trim() : '' }))
    .filter(({ task, dateStr }) => {
      if (!task || task.status === 'done') return false;
      const date = parseLocalDateOnly(dateStr);
      return Boolean(date && dateStr > firstDateStr && dateStr <= lastDateStr);
    })
    .sort((a, b) => {
      if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
      const priorityDiff = priorityWeight(b.task.priority) - priorityWeight(a.task.priority);
      if (priorityDiff !== 0) return priorityDiff;
      const timeDiff = (a.task.time || '23:59').localeCompare(b.task.time || '23:59');
      return timeDiff !== 0 ? timeDiff : a.index - b.index;
    })
    .map(({ task, dateStr }) => ({ ...task, date: dateStr }));
}

function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
