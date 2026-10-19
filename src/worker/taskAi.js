import { partitionDailyStatusActivities, statusChangesForDailyReport } from '../dailyStatusActivities.js';
import { canonicalizeDateOnly } from '../todayViewHelpers.js';

function normalizePriority(priority, defaultPriority = 'high') {
  if (typeof priority !== 'string') return defaultPriority;
  const cleaned = priority.toLowerCase().trim();
  if (['critical', 'critica', 'cr-itica', 'crítica'].includes(cleaned)) return 'critical';
  if (['high', 'alta', 'urgent', 'urgente'].includes(cleaned)) return 'high';
  if (['medium', 'media', 'normal'].includes(cleaned)) return 'medium';
  if (['low', 'baja'].includes(cleaned)) return 'low';
  return defaultPriority;
}

function extractTags(text) {
  if (typeof text !== 'string') return [];
  const tags = new Set();
  const lower = text.toLowerCase();
  if (/(cliente|meeting|reunion|reunión|equipo|trabajo)/.test(lower)) tags.add('trabajo');
  if (/(casa|hogar|familia|personal)/.test(lower)) tags.add('personal');
  if (/(salud|medico|medico|doctor|ejercicio)/.test(lower)) tags.add('salud');
  for (const match of text.matchAll(/#([a-z0-9_-]{2,20})/gi)) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags].slice(0, 5);
}

function stripNoise(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s,])(urgente|urgent|alta prioridad)(?=$|[\s,])/gi, ' ')
    .replace(/(^|[\s,])(prioridad|priority)\s*[:=-]?\s*(low|medium|high|critical|baja|media|alta)/gi, ' ')
    .trim();
}

export function parseTaskFallback(input) {
  const text = (input || '').trim();
  const maxLen = 350;
  const truncated = text.length > maxLen ? text.slice(0, maxLen) : text;
  const lower = truncated.toLowerCase();
  const explicitPriority =
    /\b(urgente|urgent)\b/.test(lower) ? 'high' :
    (/\b(critical|critica|crítica)\b/.test(lower) ? 'critical' : null);
  const priorityMatch = lower.match(/\b(?:prioridad|priority)\s*[:=-]?\s*(low|medium|high|critical|baja|media|alta)\b/);
  const priority = normalizePriority(priorityMatch?.[1] || explicitPriority, 'high');
  const title = stripNoise(truncated).replace(/[.,;:\- ]+$/g, '') || truncated || 'Nueva tarea';
  return {
    title: title.slice(0, 120),
    dueDate: null,
    priority,
    tags: extractTags(truncated)
  };
}

export function sanitizeParsedTask(parsed, fallbackText) {
  const fb = parseTaskFallback(fallbackText);
  if (!parsed || typeof parsed !== 'object') return fb;
  const title =
    typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : fb.title;
  const dueDate = typeof parsed.dueDate === 'string' && parsed.dueDate.trim() ? parsed.dueDate.trim() : null;
  const priority = normalizePriority(parsed.priority || fb.priority, 'high');
  const tags = Array.isArray(parsed.tags)
    ? [...new Set(parsed.tags.filter((t) => typeof t === 'string').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 5)
    : fb.tags;
  return { title, dueDate, priority, tags };
}

export async function parseTaskWithAi(input, env) {
  if (!env?.AI?.run) return null;
  const prompt = [
    'Extrae una tarea de texto libre y responde SOLO JSON valido.',
    'Formato exacto: {"title":"string","dueDate":"YYYY-MM-DDTHH:mm:ssZ|null","priority":"low|medium|high|critical","tags":["tag1"]}',
    'Si no hay fecha clara, usar null en dueDate.',
    'Si el texto no indica explícitamente una prioridad, usa "high" por defecto.',
    `Texto: ${input}`
  ].join('\n');
  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 140,
    temperature: 0.1
  });
  const raw = typeof result?.response === 'string' ? result.response.trim() : '';
  if (!raw) return null;
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
  const maybeJson = raw.slice(jsonStart, jsonEnd + 1);
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

function parseDateInCurrentWeek(text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  const cleaned = text.toLowerCase();
  const explicitDate = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (explicitDate) return `${explicitDate[1]}-${explicitDate[2]}-${explicitDate[3]}`;

  const weekdays = new Map([
    ['domingo', 0],
    ['lunes', 1],
    ['martes', 2],
    ['miercoles', 3],
    ['miércoles', 3],
    ['jueves', 4],
    ['viernes', 5],
    ['sabado', 6],
    ['sábado', 6],
  ]);
  let requestedWeekday = null;
  for (const [word, value] of weekdays.entries()) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(cleaned)) {
      requestedWeekday = value;
      break;
    }
  }
  if (requestedWeekday === null) return '';

  const now = new Date();
  const currentWeekday = now.getDay();
  const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() + mondayOffset);
  const target = new Date(monday);
  const dayOffset = requestedWeekday === 0 ? 6 : requestedWeekday - 1;
  target.setDate(monday.getDate() + dayOffset);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

