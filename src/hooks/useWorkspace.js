import { useState, useEffect } from 'react';
import { STATUS, normalizeStatuses } from '../constants.js';
import { loadData } from '../data/cloudSync.js';

import { ACTIVE_PROFILE_STORAGE_KEY } from '../data/localStore.js';

export function useWorkspace({ authVersion, onAuthenticated, showToast }) {
  const [hydration, setHydration] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [boardNotes, setBoardNotes] = useState([]);
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [hydratedSession, setHydratedSession] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || null);
  const [statuses, setStatuses] = useState(() => {
    try {
      const activeId = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || null;
      const key = activeId ? `taskmanager_custom_statuses_${activeId}` : 'taskmanager_custom_statuses';
      const stored = localStorage.getItem(key) || localStorage.getItem('taskmanager_custom_statuses');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return normalizeStatuses(parsed);
      }
    } catch {
      // ignore
    }
    return normalizeStatuses(STATUS);
  });
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
      const loadLocalStatuses = (profileId) => {
        const stored = localStorage.getItem(`taskmanager_custom_statuses_${profileId || 'default'}`) || localStorage.getItem('taskmanager_custom_statuses');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setStatuses(normalizeStatuses(parsed));
              return;
            }
          } catch {
            // ignore
          }
        }
        setStatuses(normalizeStatuses(STATUS));
      };

      if (Array.isArray(data.profiles) && data.profiles.length > 0) {
        setProfiles(data.profiles);
        const activeProfile = data.profiles.find((p) => p.id === resolvedId);
        if (activeProfile && Array.isArray(activeProfile.customStatuses)) {
          setStatuses(normalizeStatuses(activeProfile.customStatuses));
          localStorage.setItem(`taskmanager_custom_statuses_${activeProfile.id}`, JSON.stringify(activeProfile.customStatuses));
        } else {
          loadLocalStatuses(resolvedId);
        }
      } else {
        if (Array.isArray(data.profiles)) {
          setProfiles(data.profiles);
        }
        loadLocalStatuses(resolvedId);
      }
      if (data.activeProfileId && data.activeProfileId !== activeProfileId) {
        setActiveProfileId(data.activeProfileId);
        localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, data.activeProfileId);
      }
      onAuthenticated(data.authenticated);
      setHydratedSession(data.authenticated);
      if (data.cloudError) {
        showToast(`Sync D1: ${data.cloudError}`, { type: 'warning', duration: 5500 });
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [authVersion, activeProfileId, showToast, onAuthenticated]);

  return { hydration, tasks, setTasks, boardNotes, setBoardNotes, events, setEvents, ready, setReady, hydratedSession, setHydratedSession, profiles, setProfiles, activeProfileId, setActiveProfileId, statuses, setStatuses };
}
