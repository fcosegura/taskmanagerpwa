/** Standard Kanban status ids (same set as DEFAULT_KEYS in constants.js). */
export const STANDARD_KANBAN_STATUS_IDS = new Set([
  'not_done',
  'in_progress',
  'paused',
  'blocked',
  'done',
]);

const ANCHOR_OR_LOW_PRIORITY = new Set([
  'not_done',
  'in_progress',
  'paused',
  'blocked',
  'done',
]);

export function kanbanColumnOrderStorageKey(columnsStorageKey) {
  if (!columnsStorageKey || typeof columnsStorageKey !== 'string') {
    return 'taskmanager_kanban_visible_columns_default_order';
  }
  return `${columnsStorageKey}_order`;
}

function readCount(countByStatus, statusV) {
  if (!countByStatus || typeof countByStatus !== 'object') return 0;
  const raw = countByStatus[statusV];
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/**
 * Organize Kanban column order by product rules.
 * @param {Array<{ v: string, kind?: string, label?: string }>} statuses
 * @param {Record<string, number>} countByStatus
 * @returns {string[]}
 */
export function organizeKanbanColumnOrder(statuses, countByStatus = {}) {
  const list = Array.isArray(statuses)
    ? statuses.filter((status) => status && typeof status.v === 'string' && status.v)
    : [];
  if (list.length === 0) return [];

  const indexByV = new Map(list.map((status, index) => [status.v, index]));
  const countOf = (statusV) => readCount(countByStatus, statusV);
  const hasItems = (statusV) => countOf(statusV) > 0;
  const isStandard = (statusV) => STANDARD_KANBAN_STATUS_IDS.has(statusV);

  const anyCustomWithItems = list.some((status) => !isStandard(status.v) && hasItems(status.v));

  const byCountDescThenIndex = (a, b) => {
    const diff = countOf(b.v) - countOf(a.v);
    if (diff !== 0) return diff;
    return (indexByV.get(a.v) ?? 0) - (indexByV.get(b.v) ?? 0);
  };

  const byOriginalIndex = (a, b) => (indexByV.get(a.v) ?? 0) - (indexByV.get(b.v) ?? 0);

  const result = [];
  const used = new Set();

  const take = (status) => {
    if (!status || used.has(status.v)) return;
    used.add(status.v);
    result.push(status.v);
  };

  const find = (statusV) => list.find((status) => status.v === statusV);

  // 1–2. Anchors
  take(find('not_done'));
  take(find('in_progress'));

  // 3. Other standard with items (excluding anchors / pause / blocked / done)
  list
    .filter((status) => (
      isStandard(status.v)
      && hasItems(status.v)
      && !ANCHOR_OR_LOW_PRIORITY.has(status.v)
    ))
    .sort(byCountDescThenIndex)
    .forEach(take);

  // 4. Custom active with items
  list
    .filter((status) => !isStandard(status.v) && hasItems(status.v) && status.kind === 'active')
    .sort(byCountDescThenIndex)
    .forEach(take);

  // 5. Other custom with items
  list
    .filter((status) => !isStandard(status.v) && hasItems(status.v) && status.kind !== 'active')
    .sort(byCountDescThenIndex)
    .forEach(take);

  // 6. Empty standard (non-anchor) only when no custom has items
  if (!anyCustomWithItems) {
    list
      .filter((status) => (
        isStandard(status.v)
        && !hasItems(status.v)
        && !ANCHOR_OR_LOW_PRIORITY.has(status.v)
      ))
      .sort(byOriginalIndex)
      .forEach(take);
  }

  // 7. Remaining empties (empty custom; empty non-anchor standard when customs have items)
  list
    .filter((status) => {
      if (used.has(status.v)) return false;
      if (status.v === 'paused' || status.v === 'blocked' || status.v === 'done') return false;
      if (hasItems(status.v)) return false;
      if (!isStandard(status.v)) return true;
      return anyCustomWithItems && !ANCHOR_OR_LOW_PRIORITY.has(status.v);
    })
    .sort(byOriginalIndex)
    .forEach(take);

  // 8–10. Blocked, paused, done (even with items)
  take(find('blocked'));
  take(find('paused'));
  take(find('done'));

  // Leftovers (should be rare)
  list.forEach(take);

  return result;
}

/**
 * Reorder a visible subset according to a saved full column order.
 * Unknown statuses append at the end (stable among themselves).
 */
export function orderVisibleColumnsByFullOrder(visibleStatuses, fullOrder) {
  const visible = Array.isArray(visibleStatuses)
    ? visibleStatuses.filter((v) => typeof v === 'string' && v)
    : [];
  if (visible.length === 0) return [];

  const order = Array.isArray(fullOrder)
    ? fullOrder.filter((v) => typeof v === 'string' && v)
    : [];
  if (order.length === 0) return [...visible];

  const rank = new Map(order.map((v, index) => [v, index]));
  return [...visible].sort((a, b) => {
    const ra = rank.has(a) ? rank.get(a) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b) ? rank.get(b) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return visible.indexOf(a) - visible.indexOf(b);
  });
}

/**
 * Insert a newly enabled status into the visible list using the saved full order.
 */
export function insertStatusUsingFullOrder(visibleStatuses, statusV, fullOrder) {
  if (typeof statusV !== 'string' || !statusV) {
    return Array.isArray(visibleStatuses) ? [...visibleStatuses] : [];
  }
  const visible = Array.isArray(visibleStatuses)
    ? visibleStatuses.filter((v) => typeof v === 'string' && v)
    : [];
  if (visible.includes(statusV)) return [...visible];
  return orderVisibleColumnsByFullOrder([...visible, statusV], fullOrder);
}

/**
 * After a manual drag of visible columns, update the full order so visible
 * relative order matches while hidden columns keep their slots.
 */
export function applyVisibleOrderToFullOrder(fullOrder, visibleOrder) {
  const full = Array.isArray(fullOrder)
    ? fullOrder.filter((v) => typeof v === 'string' && v)
    : [];
  const visible = Array.isArray(visibleOrder)
    ? visibleOrder.filter((v) => typeof v === 'string' && v)
    : [];
  if (full.length === 0) return [...visible];
  if (visible.length === 0) return [...full];

  const visibleSet = new Set(visible);
  let index = 0;
  const next = full.map((statusV) => {
    if (!visibleSet.has(statusV)) return statusV;
    const replacement = visible[index];
    index += 1;
    return replacement ?? statusV;
  });

  // Append any visible ids missing from full order
  for (const statusV of visible) {
    if (!next.includes(statusV)) next.push(statusV);
  }
  return next;
}

export function parseStoredColumnOrder(raw, allowedValues) {
  const allowed = new Set(allowedValues);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const filtered = parsed.filter((v) => typeof v === 'string' && allowed.has(v));
    if (filtered.length === 0) return null;
    // Append any allowed values missing from storage (new custom statuses)
    for (const value of allowedValues) {
      if (!filtered.includes(value)) filtered.push(value);
    }
    return filtered;
  } catch {
    return null;
  }
}

export function readColumnOrderFromStorage(storageKey, allowedValues) {
  if (!storageKey) return [...allowedValues];
  try {
    const parsed = parseStoredColumnOrder(localStorage.getItem(storageKey), allowedValues);
    if (parsed) return parsed;
  } catch {
    // ignore
  }
  return [...allowedValues];
}

export function writeJsonToStorage(storageKey, value) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}
