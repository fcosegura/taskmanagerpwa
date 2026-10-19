export async function createProfile(name) {
  const resp = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) throw new Error('No se pudo crear el perfil.');
  const data = await resp.json();
  return data.profile;
}

export async function deleteProfile(profileId) {
  const resp = await fetch('/api/profiles/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ profileId }),
  });
  if (!resp.ok) {
    let message = 'No se pudo borrar el perfil.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // Keep generic fallback.
    }
    throw new Error(message);
  }
  return resp.json();
}

export async function updateProfileStatuses(profileId, customStatuses) {
  const resp = await fetch('/api/profiles/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ profileId, customStatuses }),
  });
  if (!resp.ok) {
    let message = 'No se pudo actualizar los estados del workspace.';
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return resp.json();
}
