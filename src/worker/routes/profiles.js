import { json } from '../http.js';
import { encryptField } from '../../d1-field-crypto.js';
import { sanitizeProfileName, buildProfileId, decryptProfileRows } from '../profiles.js';

export async function handleProfileRoutes({ request, path, env, userId, dataKey }) {
  if (request.method === 'POST' && path === '/profiles') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }
    const name = sanitizeProfileName(body?.name);
    if (!name) return json({ error: 'Nombre de perfil inválido' }, { status: 400 });
    const newProfile = { id: buildProfileId(userId, name), name };
    const nameEnc = await encryptField(dataKey, newProfile.name);
    await env.DB.prepare(
      "INSERT INTO profiles (id, user_id, name) VALUES (?, ?, ?)"
    ).bind(newProfile.id, userId, nameEnc).run();
    return json({ profile: newProfile });
  }

  if (request.method === 'POST' && path === '/profiles/delete') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }
    const targetProfileId = typeof body?.profileId === 'string' ? body.profileId : '';
    if (!targetProfileId) return json({ error: 'profileId inválido' }, { status: 400 });

    const { results: userProfiles } = await env.DB.prepare(
      "SELECT id, name, created_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
    ).bind(userId).all();

    const existing = userProfiles.find((p) => p.id === targetProfileId);
    if (!existing) {
      const { results: currentProfiles } = await env.DB.prepare(
        "SELECT id, name, custom_statuses, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
      ).bind(userId).all();
      const fallbackProfileId = currentProfiles[0]?.id || null;
      const profilesOut = await decryptProfileRows(dataKey, currentProfiles);
      return json({ error: 'El workspace no existe.', profiles: profilesOut, activeProfileId: fallbackProfileId }, { status: 404 });
    }
    if (userProfiles.length <= 1) {
      return json({ error: 'No puedes borrar el único workspace.' }, { status: 400 });
    }

    await env.DB.batch([
      env.DB.prepare("DELETE FROM tasks WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
      env.DB.prepare("DELETE FROM notes WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
      env.DB.prepare("DELETE FROM events WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
      env.DB.prepare("DELETE FROM note_ai_meta WHERE user_id = ? AND profile_id = ?").bind(userId, targetProfileId),
      env.DB.prepare("DELETE FROM profiles WHERE user_id = ? AND id = ?").bind(userId, targetProfileId)
    ]);

    const { results: remainingProfiles } = await env.DB.prepare(
      "SELECT id, name, custom_statuses, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
    ).bind(userId).all();

    const fallbackProfileId = remainingProfiles[0]?.id || null;
    const remainingOut = await decryptProfileRows(dataKey, remainingProfiles);
    return json({ success: true, profiles: remainingOut, activeProfileId: fallbackProfileId });
  }

  if (request.method === 'POST' && path === '/profiles/update') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_body' }, { status: 400 });
    }
    const targetProfileId = typeof body?.profileId === 'string' ? body.profileId : '';
    if (!targetProfileId) return json({ error: 'profileId inválido' }, { status: 400 });

    // check if profile belongs to user
    const { results: userProfiles } = await env.DB.prepare(
      "SELECT id FROM profiles WHERE user_id = ? AND id = ?"
    ).bind(userId, targetProfileId).all();

    if (!userProfiles || userProfiles.length === 0) {
      return json({ error: 'Workspace no encontrado.' }, { status: 404 });
    }

    const customStatuses = body?.customStatuses;
    if (customStatuses !== undefined) {
      if (customStatuses !== null && !Array.isArray(customStatuses)) {
        return json({ error: 'customStatuses debe ser un array o nulo.' }, { status: 400 });
      }
      const serialized = customStatuses ? JSON.stringify(customStatuses) : '';
      const encStatuses = serialized ? await encryptField(dataKey, serialized) : null;
      await env.DB.prepare(
        "UPDATE profiles SET custom_statuses = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ?"
      ).bind(encStatuses, userId, targetProfileId).run();
    }

    const { results: remainingProfiles } = await env.DB.prepare(
      "SELECT id, name, custom_statuses, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY created_at ASC"
    ).bind(userId).all();

    const remainingOut = await decryptProfileRows(dataKey, remainingProfiles);
    return json({ success: true, profiles: remainingOut });
  }
  return null;
}
