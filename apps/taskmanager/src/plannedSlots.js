/** Agenda planning blocks on a task (independent from due date `date` / `time`). */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @param {unknown} t */
export function padHm(t) {
  if (typeof t !== 'string') return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return '';
  let h = Number.parseInt(m[1], 10);
  let min = Number.parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return '';
  h = Math.max(0, Math.min(23, h));
  min = Math.max(0, Math.min(59, min));
  return `${pad2(h)}:${pad2(min)}`;
}

/** @param {unknown} slot */
export function isValidPlannedSlot(slot) {
  if (!slot || typeof slot !== 'object') return false;
  const id = typeof slot.id === 'string' ? slot.id.trim() : '';
  const date = typeof slot.date === 'string' ? slot.date.trim() : '';
  const startTime = padHm(slot.startTime);
  const endTime = padHm(slot.endTime);
  if (!id || !YMD_RE.test(date) || !startTime || !endTime) return false;
  if (endTime <= startTime) return false;
  return true;
}

/** @param {unknown} raw */
export function normalizePlannedSlots(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const id = typeof s.id === 'string' ? s.id.trim() : '';
    const date = typeof s.date === 'string' ? s.date.trim() : '';
    const startTime = padHm(s.startTime);
    const endTime = padHm(s.endTime);
    if (!id || !YMD_RE.test(date) || !startTime || !endTime || endTime <= startTime) continue;
    const key = `${id}|${date}|${startTime}|${endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, date, startTime, endTime });
  }
  out.sort((a, b) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)
  );
  return out;
}

/** Stable JSON for hashing / D1. */
export function plannedSlotsStableJson(plannedSlots) {
  return JSON.stringify(normalizePlannedSlots(plannedSlots));
}

/** For validators: optional array; each item must already be a valid slot. */
export function isPlannedSlotsArrayShape(arr) {
  if (arr === undefined || arr === null) return true;
  if (!Array.isArray(arr)) return false;
  return arr.every(isValidPlannedSlot);
}
