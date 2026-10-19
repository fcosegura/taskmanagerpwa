import { decryptProfileRows } from '../profiles.js';
import {
  encryptField, decryptField, stableStringify, sha256HexOfUtf8,
  buildTaskPlainSnapshot, buildNotePlainSnapshot, buildEventPlainSnapshot,
} from '../../d1-field-crypto.js';
import { normalizePlannedSlots } from '../../plannedSlots.js';
import { scopedEntityId, unscopedEntityId } from '../entityIds.js';

export async function prepareTaskUpsert(env, dataKey, profileId, userId, task, taskSchema) {
  const taskName = typeof task?.name === 'string'
    ? task.name
    : (typeof task?.description === 'string' ? task.description : '');
  const hasName = Boolean(taskSchema?.hasName);
  const hasDescription = Boolean(taskSchema?.hasDescription);
  const hasUrl = Boolean(taskSchema?.hasUrl);
  const hasNotes = Boolean(taskSchema?.hasNotes);
  const hasTicketNumber = Boolean(taskSchema?.hasTicketNumber);
  const hasCompletedAt = Boolean(taskSchema?.hasCompletedAt);
  const hasStatusLog = Boolean(taskSchema?.hasStatusLog);
  const hasEndDate = Boolean(taskSchema?.hasEndDate);

  const subtasksJson = JSON.stringify(task.subtasks || []);
  const dependenciesJson = JSON.stringify(
    [...(task.dependencyTaskIds || [])].filter((x) => typeof x === 'string').sort()
  );
  const statusLogJson = JSON.stringify(
    Array.isArray(task.statusLog)
      ? task.statusLog.filter((entry) => entry && typeof entry === 'object')
      : []
  );
  const snapshot = buildTaskPlainSnapshot(task, taskSchema, taskName, subtasksJson, dependenciesJson, statusLogJson);
  const contentHash = await sha256HexOfUtf8(stableStringify(snapshot));

  const columns = ['id', 'user_id', 'profile_id'];
  const placeholders = ['?', '?', '?'];
  const bindings = [
    scopedEntityId(profileId, task.id),
    userId,
    profileId
  ];
  const updates = [];

  if (hasName) {
    columns.push('name');
    placeholders.push('?');
    bindings.push(await encryptField(dataKey, taskName));
    updates.push('name = excluded.name');
  }
  if (hasDescription) {
    columns.push('description');
    placeholders.push('?');
    bindings.push(await encryptField(dataKey, taskName));
    updates.push('description = excluded.description');
  }
  if (hasUrl) {
    columns.push('url');
    placeholders.push('?');
    bindings.push(await encryptField(dataKey, task.url || null));
    updates.push('url = excluded.url');
  }
  if (hasNotes) {
    columns.push('notes');
    placeholders.push('?');
    bindings.push(await encryptField(dataKey, task.notes || null));
    updates.push('notes = excluded.notes');
  }
  if (hasTicketNumber) {
    columns.push('ticket_number');
    placeholders.push('?');
    const rawTk = typeof task.ticketNumber === 'string' ? task.ticketNumber.trim() : null;
    bindings.push(await encryptField(dataKey, rawTk));
    updates.push('ticket_number = excluded.ticket_number');
  }
  if (hasCompletedAt) {
    columns.push('completed_at');
    placeholders.push('?');
    const ca = typeof task.completedAt === 'string' && task.completedAt.trim()
      ? task.completedAt.trim()
      : (typeof task.completed_at === 'string' && task.completed_at.trim() ? task.completed_at.trim() : null);
    bindings.push(await encryptField(dataKey, ca || null));
    updates.push('completed_at = excluded.completed_at');
  }

  const encCategory = await encryptField(dataKey, task.category || null);
  const encDate = await encryptField(dataKey, task.date || null);
  const encEndDate = await encryptField(dataKey, typeof task.endDate === 'string' && task.endDate.trim() ? task.endDate.trim() : null);
  const encTime = await encryptField(dataKey, task.time || null);
  const encSubtasks = await encryptField(dataKey, subtasksJson);
  const encDeps = await encryptField(dataKey, dependenciesJson);
  const plannedSlotsJson = JSON.stringify(normalizePlannedSlots(task.plannedSlots));
  const encPlannedSlots = await encryptField(dataKey, plannedSlotsJson);
  const encStatusLog = await encryptField(dataKey, statusLogJson);

  columns.push('status', 'priority', 'category', 'date', 'time', 'subtasks', 'dependencies', 'hide_in_kanban_done', 'planned_slots');
  placeholders.push('?', '?', '?', '?', '?', '?', '?', '?', '?');
  bindings.push(
    task.status,
    task.priority,
    encCategory,
    encDate,
    encTime,
    encSubtasks,
    encDeps,
    task.hideInKanbanDone ? 1 : 0,
    encPlannedSlots
  );
  updates.push(
    'status = excluded.status',
    'priority = excluded.priority',
    'category = excluded.category',
    'date = excluded.date',
    'time = excluded.time',
    'subtasks = excluded.subtasks',
    'dependencies = excluded.dependencies',
    'hide_in_kanban_done = excluded.hide_in_kanban_done',
    'planned_slots = excluded.planned_slots',
    'updated_at = CURRENT_TIMESTAMP'
  );

  if (hasStatusLog) {
    columns.push('status_log');
    placeholders.push('?');
    bindings.push(encStatusLog);
    updates.push('status_log = excluded.status_log');
  }

  if (hasEndDate) {
    columns.push('end_date');
    placeholders.push('?');
    bindings.push(encEndDate);
    updates.push('end_date = excluded.end_date');
  }

  columns.push('content_hash');
  placeholders.push('?');
  bindings.push(contentHash);
  updates.push('content_hash = excluded.content_hash');

  const statement =
    `INSERT INTO tasks (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')} ` +
    'WHERE tasks.user_id = excluded.user_id AND tasks.profile_id = excluded.profile_id AND ' +
    '(tasks.content_hash IS NOT excluded.content_hash OR tasks.content_hash IS NULL)';
  return env.DB.prepare(statement).bind(...bindings);
}

