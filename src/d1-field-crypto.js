/** Stable JSON for deterministic SHA-256 content hashes (sorted object keys, recursive). */
export function stableStringify(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  const t = typeof value;
  if (t === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

export async function sha256HexOfUtf8(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * @param {string|undefined} secret
 * @returns {Promise<CryptoKey|null>}
 */
export async function importDataEncryptionKey(secret) {
  if (!secret || typeof secret !== 'string') return null;
  const trimmed = secret.trim();
  let bytes;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
  } else {
    try {
      const bin = atob(trimmed.replace(/\s/g, ''));
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return null;
    }
  }
  if (bytes.byteLength !== 32) return null;
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

const V1_PREFIX = 'v1.';

/**
 * @param {CryptoKey} key
 * @param {string|null|undefined} plain
 */
export async function encryptField(key, plain) {
  if (plain === null || plain === undefined) return null;
  const enc = new TextEncoder();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    enc.encode(plain)
  );
  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.byteLength);
  return V1_PREFIX + bytesToBase64(combined);
}

/**
 * @param {CryptoKey} key
 * @param {string|null|undefined} stored
 */
export async function decryptField(key, stored) {
  if (stored === null || stored === undefined) return null;
  if (typeof stored !== 'string') return stored;
  if (!stored.startsWith(V1_PREFIX)) return stored;
  try {
    const raw = base64ToBytes(stored.slice(V1_PREFIX.length));
    if (raw.byteLength < 13) return stored;
    const iv = raw.subarray(0, 12);
    const data = raw.subarray(12);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
    return new TextDecoder().decode(plainBuf);
  } catch {
    return stored;
  }
}

/**
 * @param {string} subtasksJson exact JSON string stored for subtasks (must match encrypted payload)
 * @param {string} dependenciesJson exact JSON string for dependency ids
 */
export function buildTaskPlainSnapshot(task, taskSchema, taskName, subtasksJson, dependenciesJson) {
  const snap = {
    category: task.category ?? null,
    completedAt:
      typeof task.completedAt === 'string' && task.completedAt.trim()
        ? task.completedAt.trim()
        : typeof task.completed_at === 'string' && task.completed_at.trim()
          ? task.completed_at.trim()
          : null,
    date: task.date ?? null,
    dependenciesJson,
    hideInKanbanDone: Boolean(task.hideInKanbanDone),
    name: taskName,
    notes: typeof task.notes === 'string' ? task.notes : '',
    priority: task.priority,
    status: task.status,
    subtasksJson,
    ticketNumber: typeof task.ticketNumber === 'string' ? task.ticketNumber.trim() : null,
    time: task.time ?? null,
    url: typeof task.url === 'string' ? task.url : ''
  };
  if (taskSchema?.hasDescription) snap.description = taskName;
  return snap;
}

export function buildNotePlainSnapshot(note) {
  return {
    text: typeof note.text === 'string' ? note.text : '',
    title: typeof note.title === 'string' ? note.title : '',
    x: Number(note.x) || 0,
    y: Number(note.y) || 0
  };
}

export function buildEventPlainSnapshot(event, normalized) {
  return {
    allDay: normalized.allDay,
    color: normalized.color,
    endDate: normalized.endDate,
    endTime: normalized.endTime,
    recurrenceCount: normalized.recurrenceCount,
    recurrenceFrequency: normalized.recurrenceFrequency,
    recurrenceInterval: normalized.recurrenceInterval,
    recurrenceUntil: normalized.recurrenceUntil,
    startDate: event.startDate,
    startTime: normalized.startTime,
    title: event.title
  };
}
