import { encryptField, decryptField } from '../d1-field-crypto.js';

async function ensureDefaultProfile(env, userId, dataKey) {
  const defaultProfileId = `${userId}:work`;
  const defaultNameEnc = await encryptField(dataKey, 'Trabajo');
  await env.DB.prepare(
    "INSERT OR IGNORE INTO profiles (id, user_id, name) VALUES (?, ?, ?)"
  ).bind(defaultProfileId, userId, defaultNameEnc).run();

  // Migrate legacy rows with NULL profile_id into default profile.
  await env.DB.batch([
    env.DB.prepare("UPDATE tasks SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId),
    env.DB.prepare("UPDATE notes SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId),
    env.DB.prepare("UPDATE events SET profile_id = ? WHERE user_id = ? AND profile_id IS NULL").bind(defaultProfileId, userId)
  ]);

  return defaultProfileId;
}

export async function resolveProfileId(env, userId, requestedProfileId, dataKey) {
  const defaultProfileId = await ensureDefaultProfile(env, userId, dataKey);
  if (!requestedProfileId) return defaultProfileId;
  const row = await env.DB.prepare(
    "SELECT id FROM profiles WHERE id = ? AND user_id = ?"
  ).bind(requestedProfileId, userId).first();
  return row?.id || defaultProfileId;
}

export async function decryptProfileRows(dataKey, rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const p of rows) {
    let customStatuses = null;
    if (p.custom_statuses) {
      try {
        const dec = await decryptField(dataKey, p.custom_statuses);
        customStatuses = JSON.parse(dec);
      } catch {
        customStatuses = null;
      }
    }
    out.push({
      ...p,
      name: await decryptField(dataKey, p.name),
      customStatuses: Array.isArray(customStatuses) ? customStatuses : null
    });
  }
  return out;
}

export function sanitizeProfileName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function buildProfileId(userId, name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';
  return `${userId}:${slug}:${Date.now().toString(36)}`;
}