function parseMainTasksFallback(input) {
  if (typeof input !== 'string') return [];
  const tasksMatch = input.match(/(?:crear?|agregar?)\s+(?:tasks?|tareas?)\s+para\s+(.+?)(?:,|$)/i);
  if (tasksMatch?.[1]) {
    const rawMain = tasksMatch[1]
      .split(/(?:,|;|\sy\s|\sand\s)/i)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (rawMain.length > 0) {
      return rawMain.map((name, index) => ({
        ref: `main_${index + 1}`,
        name,
        date: parseDateInCurrentWeek(input),
        time: '',
        priority: 'high',
        notes: '',
        category: ''
      }));
    }
  }

  const parsed = parseTaskFallback(input);
  return [{
    ref: 'main_1',
    name: parsed.title || 'Nueva tarea',
    date: parseDateInCurrentWeek(input),
    time: '',
    priority: parsed.priority || 'high',
    notes: '',
    category: parsed.tags?.[0] || ''
  }];
}

function parseChildTasksFallback(input, mainTasks) {
  if (typeof input !== 'string') return [];
  const childMatch = input.match(/(?:subtareas?|subtasks?)\s+(?:para|de)\s+(?:tarea\s+)?(.+?)(?:\s*[:,-]\s*|\s+)(.+)$/i);
  if (childMatch?.[1] && childMatch?.[2]) {
    const parentHint = childMatch[1].trim().toLowerCase();
    const childName = childMatch[2].trim();
    const parentCandidate = mainTasks.find((task) => task.name.toLowerCase().includes(parentHint) || parentHint.includes(task.name.toLowerCase()));
    return [{
      name: childName,
      parentRef: parentCandidate?.ref || mainTasks[0]?.ref || 'main_1',
      date: '',
      time: '',
      priority: 'high',
      notes: '',
      category: ''
    }];
  }

  const genericChildrenMatch = input.match(/(?:subtareas?|subtasks?)\s*[:,-]?\s*(.+)$/i);
  if (!genericChildrenMatch?.[1]) return [];
  return genericChildrenMatch[1]
    .split(/(?:,|;|\sy\s|\sand\s)/i)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((name) => ({
      name,
      parentRef: mainTasks[0]?.ref || 'main_1',
      date: '',
      time: '',
      priority: 'high',
      notes: '',
      category: ''
    }));
}

export function generateTaskPlanFallback(input) {
  const mainTasks = parseMainTasksFallback(input);
  const childTasks = parseChildTasksFallback(input, mainTasks);
  return { mainTasks, childTasks };
}

export async function generateTasksFromTextWithAi(input, env) {
  if (!env?.AI?.run) return null;
  const prompt = [
    'Convierte texto libre en varias tareas principales y tareas hijas dependientes.',
    'Responde SOLO JSON valido.',
    'Formato exacto:',
    '{"mainTasks":[{"ref":"main_1","name":"string","date":"YYYY-MM-DD|","time":"HH:MM|","priority":"low|medium|high|critical","notes":"string","category":"string"}],"childTasks":[{"name":"string","parentRef":"main_1","date":"YYYY-MM-DD|","time":"HH:MM|","priority":"low|medium|high|critical","notes":"string","category":"string"}]}',
    'Si no hay fecha/hora clara, devolver string vacio.',
    'Si menciona subtareas, devolverlas como childTasks con parentRef.',
    'Si el texto no indica explícitamente una prioridad para las tareas, usa "high" por defecto.',
    'Maximo 8 mainTasks y 12 childTasks.',
    `Texto: ${input}`
  ].join('\n');
  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 420,
    temperature: 0.1
  });
  const raw = typeof result?.response === 'string' ? result.response.trim() : '';
  if (!raw) return null;
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clampDailyStatusDaysInput(days) {
  const parsed = Number.parseInt(String(days), 10);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(7, Math.max(1, parsed));
}

export function sanitizeDailyStatusActivities(activities) {
  if (!Array.isArray(activities)) return [];
  return activities.slice(0, 40).map((item) => {
    if (!item || typeof item !== 'object') return null;
    const normalized = {
      name: typeof item.name === 'string' ? item.name.slice(0, 200) : '',
      ticketNumber: typeof item.ticketNumber === 'string' ? item.ticketNumber.slice(0, 40) : '',
      category: typeof item.category === 'string' ? item.category.slice(0, 80) : '',
      priority: typeof item.priority === 'string' ? item.priority : 'medium',
      currentStatus: typeof item.currentStatus === 'string' ? item.currentStatus : 'not_done',
      createdInWindow: Boolean(item.createdInWindow),
      completedInWindow: Boolean(item.completedInWindow),
      movedToDoneInWindow: Boolean(item.movedToDoneInWindow),
      statusChanges: Array.isArray(item.statusChanges)
        ? item.statusChanges.slice(0, 20).map((change) => ({
          fromStatus: typeof change?.fromStatus === 'string' ? change.fromStatus : null,
          toStatus: typeof change?.toStatus === 'string' ? change.toStatus : '',
          comment: typeof change?.comment === 'string' ? change.comment.slice(0, 500) : '',
          at: typeof change?.at === 'string' ? change.at : '',
        })).filter((c) => c.toStatus && c.comment)
        : [],
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 600) : '',
    };
    normalized.statusChanges = statusChangesForDailyReport(normalized);
    return normalized;
  }).filter(Boolean);
}

