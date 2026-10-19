import { normalizeStatuses } from '../constants.js';
import { normalizeDataPayload } from './normalize.js';
import { readLocalPayload, writeLocalPayload, hasAnyData } from './localStore.js';
import { clonePayload, buildIncrementalOps, hasAnyOps } from './syncOps.js';
import { fetchCloudReadWithRetry, TRANSIENT_READ_STATUSES } from '../api/cloudRead.js';

const lastCloudSnapshotByProfile = new Map();

export async function fetchWorkspaceData(profileId) {
  if (!profileId) throw new Error('profileId es requerido para fetchWorkspaceData.');
  const resp = await fetchCloudReadWithRetry(`/api/data?profileId=${encodeURIComponent(profileId)}`, { credentials: 'same-origin' });
  if (!resp.ok) {
    throw new Error(`No se pudo leer el workspace (${resp.status}).`);
  }
  const cloudData = await resp.json();
  const data = normalizeDataPayload(cloudData);
  // Los estados custom viven en el perfil dentro de cloudData.profiles, no en el payload de tareas.
  const profile = Array.isArray(cloudData?.profiles)
    ? cloudData.profiles.find((p) => p && p.id === profileId)
    : null;
  const customStatuses = Array.isArray(profile?.customStatuses) && profile.customStatuses.length > 0
    ? normalizeStatuses(profile.customStatuses)
    : undefined;
  return {
    tasks: data.tasks,
    boardNotes: data.boardNotes,
    events: data.events,
    ...(customStatuses ? { customStatuses } : {}),
  };
}

export async function loadData(profileId = null) {
  const localData = readLocalPayload(profileId);

  try {
    const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    const resp = await fetchCloudReadWithRetry(`/api/data${query}`, { credentials: 'same-origin' });
    if (resp.ok) {
      const cloudData = await resp.json();
      const safeCloudData = normalizeDataPayload(cloudData);
      const resolvedProfileId = typeof cloudData.activeProfileId === 'string' ? cloudData.activeProfileId : profileId;
      // Preserve local data whenever the cloud copy is empty/invalid, even for an
      // explicit profile, to avoid wiping unsynced local changes with an empty cloud.
      const localHasData = hasAnyData(localData);
      const cloudHasData = hasAnyData(safeCloudData);
      const shouldPreferLocal = localHasData && !cloudHasData;
      const effectiveData = shouldPreferLocal ? localData : safeCloudData;
      if (resolvedProfileId) {
        // When local wins over an empty cloud, record the real (empty) cloud snapshot
        // so the next saveData pushes local up instead of treating it as synced.
        lastCloudSnapshotByProfile.set(
          resolvedProfileId,
          clonePayload(shouldPreferLocal ? safeCloudData : effectiveData)
        );
      }
      // Prefer local when cloud comes back empty, to avoid data loss on transient sync failures.
      writeLocalPayload(effectiveData, resolvedProfileId);
      return {
        ...effectiveData,
        authenticated: true,
        profiles: Array.isArray(cloudData.profiles) ? cloudData.profiles : [],
        activeProfileId: resolvedProfileId || null,
        preferredLocal: shouldPreferLocal,
      };
    }
    if (resp.status === 401) return { ...localData, authenticated: false, profiles: [], activeProfileId: profileId };
    // Sin backend real (p. ej. solo Vite): no fingir sesión en la nube.
    if (resp.status === 404 || resp.status === 405) {
      return { ...localData, authenticated: false, profiles: [], activeProfileId: profileId, cloudError: null };
    }
    console.warn("La nube respondió con error, manteniendo la sesión local:", resp.status);
    let cloudError = `Cloud sync read failed (${resp.status})`;
    try {
      const data = await resp.json();
      if (typeof data?.error === 'string') cloudError = data.error;
    } catch {
      // ignore non-json body
    }
    if (cloudError === `Cloud sync read failed (${resp.status})` && TRANSIENT_READ_STATUSES.has(resp.status)) {
      cloudError = 'la nube no está disponible temporalmente. Sigues trabajando en local y se reintentará automáticamente.';
    }
    return { ...localData, authenticated: true, profiles: null, activeProfileId: profileId, cloudError };
  } catch (e) {
    console.warn("Error sincronizando con la nube:", e);
  }

  return { ...localData, authenticated: false, profiles: null, activeProfileId: profileId, cloudError: null };
}

export async function saveData(payload, authenticated = false, profileId = null) {
  // 1. Guardar local siempre
  try {
    writeLocalPayload(payload, profileId);
  } catch {
    // El guardado local puede fallar por cuota o modo privado; la nube sigue siendo el respaldo.
  }

  // 2. Si hay sesión, sincronizar con la nube usando cookie HttpOnly
  if (authenticated) {
    if (!profileId) {
      // Never sync to cloud without an explicit profile id in multi-workspace mode.
      return;
    }
    try {
      const previousSnapshot = lastCloudSnapshotByProfile.get(profileId) || null;
      const ops = previousSnapshot ? buildIncrementalOps(previousSnapshot, payload) : null;
      const requestBody = (ops && hasAnyOps(ops))
        ? { profileId, ops }
        : { profileId, payload };
      const resp = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(requestBody)
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        let message = text || `Sync HTTP ${resp.status}`;
        try {
          const data = JSON.parse(text);
          if (typeof data?.error === 'string') message = data.error;
        } catch {
          // keep text body
        }
        if (resp.status === 413) {
          message = message.includes('Límite') ? message : 'Los datos superan el límite permitido por el servidor.';
        }
        if (resp.status === 500 && (message === 'internal_error' || message.includes('internal_error'))) {
          message = 'Error del servidor al guardar. Inténtalo de nuevo más tarde.';
        }
        throw new Error(message || `Sync HTTP ${resp.status}`);
      }
      lastCloudSnapshotByProfile.set(profileId, clonePayload(payload));
    } catch (e) {
      console.warn("Error guardando en la nube:", e);
      throw e;
    }
  }
}
