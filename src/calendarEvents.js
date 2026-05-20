import { toDateStr } from './utils.jsx';

export function parseDateAtNoon(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr) return null;
  const date = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateOnlyStr(date) {
  return toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

export function addMonths(baseDate, months) {
  const date = new Date(baseDate);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const day = Math.min(baseDate.getDate(), new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
  date.setDate(day);
  return date;
}

export function buildEventOccurrences(event, windowStart, windowEnd) {
  const startBase = parseDateAtNoon(event.startDate);
  if (!startBase) return [];
  const baseEndDate = parseDateAtNoon(event.endDate || event.startDate) || startBase;
  const durationDays = Math.max(0, Math.floor((baseEndDate.getTime() - startBase.getTime()) / (24 * 60 * 60 * 1000)));
  const recurrenceFrequency = ['daily', 'weekly', 'monthly'].includes(event.recurrenceFrequency)
    ? event.recurrenceFrequency
    : 'none';
  const recurrenceInterval = Math.max(1, Number.parseInt(String(event.recurrenceInterval ?? '1'), 10) || 1);
  const recurrenceUntil = parseDateAtNoon(event.recurrenceUntil || '');
  const recurrenceCount = Math.max(0, Number.parseInt(String(event.recurrenceCount ?? ''), 10) || 0);
  const maxOccurrences = recurrenceCount > 0 ? recurrenceCount : 250;
  const occurrences = [];

  if (recurrenceFrequency === 'none') {
    const occurrenceEnd = addDays(startBase, durationDays);
    if (occurrenceEnd >= windowStart && startBase <= windowEnd) {
      occurrences.push({ start: startBase, end: occurrenceEnd, occurrenceIndex: 0 });
    }
    return occurrences;
  }

  let index = 0;
  let produced = 0;
  while (produced < maxOccurrences && index < 500) {
    let occurrenceStart;
    if (recurrenceFrequency === 'daily') {
      occurrenceStart = addDays(startBase, index * recurrenceInterval);
    } else if (recurrenceFrequency === 'weekly') {
      occurrenceStart = addDays(startBase, index * recurrenceInterval * 7);
    } else {
      occurrenceStart = addMonths(startBase, index * recurrenceInterval);
    }
    if (!occurrenceStart || Number.isNaN(occurrenceStart.getTime())) break;
    if (recurrenceUntil && occurrenceStart > recurrenceUntil) break;
    if (occurrenceStart > windowEnd && !recurrenceCount) break;
    const occurrenceEnd = addDays(occurrenceStart, durationDays);
    if (occurrenceEnd >= windowStart && occurrenceStart <= windowEnd) {
      occurrences.push({ start: occurrenceStart, end: occurrenceEnd, occurrenceIndex: index });
    }
    produced += 1;
    index += 1;
  }
  return occurrences;
}

export function indexEventsByDate(events, windowStart, windowEnd) {
  const eByDate = {};
  events.forEach((e) => {
    if (!e.startDate) return;
    const timed = e.allDay === false || e.allDay === 0;
    const occurrences = buildEventOccurrences(e, windowStart, windowEnd);
    occurrences.forEach((occurrence) => {
      if (timed) {
        const dStr = toDateOnlyStr(occurrence.start);
        (eByDate[dStr] = eByDate[dStr] || []).push({
          ...e,
          occurrenceDate: dStr,
          occurrenceIndex: occurrence.occurrenceIndex,
        });
        return;
      }
      let current = new Date(occurrence.start);
      while (current <= occurrence.end) {
        const dStr = toDateOnlyStr(current);
        (eByDate[dStr] = eByDate[dStr] || []).push({
          ...e,
          occurrenceDate: toDateOnlyStr(occurrence.start),
          occurrenceIndex: occurrence.occurrenceIndex,
        });
        current = addDays(current, 1);
      }
    });
  });
  return eByDate;
}