function buildDailyStatusAiPayload(days, activities) {
  const sanitized = sanitizeDailyStatusActivities(activities);
  const { doneInPeriod, activeNow, blocked } = partitionDailyStatusActivities(sanitized);
  return { days, doneInPeriod, activeNow, blocked };
}

export async function generateDailyStatusWithAi(days, activities, env) {
  if (!env?.AI?.run) return null;
  const payload = buildDailyStatusAiPayload(days, activities);
  const payloadJson = JSON.stringify(payload);
  if (payloadJson.length > 12000) return null;
  const prompt = [
    'Genera un daily status estilo Scrum en español a partir del JSON.',
    'El JSON ya separa las tareas en tres listas; NO reasignes tareas entre secciones.',
    'Estructura obligatoria (markdown):',
    '## Hecho',
    'Lista SOLO las tareas de doneInPeriod (completadas o marcadas done dentro del periodo). No agregues otras tareas hechas.',
    '## Hoy / En curso',
    'Lista SOLO las tareas de activeNow. Nunca incluyas tareas con currentStatus "done".',
    '## Bloqueadores',
    'Lista SOLO las tareas de blocked.',
    'Usa viñetas breves. Menciona tickets si existen. Cita comentarios de statusChanges cuando aporten.',
    'Si una lista viene vacía, escribe "Ninguno." bajo ese encabezado.',
    'No inventes tareas fuera del JSON. Responde SOLO el texto del reporte.',
    `Periodo: ultimos ${days} dias.`,
    `Datos: ${payloadJson}`,
  ].join('\n');
  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 700,
    temperature: 0.2,
  });
  const raw = typeof result?.response === 'string' ? result.response.trim() : '';
  return raw || null;
}

export function normalizeGeneratedTaskPlan(aiParsed, sourceText) {
  const fallback = generateTaskPlanFallback(sourceText);
  const inputMain = aiParsed && typeof aiParsed === 'object' && Array.isArray(aiParsed.mainTasks)
    ? aiParsed.mainTasks
    : fallback.mainTasks;
  const inputChildren = aiParsed && typeof aiParsed === 'object' && Array.isArray(aiParsed.childTasks)
    ? aiParsed.childTasks
    : fallback.childTasks;

  const normalizeMain = (item, fallbackName, fallbackRef) => {
    const rawDate = canonicalizeDateOnly(item?.date);
    const derivedDate = rawDate || parseDateInCurrentWeek(sourceText);
    return {
      ref: typeof item?.ref === 'string' && item.ref.trim() ? item.ref.trim().slice(0, 30) : fallbackRef,
      name: typeof item?.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 120) : fallbackName,
      date: canonicalizeDateOnly(derivedDate) || '',
      time: typeof item?.time === 'string' ? item.time.trim().slice(0, 5) : '',
      priority: normalizePriority(item?.priority),
      notes: typeof item?.notes === 'string' ? item.notes.trim().slice(0, 400) : '',
      category: typeof item?.category === 'string' ? item.category.trim().slice(0, 30) : '',
    };
  };

  const normalizeChild = (item, fallbackName, defaultParentRef) => ({
    name: typeof item?.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 120) : fallbackName,
    parentRef: typeof item?.parentRef === 'string' && item.parentRef.trim() ? item.parentRef.trim().slice(0, 30) : defaultParentRef,
    date: canonicalizeDateOnly(item?.date),
    time: typeof item?.time === 'string' ? item.time.trim().slice(0, 5) : '',
    priority: normalizePriority(item?.priority),
    notes: typeof item?.notes === 'string' ? item.notes.trim().slice(0, 400) : '',
    category: typeof item?.category === 'string' ? item.category.trim().slice(0, 30) : '',
  });

  const mainTasks = inputMain
    .filter((item) => item && typeof item === 'object')
    .slice(0, 8)
    .map((item, index) => normalizeMain(item, `Tarea ${index + 1}`, `main_${index + 1}`))
    .filter((item) => item.name);
  if (mainTasks.length === 0) mainTasks.push(...fallback.mainTasks);
  const validRefs = new Set(mainTasks.map((item) => item.ref));
  const defaultParentRef = mainTasks[0]?.ref || 'main_1';
  const childTasks = inputChildren
    .filter((item) => item && typeof item === 'object')
    .slice(0, 12)
    .map((item, index) => normalizeChild(item, `Subtarea ${index + 1}`, defaultParentRef))
    .filter((item) => item.name)
    .map((item) => ({ ...item, parentRef: validRefs.has(item.parentRef) ? item.parentRef : defaultParentRef }));

  return { mainTasks, childTasks };
}
