import { MONTHS, STATUS, isTerminalStatus } from './constants.js';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when the value is empty/null (optional) or a valid `YYYY-MM-DD` string. */
export function isDateOnlyString(value) {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && DATE_ONLY_RE.test(value.trim());
}

/** True only when the value is a non-empty valid `YYYY-MM-DD` string. */
export function isRequiredDateOnlyString(value) {
  return typeof value === 'string' && DATE_ONLY_RE.test(value.trim());
}

const FLEXIBLE_DATE_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/;

/**
 * Canonicaliza una fecha escrita por IA/import a `YYYY-MM-DD` (rellenando ceros).
 * Acepta `YYYY-M-D`, `YYYY/MM/DD`, `YYYY-MM-DD` e ISO datetime (`T…` o espacio).
 * Devuelve '' para valores no parseables, fuera de rango o no-string.
 */
export function canonicalizeDateOnly(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = FLEXIBLE_DATE_RE.exec(trimmed);
  if (!match) return '';
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Defensive date label: returns '' for missing/malformed dates instead of crashing. */
export function fmtDate(s) {
  if (typeof s !== 'string' || !s) return '';
  const match = DATE_ONLY_RE.exec(s.trim());
  if (!match) return '';
  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const month = MONTHS[monthIndex - 1]?.slice(0, 3) ?? '';
  if (!month || !Number.isFinite(year) || !Number.isFinite(day)) return '';
  return `${day} ${month} ${year}`;
}

export function normalizeTaskUrl(url) {
  if (!url || typeof url !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const cleaned = url.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!cleaned) return '';
  const lower = cleaned.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return '';
  }
  return cleaned.startsWith('http://') || cleaned.startsWith('https://')
    ? cleaned
    : `https://${cleaned}`;
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

export function parseLocalDateOnly(dateStr) {
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

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Returns YYYY-MM-DD strings for the next `count` business days strictly after `fromDate`. */
export function getNextBusinessDayStrings(fromDate, count) {
  const allowed = new Set();
  const cursor = new Date(fromDate);
  while (allowed.size < count) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekend(cursor)) {
      allowed.add(toDateString(cursor));
    }
  }
  return allowed;
}

export function getUpcomingTasks(tasks, todayStr, days = 5, statuses = STATUS) {
  const today = parseLocalDateOnly(todayStr);
  const safeDays = Number.isInteger(days) && days > 0 ? days : 5;
  if (!today || !Array.isArray(tasks)) return [];

  const allowedDates = getNextBusinessDayStrings(today, safeDays);

  return tasks
    .map((task, index) => ({ task, index, dateStr: typeof task?.date === 'string' ? task.date.trim() : '' }))
    .filter(({ task, dateStr }) => {
      if (!task || isTerminalStatus(task.status, statuses)) return false;
      if (!parseLocalDateOnly(dateStr)) return false;
      return allowedDates.has(dateStr);
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
