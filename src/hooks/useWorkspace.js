import { useState, useEffect, useCallback } from 'react';
import { STATUS, normalizeStatuses } from '../constants.js';
import { loadData } from '../data/cloudSync.js';

import { ACTIVE_PROFILE_STORAGE_KEY, readLocalCustomStatuses, writeLocalCustomStatuses } from '../data/localStore.js';

function persistActiveProfileId(profileId) {
  try {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
  } catch {
    // ignore
  }
}

export function useWorkspace({ authVersion, onAuthenticated, showToast }) {
  const [hydration, setHydration] = useState(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [boardNotes, setBoardNotes] = useState([]);
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [hydratedSession, setHydratedSession] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || null);
  const [statuses, setStatuses] = useState(() => normalizeStatuses(
    readLocalCustomStatuses(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || null) || STATUS
  ));
  useEffect(() => {
    let cancelled = false;
    loadData(activeProfileId).then((data) => {
      if (cancelled) return;
      setTasks(data.tasks);
      setBoardNotes(data.boardNotes);
      setEvents(data.events || []);
      const loadedPayload = {
        tasks: data.tasks,
        boardNotes: data.boardNotes,
        events: data.events || []
      };
      setHydration({ payload: loadedPayload, preferredLocal: data.preferredLocal === true });
      const resolvedId = data.activeProfileId || activeProfileId;

      if (Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
      }
      const activeProfile = Array.isArray(data.profiles)
        ? data.profiles.find((p) => p.id === resolvedId)
        : null;
      if (activeProfile && Array.isArray(activeProfile.customStatuses)) {
        setStatuses(normalizeStatuses(activeProfile.customStatuses));
        writeLocalCustomStatuses(activeProfile.id, activeProfile.customStatuses);
      } else {
        setStatuses(normalizeStatuses(readLocalCustomStatuses(resolvedId) || STATUS));
      }
      if (data.activeProfileId && data.activeProfileId !== activeProfileId) {
        setActiveProfileId(data.activeProfileId);
        persistActiveProfileId(data.activeProfileId);
      }
      onAuthenticated(data.authenticated);
      setHydratedSession(data.authenticated);
      if (data.cloudError) {
        showToast(`Sync D1: ${data.cloudError}`, { type: 'warning', duration: 5500 });
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [authVersion, reloadVersion, activeProfileId, showToast, onAuthenticated]);

  const clearWorkspaceData = useCallback(() => {
    setReady(false);
    setTasks([]);
    setBoardNotes([]);
    setEvents([]);
  }, []);

  /** Drops every piece of workspace state at the end of a session. */
  const resetWorkspace = useCallback(() => {
    clearWorkspaceData();
    setHydratedSession(null);
    setProfiles([]);
    setActiveProfileId(null);
  }, [clearWorkspaceData]);

  /** Activates another workspace; its data is loaded by the effect above. */
  const switchProfile = useCallback((profileId) => {
    if (!profileId || profileId === activeProfileId) return false;
    clearWorkspaceData();
    setActiveProfileId(profileId);
    persistActiveProfileId(profileId);
    return true;
  }, [activeProfileId, clearWorkspaceData]);

  /** Marks the workspace as loading until the next load completes. */
  const invalidateWorkspace = useCallback(() => setReady(false), []);

  /** Reloads the active workspace from the cloud (e.g. after an import). */
  const reloadWorkspace = useCallback(() => {
    setReady(false);
    setReloadVersion((version) => version + 1);
  }, []);

  /** Updates the active workspace statuses and their local cache. */
  const saveStatuses = useCallback((nextStatuses, profileId = activeProfileId) => {
    setStatuses(nextStatuses);
    writeLocalCustomStatuses(profileId, nextStatuses);
  }, [activeProfileId]);

  return {
    hydration, tasks, setTasks, boardNotes, setBoardNotes, events, setEvents, ready, hydratedSession,
    profiles, setProfiles, activeProfileId, statuses,
    resetWorkspace, switchProfile, invalidateWorkspace, reloadWorkspace, saveStatuses,
  };
}