export async function prepareNoteUpsert(env, dataKey, profileId, userId, note) {
  const title = typeof note.title === 'string' ? note.title : '';
  const text = typeof note.text === 'string' ? note.text : '';
  const x = note.x || 0;
  const y = note.y || 0;
  const snap = buildNotePlainSnapshot({ title, text, x, y });
  const contentHash = await sha256HexOfUtf8(stableStringify(snap));
  const encTitle = await encryptField(dataKey, title);
  const encText = await encryptField(dataKey, text);
  return env.DB.prepare(
    "INSERT INTO notes (id, user_id, profile_id, title, text, x, y, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title = excluded.title, text = excluded.text, x = excluded.x, y = excluded.y, " +
    "content_hash = excluded.content_hash, updated_at = CURRENT_TIMESTAMP " +
    "WHERE notes.user_id = excluded.user_id AND notes.profile_id = excluded.profile_id AND (" +
    "notes.content_hash IS NOT excluded.content_hash OR notes.content_hash IS NULL)"
  ).bind(
    scopedEntityId(profileId, note.id),
    userId,
    profileId,
    encTitle,
    encText,
    x,
    y,
    contentHash
  );
}

export async function prepareEventUpsert(env, dataKey, profileId, userId, event) {
  const allDay = event.allDay === false || event.allDay === 0 ? 0 : 1;
  const startTime = allDay === 0 && typeof event.startTime === 'string' && event.startTime ? event.startTime : null;
  const endTime = allDay === 0 && typeof event.endTime === 'string' && event.endTime ? event.endTime : null;
  const recurrenceFrequency = ['none', 'daily', 'weekly', 'monthly'].includes(event.recurrenceFrequency)
    ? event.recurrenceFrequency
    : 'none';
  const parsedRecurrenceInterval = Number.parseInt(String(event.recurrenceInterval ?? '1'), 10);
  const recurrenceInterval = Number.isFinite(parsedRecurrenceInterval) && parsedRecurrenceInterval > 0
    ? parsedRecurrenceInterval
    : 1;
  const recurrenceUntil = recurrenceFrequency === 'none'
    ? null
    : (typeof event.recurrenceUntil === 'string' && event.recurrenceUntil ? event.recurrenceUntil : null);
  const parsedRecurrenceCount = Number.parseInt(String(event.recurrenceCount ?? ''), 10);
  const recurrenceCount = recurrenceFrequency === 'none'
    ? null
    : (Number.isFinite(parsedRecurrenceCount) && parsedRecurrenceCount > 0 ? parsedRecurrenceCount : null);
  const endDate = event.endDate || null;
  const color = event.color || '#3b82f6';
  const norm = {
    allDay,
    color,
    endDate,
    endTime,
    recurrenceCount,
    recurrenceFrequency,
    recurrenceInterval,
    recurrenceUntil,
    startTime
  };
  const snap = buildEventPlainSnapshot(event, norm);
  const contentHash = await sha256HexOfUtf8(stableStringify(snap));
  const encTitle = await encryptField(dataKey, event.title);
  const encStartDate = await encryptField(dataKey, event.startDate);
  const encEndDate = await encryptField(dataKey, endDate);
  const encColor = await encryptField(dataKey, color);
  const encStartTime = await encryptField(dataKey, startTime);
  const encEndTime = await encryptField(dataKey, endTime);
  const encFreq = await encryptField(dataKey, recurrenceFrequency);
  const encUntil = await encryptField(dataKey, recurrenceUntil);
  const storedInterval = recurrenceFrequency === 'none' ? 1 : recurrenceInterval;
  return env.DB.prepare(
    "INSERT INTO events (id, user_id, profile_id, title, startDate, endDate, color, allDay, startTime, endTime, recurrenceFrequency, recurrenceInterval, recurrenceUntil, recurrenceCount, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET " +
    "title = excluded.title, startDate = excluded.startDate, endDate = excluded.endDate, color = excluded.color, " +
    "allDay = excluded.allDay, startTime = excluded.startTime, endTime = excluded.endTime, " +
    "recurrenceFrequency = excluded.recurrenceFrequency, recurrenceInterval = excluded.recurrenceInterval, recurrenceUntil = excluded.recurrenceUntil, recurrenceCount = excluded.recurrenceCount, " +
    "content_hash = excluded.content_hash, updated_at = CURRENT_TIMESTAMP " +
    "WHERE events.user_id = excluded.user_id AND events.profile_id = excluded.profile_id AND (" +
    "events.content_hash IS NOT excluded.content_hash OR events.content_hash IS NULL)"
  ).bind(
    scopedEntityId(profileId, event.id),
    userId,
    profileId,
    encTitle,
    encStartDate,
    encEndDate,
    encColor,
    allDay,
    encStartTime,
    encEndTime,
    encFreq,
    storedInterval,
    encUntil,
    recurrenceCount,
    contentHash
  );
}

