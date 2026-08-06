import { NOTE_CLASSIFICATIONS } from './constants.js';

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const JIRA_TICKET_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const DATE_RE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/g;
const PLATFORM_RE = /\b(jira|confluence|github|gitlab|slack|notion|figma|linear|trello|asana|google\s?docs?|drive|teams|outlook)\b/gi;

const CLASSIFICATION_HINTS = [
  { id: 'Trabajo', words: ['reunión', 'meeting', 'cliente', 'sprint', 'deploy', 'jira', 'ticket', 'standup', 'proyecto'] },
  { id: 'Personal', words: ['familia', 'casa', 'médico', 'vacaciones', 'cumpleaños', 'personal'] },
  { id: 'Ideas', words: ['idea', 'brainstorm', 'qué tal si', 'podríamos', 'inspiración', 'concepto'] },
  { id: 'Investigación', words: ['investigar', 'research', 'leer', 'paper', 'docs', 'documentación', 'aprender'] },
  { id: 'Pendientes', words: ['todo', 'pendiente', 'hacer', 'recordar', 'llamar', 'enviar', 'comprar', 'deadline'] },
  { id: 'Referencia', words: ['referencia', 'link', 'enlace', 'anotar', 'guardar', 'snippet'] },
];

const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'para', 'por', 'con', 'del', 'que',
  'the', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'are', 'this', 'that', 'with',
]);

function combinedText(title, text) {
  return `${title || ''}\n${text || ''}`.trim();
}

function uniqueStrings(items, max = 12) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const v = typeof item === 'string' ? item.trim() : '';
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function extractEntitiesFallback(title, text) {
  const raw = combinedText(title, text);
  const urls = uniqueStrings([...(raw.match(URL_RE) || [])], 8);
  const tickets = uniqueStrings([...(raw.match(JIRA_TICKET_RE) || [])], 8);
  const emails = uniqueStrings([...(raw.match(EMAIL_RE) || [])], 6);
  const dates = uniqueStrings([...(raw.match(DATE_RE) || [])], 6);
  const platforms = uniqueStrings(
    [...(raw.match(PLATFORM_RE) || [])].map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()),
    6
  );
  const people = uniqueStrings(
    emails.map((e) => e.split('@')[0].replace(/[._]/g, ' ')),
    6
  );
  const projects = tickets.map((t) => t.split('-')[0]).filter(Boolean);
  return {
    people,
    projects: uniqueStrings(projects, 6),
    tickets,
    urls,
    platforms,
    dates,
  };
}

export function classifyNoteFallback(title, text) {
  const raw = combinedText(title, text).toLowerCase();
  let best = 'Otro';
  let bestScore = 0;
  for (const hint of CLASSIFICATION_HINTS) {
    let score = 0;
    for (const w of hint.words) {
      if (raw.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = hint.id;
    }
  }
  return NOTE_CLASSIFICATIONS.includes(best) ? best : 'Otro';
}

export function extractTagsFallback(title, text) {
  const entities = extractEntitiesFallback(title, text);
  const tags = [];
  if (entities.tickets.length) tags.push('jira');
  if (entities.urls.length) tags.push('links');
  if (entities.dates.length) tags.push('fechas');
  for (const p of entities.platforms.slice(0, 3)) tags.push(p.toLowerCase());

  const words = combinedText(title, text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .split(/[^a-záéíóúüñ0-9#+-]+/i)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  return uniqueStrings([...tags, ...top], 8);
}

export function summarizeNoteFallback(title, text) {
  const body = (text || '').trim();
  const head = (title || '').trim();
  if (!body && !head) return '';
  if (!body) return head.slice(0, 160);
  const first = body.split(/\n+/).map((l) => l.trim()).find(Boolean) || body;
  const clipped = first.length > 180 ? `${first.slice(0, 177)}…` : first;
  return head && !clipped.toLowerCase().startsWith(head.toLowerCase())
    ? `${head}: ${clipped}`
    : clipped;
}

export function suggestTasksFallback(title, text) {
  const lines = combinedText(title, text)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const suggestions = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-*•\d.)\s]+/, '').trim();
    const lower = cleaned.toLowerCase();
    const looksActionable =
      /^(hacer|llamar|enviar|revisar|preparar|comprar|escribir|agendar|resolver|fix|implement|check|todo)\b/i.test(cleaned) ||
      /\b(pendiente|deadline|asap|urgente)\b/i.test(lower) ||
      /^\[\s*\]/.test(line);
    if (looksActionable && cleaned.length >= 4 && cleaned.length <= 120) {
      suggestions.push(cleaned.replace(/^\[\s*\]\s*/, ''));
    }
    if (suggestions.length >= 3) break;
  }
  return suggestions;
}

/**
 * Deterministic note analysis used when Workers AI is unavailable.
 */
export function analyzeNoteFallback(title, text, prefs = {}) {
  const entities = prefs.entities === false ? emptyEntities() : extractEntitiesFallback(title, text);
  const tags = prefs.autotag === false ? [] : extractTagsFallback(title, text);
  const classification = prefs.classification === false ? null : classifyNoteFallback(title, text);
  const summary = prefs.summary === false ? '' : summarizeNoteFallback(title, text);
  const taskSuggestions = prefs.taskSuggestions === false ? [] : suggestTasksFallback(title, text);
  return {
    summary,
    tags,
    entities,
    classification,
    taskSuggestions,
    source: 'fallback',
  };
}

function emptyEntities() {
  return { people: [], projects: [], tickets: [], urls: [], platforms: [], dates: [] };
}

export function sanitizeAnalysisResult(raw, prefs = {}) {
  const fallback = analyzeNoteFallback('', '', prefs);
  if (!raw || typeof raw !== 'object') return { ...fallback, source: raw?.source || 'fallback' };

  const entitiesIn = raw.entities && typeof raw.entities === 'object' ? raw.entities : {};
  const entities = {
    people: uniqueStrings(entitiesIn.people, 8),
    projects: uniqueStrings(entitiesIn.projects, 8),
    tickets: uniqueStrings(entitiesIn.tickets, 8),
    urls: uniqueStrings(entitiesIn.urls, 8),
    platforms: uniqueStrings(entitiesIn.platforms, 8),
    dates: uniqueStrings(entitiesIn.dates, 8),
  };

  let classification = typeof raw.classification === 'string' ? raw.classification.trim() : null;
  if (classification && !NOTE_CLASSIFICATIONS.includes(classification)) {
    classification = NOTE_CLASSIFICATIONS.find((c) => c.toLowerCase() === classification.toLowerCase()) || 'Otro';
  }

  const summary = typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 400) : '';
  const tags = uniqueStrings(Array.isArray(raw.tags) ? raw.tags : [], 10).map((t) => t.slice(0, 40));
  const taskSuggestions = uniqueStrings(Array.isArray(raw.taskSuggestions) ? raw.taskSuggestions : [], 5)
    .map((t) => t.slice(0, 160));

  return {
    summary: prefs.summary === false ? '' : summary,
    tags: prefs.autotag === false ? [] : tags,
    entities: prefs.entities === false ? emptyEntities() : entities,
    classification: prefs.classification === false ? null : (classification || 'Otro'),
    taskSuggestions: prefs.taskSuggestions === false ? [] : taskSuggestions,
    source: raw.source === 'ai' ? 'ai' : 'fallback',
  };
}
