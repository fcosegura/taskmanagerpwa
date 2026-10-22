import { isPlannedSlotsArrayShape } from '../plannedSlots.js';
import { isValidNoteKind } from '../extendedNotes.js';

const VALID_PRIORITY = new Set(['low', 'medium', 'high', 'critical']);
const MAX_SYNC_TASKS = 8000;
const MAX_SYNC_NOTES = 2000;
const MAX_SYNC_EVENTS = 4000;

function countSyncEntities(normalizedBody) {
  if (normalizedBody.mode === 'payload') {
    const p = normalizedBody.payload;
    return {
      tasks: p.tasks.length,
      notes: p.boardNotes.length,
      events: p.events.length
    };
  }
  const { tasks, notes, events } = normalizedBody.ops;
  return {
    tasks: tasks.upserts.length + tasks.deletes.length,
    notes: notes.upserts.length + notes.deletes.length,
    events: events.upserts.length + events.deletes.length
  };
}

export function checkSyncLimits(normalizedBody) {
  const c = countSyncEntities(normalizedBody);
  if (c.tasks > MAX_SYNC_TASKS || c.notes > MAX_SYNC_NOTES || c.events > MAX_SYNC_EVENTS) {
    return {
      ok: false,
      error: `Límite de sincronización excedido (máx. ${MAX_SYNC_TASKS} tareas, ${MAX_SYNC_NOTES} notas, ${MAX_SYNC_EVENTS} eventos por solicitud).`
    };
  }
  return { ok: true };
}

function isValidTask(task) {
  const taskName = typeof task?.name === 'string'
    ? task.name
    : (typeof task?.description === 'string' ? task.description : null);
  return (
    task &&
    typeof task === 'object' &&
    typeof task.id === 'string' &&
    typeof taskName === 'string' &&
    (task.ticketNumber === undefined || typeof task.ticketNumber === 'string') &&
    (typeof task.status === 'string' && task.status.trim().length > 0) &&
    VALID_PRIORITY.has(task.priority) &&
    (task.url === undefined || typeof task.url === 'string') &&
    (task.notes === undefined || typeof task.notes === 'string') &&
    (task.hideInKanbanDone === undefined || typeof task.hideInKanbanDone === 'boolean') &&
    (task.completedAt === undefined || task.completedAt === null || typeof task.completedAt === 'string') &&
    (task.completed_at === undefined || task.completed_at === null || typeof task.completed_at === 'string') &&
    (task.endDate === undefined || task.endDate === null || typeof task.endDate === 'string') &&
    (task.statusLog === undefined || (
      Array.isArray(task.statusLog) &&
      task.statusLog.every((entry) => (
        entry &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        (entry.fromStatus === null || entry.fromStatus === undefined || typeof entry.fromStatus === 'string') &&
        typeof entry.toStatus === 'string' &&
        typeof entry.comment === 'string' &&
        typeof entry.at === 'string'
      ))
    )) &&
    Array.isArray(task.subtasks) &&
    (task.dependencyTaskIds === undefined || (
      Array.isArray(task.dependencyTaskIds) &&
      task.dependencyTaskIds.every((dependencyId) => typeof dependencyId === 'string')
    )) &&
    task.subtasks.every((st) => (
      st &&
      typeof st === 'object' &&
      typeof st.id === 'string' &&
      typeof st.text === 'string' &&
      typeof st.done === 'boolean'
    )) &&
    isPlannedSlotsArrayShape(task.plannedSlots)
  );
}

function isValidNote(note) {
  return (
    note &&
    typeof note === 'object' &&
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.text === 'string' &&
    (note.x === undefined || typeof note.x === 'number') &&
    (note.y === undefined || typeof note.y === 'number') &&
    isValidNoteKind(note.kind)
  );
}

function isValidEvent(event) {
  return (
    event &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    typeof event.title === 'string' &&
    typeof event.startDate === 'string' &&
    (event.endDate === undefined || event.endDate === null || typeof event.endDate === 'string') &&
    typeof event.color === 'string' &&
    (event.allDay === undefined || event.allDay === null || typeof event.allDay === 'boolean' || typeof event.allDay === 'number') &&
    (event.startTime === undefined || event.startTime === null || typeof event.startTime === 'string') &&
    (event.endTime === undefined || event.endTime === null || typeof event.endTime === 'string') &&
    (event.recurrenceFrequency === undefined || event.recurrenceFrequency === null || ['none', 'daily', 'weekly', 'monthly'].includes(event.recurrenceFrequency)) &&
    (event.recurrenceInterval === undefined || event.recurrenceInterval === null || (Number.isInteger(Number(event.recurrenceInterval)) && Number(event.recurrenceInterval) > 0)) &&
    (event.recurrenceUntil === undefined || event.recurrenceUntil === null || typeof event.recurrenceUntil === 'string') &&
    (event.recurrenceCount === undefined || event.recurrenceCount === null || (Number.isInteger(Number(event.recurrenceCount)) && Number(event.recurrenceCount) > 0))
  );
}

function isValidPayload(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.tasks) &&
    payload.tasks.every(isValidTask) &&
    Array.isArray(payload.boardNotes) &&
    payload.boardNotes.every(isValidNote) &&
    Array.isArray(payload.events) &&
    payload.events.every(isValidEvent)
  );
}

export function normalizeSyncBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (isValidPayload(body)) {
    return { profileId: typeof body.profileId === 'string' ? body.profileId : null, mode: 'payload', payload: body };
  }
  if (body.payload && isValidPayload(body.payload)) {
    return { profileId: typeof body.profileId === 'string' ? body.profileId : null, mode: 'payload', payload: body.payload };
  }

  const isValidDeleteList = (list) => Array.isArray(list) && list.every((id) => typeof id === 'string');
  const isValidOpsGroup = (group, validator) => (
    group &&
    typeof group === 'object' &&
    Array.isArray(group.upserts) &&
    group.upserts.every(validator) &&
    isValidDeleteList(group.deletes)
  );

  if (body.ops && typeof body.ops === 'object') {
    const { tasks, notes, events } = body.ops;
    if (
      isValidOpsGroup(tasks, isValidTask) &&
      isValidOpsGroup(notes, isValidNote) &&
      isValidOpsGroup(events, isValidEvent)
    ) {
      return {
        profileId: typeof body.profileId === 'string' ? body.profileId : null,
        mode: 'ops',
        ops: { tasks, notes, events }
      };
    }
  }
  return null;
}