export async function readWorkspaceData(env, dataKey, userId, profileId) {
  const { results: profiles } = await env.DB.prepare(
    "SELECT id, name, custom_statuses, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
  ).bind(userId).all();
  const { results: tasks } = await env.DB.prepare(
    "SELECT * FROM tasks WHERE user_id = ? AND profile_id = ?"
  ).bind(userId, profileId).all();
  const { results: notes } = await env.DB.prepare(
    "SELECT * FROM notes WHERE user_id = ? AND profile_id = ?"
  ).bind(userId, profileId).all();
  const { results: events } = await env.DB.prepare(
    "SELECT * FROM events WHERE user_id = ? AND profile_id = ?"
  ).bind(userId, profileId).all();

  const profilesOut = await decryptProfileRows(dataKey, profiles);

  const parsedTasks = [];
  for (const t of tasks || []) {
    const tr = { ...t };
    delete tr.content_hash;
    const nameDec = await decryptField(dataKey, tr.name);
    const descDec = tr.description != null ? await decryptField(dataKey, tr.description) : '';
    const nameOut = typeof nameDec === 'string' && nameDec !== ''
      ? nameDec
      : (typeof descDec === 'string' ? descDec : '');
    const urlOut = (await decryptField(dataKey, tr.url)) || '';
    const notesOut = (await decryptField(dataKey, tr.notes)) || '';
    const ticketOut = (await decryptField(dataKey, tr.ticket_number)) || '';
    const categoryOut = (await decryptField(dataKey, tr.category)) || null;
    const dateOut = (await decryptField(dataKey, tr.date)) || null;
    const endDateOut = (await decryptField(dataKey, tr.end_date)) || '';
    const timeOut = (await decryptField(dataKey, tr.time)) || null;
    const completedOut = (await decryptField(dataKey, tr.completed_at)) || '';
    const subRaw = await decryptField(dataKey, tr.subtasks || '[]');
    const depRaw = await decryptField(dataKey, tr.dependencies || '[]');
    const plannedRaw = await decryptField(dataKey, tr.planned_slots || '[]');
    const statusLogRaw = await decryptField(dataKey, tr.status_log || '[]');
    let subtasks = [];
    let dependencyTaskIds = [];
    let plannedSlots = [];
    let statusLog = [];
    try {
      subtasks = JSON.parse(subRaw || '[]');
    } catch {
      subtasks = [];
    }
    try {
      dependencyTaskIds = JSON.parse(depRaw || '[]');
    } catch {
      dependencyTaskIds = [];
    }
    try {
      plannedSlots = JSON.parse(plannedRaw || '[]');
    } catch {
      plannedSlots = [];
    }
    try {
      statusLog = JSON.parse(statusLogRaw || '[]');
    } catch {
      statusLog = [];
    }
    delete tr.planned_slots;
    delete tr.status_log;
    // Explicit allow-list: never leak user_id/profile_id/description or
    // any stored ciphertext back to the client.
    parsedTasks.push({
      id: unscopedEntityId(profileId, tr.id),
      name: nameOut,
      status: typeof tr.status === 'string' ? tr.status : '',
      priority: typeof tr.priority === 'string' ? tr.priority : '',
      url: typeof urlOut === 'string' ? urlOut : '',
      notes: typeof notesOut === 'string' ? notesOut : '',
      hideInKanbanDone: Boolean(tr.hide_in_kanban_done),
      subtasks,
      dependencyTaskIds,
      plannedSlots: normalizePlannedSlots(plannedSlots),
      statusLog: Array.isArray(statusLog) ? statusLog : [],
      ticketNumber: typeof ticketOut === 'string' ? ticketOut : '',
      completedAt: typeof completedOut === 'string' && completedOut ? completedOut : '',
      createdAt: tr.created_at || null,
      updatedAt: tr.updated_at || null,
      category: categoryOut,
      date: dateOut,
      endDate: typeof endDateOut === 'string' && endDateOut ? endDateOut : '',
      time: timeOut
    });
  }

  const parsedNotes = [];
  for (const note of notes || []) {
    const titleDec = await decryptField(dataKey, note.title);
    const textDec = await decryptField(dataKey, note.text);
    parsedNotes.push({
      id: unscopedEntityId(profileId, note.id),
      title: typeof titleDec === 'string' ? titleDec : '',
      text: typeof textDec === 'string' ? textDec : '',
      x: typeof note.x === 'number' ? note.x : 0,
      y: typeof note.y === 'number' ? note.y : 0,
      createdAt: note.created_at,
      updatedAt: note.updated_at
    });
  }

  const parsedEvents = [];
  for (const event of events || []) {
    const titleDec = await decryptField(dataKey, event.title);
    const startDateDec = await decryptField(dataKey, event.startDate);
    const endDateDec = await decryptField(dataKey, event.endDate);
    const colorDec = await decryptField(dataKey, event.color);
    const startTimeDec = await decryptField(dataKey, event.startTime);
    const endTimeDec = await decryptField(dataKey, event.endTime);
    const freqDec = await decryptField(dataKey, event.recurrenceFrequency);
    const untilDec = await decryptField(dataKey, event.recurrenceUntil);
    const freqStr = freqDec == null ? '' : String(freqDec);
    parsedEvents.push({
      id: unscopedEntityId(profileId, event.id),
      title: typeof titleDec === 'string' ? titleDec : '',
      startDate: typeof startDateDec === 'string' ? startDateDec : '',
      endDate: typeof endDateDec === 'string' ? endDateDec : '',
      color: typeof colorDec === 'string' ? colorDec : '#3b82f6',
      startTime: typeof startTimeDec === 'string' ? startTimeDec : '',
      endTime: typeof endTimeDec === 'string' ? endTimeDec : '',
      recurrenceFrequency: ['none', 'daily', 'weekly', 'monthly'].includes(freqStr)
        ? freqStr
        : 'none',
      recurrenceUntil: typeof untilDec === 'string' ? untilDec : '',
      allDay: event.allDay === 0 || event.allDay === false ? false : true,
      recurrenceInterval: Number.isFinite(Number(event.recurrenceInterval)) && Number(event.recurrenceInterval) > 0
        ? Number(event.recurrenceInterval)
        : 1,
      recurrenceCount: Number.isFinite(Number(event.recurrenceCount)) && Number(event.recurrenceCount) > 0
        ? Number(event.recurrenceCount)
        : null,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    });
  }

  return {
    tasks: parsedTasks,
    boardNotes: parsedNotes,
    events: parsedEvents,
    profiles: profilesOut,
    activeProfileId: profileId
  };
}
