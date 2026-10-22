import { PRIORITY, normalizeStatuses } from '../constants.js';
import { isPlannedSlotsArrayShape, normalizePlannedSlots } from '../plannedSlots.js';
import { isValidStatusLogEntry, normalizeStatusLog } from '../statusLog.js';
import { isDateOnlyString, isRequiredDateOnlyString, canonicalizeDateOnly } from '../todayViewHelpers.js';

/** Guards normalize* calls so a null/non-object array entry is dropped, not fatal. */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
export function isValidTask(task) {
  if (!task || typeof task !== 'object') return false;
  const { id, name, status, priority, subtasks, category, date, time, dependencyTaskIds, url, notes, ticketNumber, completedAt, plannedSlots } = task;
  if (typeof id !== 'string' || typeof name !== 'string') return false;
  if (typeof status !== 'string' || status.trim().length === 0) return false;
  if (typeof priority !== 'string' || !PRIORITY.some((p) => p.v === priority)) return false;
  if (category !== undefined && category !== null && typeof category !== 'string') return false;
  if (!isDateOnlyString(date)) return false;
  if (!isDateOnlyString(task.endDate)) return false;
  if (time !== undefined && time !== null && typeof time !== 'string') return false;
  if (url !== undefined && url !== null && typeof url !== 'string') return false;
  if (notes !== undefined && notes !== null && typeof notes !== 'string') return false;
  if (ticketNumber !== undefined && ticketNumber !== null && typeof ticketNumber !== 'string') return false;
  if (completedAt !== undefined && completedAt !== null && typeof completedAt !== 'string') return false;
  if (!Array.isArray(subtasks)) return false;
  if (dependencyTaskIds !== undefined && !Array.isArray(dependencyTaskIds)) return false;
  if (Array.isArray(dependencyTaskIds) && !dependencyTaskIds.every((id) => typeof id === 'string')) return false;
  if (!isPlannedSlotsArrayShape(plannedSlots)) return false;
  if (task.statusLog !== undefined && (
    !Array.isArray(task.statusLog) || !task.statusLog.every(isValidStatusLogEntry)
  )) return false;
  return subtasks.every(
    (st) => st && typeof st === 'object' && typeof st.id === 'string' && typeof st.text === 'string' && typeof st.done === 'boolean'
  );
}

function legacySubtaskId() {
  return `st-${crypto.randomUUID()}`;
}

function normalizeSubtask(st) {
  if (!st || typeof st !== 'object') return null;
  const text = st.text ?? st.title;
  return {
    id: String(st.id ?? legacySubtaskId()),
    text: typeof text === 'string' ? text : '',
    done: Boolean(st.done ?? st.completed ?? false),
  };
}

const LEGACY_PRIORITY_MAP = { urgent: 'critical' };

function normalizePriority(priority) {
  if (typeof priority !== 'string') return priority;
  return LEGACY_PRIORITY_MAP[priority] ?? priority;
}

function normalizeTask(task) {
  const rawDependencies = Array.isArray(task.dependencyTaskIds) ? task.dependencyTaskIds : [];
  const legacyName = typeof task.name === 'string' ? task.name : (typeof task.description === 'string' ? task.description : '');
  const normalizedStatus = task.status === 'started' ? 'in_progress' : task.status;
  const normalizedSubtasks = (Array.isArray(task.subtasks) ? task.subtasks : [])
    .map(normalizeSubtask)
    .filter(Boolean);
  return {
    ...task,
    name: legacyName,
    status: normalizedStatus,
    priority: normalizePriority(task.priority),
    subtasks: normalizedSubtasks,
    dependencyTaskIds: [...new Set(rawDependencies.filter((id) => typeof id === 'string'))],
    category: task.category || '',
    date: canonicalizeDateOnly(task.date),
    endDate: canonicalizeDateOnly(task.endDate),
    time: task.time || '',
    url: task.url || '',
    notes: task.notes || '',
    ticketNumber: task.ticketNumber || '',
    completedAt: typeof task.completedAt === 'string' ? task.completedAt : (typeof task.completed_at === 'string' ? task.completed_at : ''),
    hideInKanbanDone: Boolean(task.hideInKanbanDone),
    plannedSlots: normalizePlannedSlots(task.plannedSlots),
    statusLog: normalizeStatusLog(task.statusLog),
    createdAt: typeof task.createdAt === 'string'
      ? task.createdAt
      : (typeof task.created_at === 'string' ? task.created_at : ''),
    updatedAt: typeof task.updatedAt === 'string'
      ? task.updatedAt
      : (typeof task.updated_at === 'string' ? task.updated_at : ''),
  };
}

