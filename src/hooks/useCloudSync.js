import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { saveData } from '../data/cloudSync.js';

function serializePayload(payload) {
  try {
    return JSON.stringify(payload);
  } catch {
    return '';
  }
}

export function useCloudSync({ tasks, boardNotes, events, ready, authenticated, hydratedSession, activeProfileId, hydration }) {
  const [syncState, setSyncState] = useState('idle');
  const lastHydrationRef = useRef(null);
  const syncFeedbackTimerRef = useRef(null);
  const syncDebounceTimerRef = useRef(null);
  const lastSyncedPayloadRef = useRef('');
  const latestPayloadRef = useRef({ tasks: [], boardNotes: [], events: [] });
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const syncNowRef = useRef(async () => false);
  const isOnlineRef = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [reconnecting, setReconnecting] = useState(false);
  useLayoutEffect(() => {
    if (!hydration || hydration === lastHydrationRef.current) return;
    lastHydrationRef.current = hydration;
    latestPayloadRef.current = hydration.payload;
    lastSyncedPayloadRef.current = hydration.preferredLocal ? '' : serializePayload(hydration.payload);
  }, [hydration]);

  const clearSyncDebounce = useCallback(() => {
    if (syncDebounceTimerRef.current) {
      window.clearTimeout(syncDebounceTimerRef.current);
      syncDebounceTimerRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    syncNowRef.current = async ({ immediate = false } = {}) => {
      if (!ready || !authenticated || hydratedSession !== authenticated || !activeProfileId) return false;
      const payload = latestPayloadRef.current;
      const serialized = serializePayload(payload);
      if (!serialized || serialized === lastSyncedPayloadRef.current) return false;

      if (syncInFlightRef.current) {
        pendingSyncRef.current = true;
        return false;
      }

      if (immediate) clearSyncDebounce();

      syncInFlightRef.current = true;
      setSyncState('saving');
      try {
        await saveData(payload, authenticated, activeProfileId);
        lastSyncedPayloadRef.current = serialized;
        setSyncState('saved');
        if (syncFeedbackTimerRef.current) window.clearTimeout(syncFeedbackTimerRef.current);
        syncFeedbackTimerRef.current = window.setTimeout(() => setSyncState('idle'), 1600);
        return true;
      } catch {
        setSyncState(isOnlineRef.current ? 'error' : 'offline');
        return false;
      } finally {
        syncInFlightRef.current = false;
        if (pendingSyncRef.current) {
          pendingSyncRef.current = false;
          void syncNowRef.current({ immediate: true });
        }
      }
    };
  }, [ready, authenticated, hydratedSession, activeProfileId, clearSyncDebounce]);

  useEffect(() => {
    const onOnline = () => {
      isOnlineRef.current = true;
      setIsOnline(true);
      // Only show "Reconectando" if there is actually pending data to flush.
      // We compare against lastSyncedPayloadRef but guard against the case where
      // lastSyncedPayloadRef is still empty (first load) so we don't get stuck.
      const currentSerialized = serializePayload(latestPayloadRef.current);
      const hasPending =
        currentSerialized !== '' &&
        currentSerialized !== lastSyncedPayloadRef.current;
      if (hasPending) {
        setReconnecting(true);
        void syncNowRef.current({ immediate: true })
          .then(() => setReconnecting(false))
          .catch(() => setReconnecting(false))
          .finally(() => setReconnecting(false));
      }
    };
    const onOffline = () => {
      isOnlineRef.current = false;
      setIsOnline(false);
      setReconnecting(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    latestPayloadRef.current = { tasks, boardNotes, events };
    if (!ready || !authenticated || hydratedSession !== authenticated || !activeProfileId) return undefined;
    clearSyncDebounce();
    syncDebounceTimerRef.current = window.setTimeout(() => {
      void syncNowRef.current();
    }, 2000);
    return () => clearSyncDebounce();
  }, [tasks, boardNotes, events, ready, authenticated, hydratedSession, activeProfileId, clearSyncDebounce]);

  useEffect(() => {
    if (!authenticated) return undefined;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void syncNowRef.current({ immediate: true });
      }
    };
    const onBeforeUnload = () => {
      void syncNowRef.current({ immediate: true });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [authenticated]);

  useEffect(() => () => {
    if (syncFeedbackTimerRef.current) window.clearTimeout(syncFeedbackTimerRef.current);
    clearSyncDebounce();
  }, [clearSyncDebounce]);

  const syncNow = useCallback((options) => syncNowRef.current(options), []);

  /** Clears pending sync work and feedback at the end of a session. */
  const resetSync = useCallback(() => {
    clearSyncDebounce();
    if (syncFeedbackTimerRef.current) {
      window.clearTimeout(syncFeedbackTimerRef.current);
      syncFeedbackTimerRef.current = null;
    }
    pendingSyncRef.current = false;
    setSyncState('idle');
  }, [clearSyncDebounce]);

  return { syncState, isOnline, reconnecting, syncNow, resetSync };
}
