export function clonePayload(payload) {
  try {
    return JSON.parse(JSON.stringify({
      tasks: Array.isArray(payload?.tasks) ? payload.tasks : [],
      boardNotes: Array.isArray(payload?.boardNotes) ? payload.boardNotes : [],
      events: Array.isArray(payload?.events) ? payload.events : [],
    }));
  } catch {
    return { tasks: [], boardNotes: [], events: [] };
  }
}

function stableSerialize(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
}

function indexById(list = []) {
  const index = new Map();
  for (const item of list) {
    if (item && typeof item.id === 'string') {
      index.set(item.id, item);
    }
  }
  return index;
}

function diffEntityOps(previousList = [], nextList = []) {
  const previous = indexById(previousList);
  const next = indexById(nextList);
  const deletes = [];
  const upserts = [];

  for (const [id, prevItem] of previous.entries()) {
    if (!next.has(id)) deletes.push(id);
    else if (stableSerialize(prevItem) !== stableSerialize(next.get(id))) upserts.push(next.get(id));
  }
  for (const [id, nextItem] of next.entries()) {
    if (!previous.has(id)) upserts.push(nextItem);
  }
  return { upserts, deletes };
}

export function buildIncrementalOps(previousPayload, nextPayload) {
  return {
    tasks: diffEntityOps(previousPayload?.tasks || [], nextPayload?.tasks || []),
    notes: diffEntityOps(previousPayload?.boardNotes || [], nextPayload?.boardNotes || []),
    events: diffEntityOps(previousPayload?.events || [], nextPayload?.events || []),
  };
}

export function hasAnyOps(ops) {
  return (
    (ops.tasks.upserts.length + ops.tasks.deletes.length) > 0 ||
    (ops.notes.upserts.length + ops.notes.deletes.length) > 0 ||
    (ops.events.upserts.length + ops.events.deletes.length) > 0
  );
}