function normalizeEvent(event) {
  let allDay = event.allDay === false || event.allDay === 0 ? false : true;
  let startTime = typeof event.startTime === 'string' ? event.startTime : '';
  let endTime = typeof event.endTime === 'string' ? event.endTime : '';
  if (!allDay && !startTime && !endTime) allDay = true;
  const recurrenceFrequency = ['none', 'daily', 'weekly', 'monthly'].includes(event.recurrenceFrequency)
    ? event.recurrenceFrequency
    : 'none';
  const parsedInterval = Number.parseInt(String(event.recurrenceInterval ?? '1'), 10);
  const recurrenceInterval = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 1;
  const recurrenceUntil = canonicalizeDateOnly(event.recurrenceUntil);
  const parsedCount = Number.parseInt(String(event.recurrenceCount ?? ''), 10);
  const recurrenceCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : null;
  return {
    ...event,
    startDate: canonicalizeDateOnly(event.startDate),
    endDate: canonicalizeDateOnly(event.endDate) || canonicalizeDateOnly(event.startDate),
    color: event.color || '#2563eb',
    allDay,
    startTime: allDay ? '' : startTime,
    endTime: allDay ? '' : endTime,
    recurrenceFrequency,
    recurrenceInterval: recurrenceFrequency === 'none' ? 1 : recurrenceInterval,
    recurrenceUntil: recurrenceFrequency === 'none' ? '' : recurrenceUntil,
    recurrenceCount: recurrenceFrequency === 'none' ? null : recurrenceCount,
  };
}

function normalizeBoardNote(note) {
  return {
    ...note,
    noteType: note.noteType === 'extended' ? 'extended' : 'quick',
    title: note.title || '',
    text: note.text || '',
    createdAt: note.createdAt || note.created_at || new Date().toISOString(),
    x: typeof note.x === 'number' ? note.x : 20,
    y: typeof note.y === 'number' ? note.y : 20,
  };
}

export function isValidEvent(event) {
  if (!event || typeof event !== 'object') return false;
  const { id, title, startDate, endDate, color, allDay, startTime, endTime, recurrenceFrequency, recurrenceInterval, recurrenceUntil, recurrenceCount } = event;
  if (typeof id !== 'string' || typeof title !== 'string') return false;
  if (!isRequiredDateOnlyString(startDate)) return false;
  if (endDate !== undefined && endDate !== null && !isDateOnlyString(endDate)) return false;
  if (recurrenceUntil !== undefined && recurrenceUntil !== null && !isDateOnlyString(recurrenceUntil)) return false;
  if (typeof color !== 'string') return false;
  if (allDay != null && typeof allDay !== 'boolean' && typeof allDay !== 'number') return false;
  if (startTime != null && typeof startTime !== 'string') return false;
  if (endTime != null && typeof endTime !== 'string') return false;
  if (recurrenceFrequency != null && !['none', 'daily', 'weekly', 'monthly'].includes(recurrenceFrequency)) return false;
  if (recurrenceInterval != null && (!Number.isInteger(Number(recurrenceInterval)) || Number(recurrenceInterval) < 1)) return false;
  if (recurrenceUntil != null && typeof recurrenceUntil !== 'string') return false;
  if (recurrenceCount != null && (!Number.isInteger(Number(recurrenceCount)) || Number(recurrenceCount) < 1)) return false;
  return true;
}

export function isValidBoardNote(note) {
  return (
    note &&
    typeof note === 'object' &&
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.text === 'string' &&
    (note.noteType === undefined || ['quick', 'extended'].includes(note.noteType)) &&
    (typeof note.createdAt === 'string' || typeof note.created_at === 'string') &&
    (note.x === undefined || typeof note.x === 'number') &&
    (note.y === undefined || typeof note.y === 'number')
  );
}

export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.tasks) || !payload.tasks.every(isValidTask)) return false;
  if (payload.boardNotes !== undefined && (!Array.isArray(payload.boardNotes) || !payload.boardNotes.every(isValidBoardNote))) return false;
  if (payload.events !== undefined && (!Array.isArray(payload.events) || !payload.events.every(isValidEvent))) return false;
  return true;
}

export function normalizeDataPayload(parsed) {
  if (Array.isArray(parsed)) {
    const tasks = parsed.filter(isPlainObject).map(normalizeTask).filter(isValidTask);
    return { tasks, boardNotes: [], events: [] };
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
    // Per-item sanitation: drop only invalid entities instead of discarding the whole dataset.
    const tasks = parsed.tasks.filter(isPlainObject).map(normalizeTask).filter(isValidTask);
    const boardNotes = Array.isArray(parsed.boardNotes)
      ? parsed.boardNotes.filter(isPlainObject).map(normalizeBoardNote).filter(isValidBoardNote)
      : [];
    const events = Array.isArray(parsed.events)
      ? parsed.events.filter(isPlainObject).map(normalizeEvent).filter(isValidEvent)
      : [];
    const customStatuses = Array.isArray(parsed.customStatuses)
      ? normalizeStatuses(parsed.customStatuses)
      : undefined;
    return {
      tasks,
      boardNotes,
      events,
      ...(customStatuses ? { customStatuses } : {}),
    };
  }
  return { tasks: [], boardNotes: [], events: [] };
}

export function isMultiBackupPayload(parsed) {
  return Boolean(
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Array.isArray(parsed.workspaces)
  );
}

export function validateMultiBackupPayload(payload) {
  if (!isMultiBackupPayload(payload)) return false;
  return payload.workspaces.every((workspace) => (
    workspace &&
    typeof workspace === 'object' &&
    typeof workspace.name === 'string' &&
    workspace.name.trim().length > 0 &&
    validateBackupPayload(workspace)
  ));
}

export function normalizeMultiBackupPayload(parsed) {
  if (!isMultiBackupPayload(parsed)) return null;
  const workspaces = parsed.workspaces
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!name) return null;
      const normalized = normalizeDataPayload(raw);
      const sourceTaskCount = Array.isArray(raw.tasks) ? raw.tasks.length : 0;
      const sourceNoteCount = Array.isArray(raw.boardNotes) ? raw.boardNotes.length : 0;
      const sourceEventCount = Array.isArray(raw.events) ? raw.events.length : 0;
      const droppedItems =
        normalized.tasks.length !== sourceTaskCount ||
        normalized.boardNotes.length !== sourceNoteCount ||
        normalized.events.length !== sourceEventCount;
      if (droppedItems) return null;
      const customStatuses = Array.isArray(raw.customStatuses)
        ? normalizeStatuses(raw.customStatuses)
        : (Array.isArray(raw.statuses) ? normalizeStatuses(raw.statuses) : undefined);
      return {
        id: typeof raw.id === 'string' ? raw.id : null,
        name,
        ...normalized,
        ...(customStatuses ? { customStatuses } : {}),
      };
    })
    .filter(Boolean);
  if (workspaces.length === 0) return null;
  return { workspaces };
}
