import { useState, useEffect, useCallback } from 'react';
import { loginWithGoogleCredential, logoutSession, checkSession } from '../api/auth.js';
import { ACTIVE_PROFILE_STORAGE_KEY } from '../data/localStore.js';

export function useSession() {
  const [authenticated, setAuthenticated] = useState(null);
  const [authVersion, setAuthVersion] = useState(0);
  const [sessionExpiredLoggedOut, setSessionExpiredLoggedOut] = useState(() => {
    try {
      return localStorage.getItem('taskmanager_session_expired') === '1';
    } catch {
      return false;
    }
  });

  const login = useCallback(async (credential) => {
    await loginWithGoogleCredential(credential);
    try {
      localStorage.removeItem('taskmanager_session_expired');
    } catch {
      // ignore
    }
    setSessionExpiredLoggedOut(false);
    setAuthenticated(true);
    setAuthVersion((version) => version + 1);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } catch {
      // Best-effort: the local logout must happen even offline.
    }
    setAuthenticated(false);
    try {
      localStorage.removeItem('taskmanager_session_expired');
      localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const expireSession = useCallback(() => {
    try {
      localStorage.setItem('taskmanager_session_expired', '1');
    } catch {
      // ignore
    }
    setSessionExpiredLoggedOut(true);
    setAuthenticated(false);
    // Keep ACTIVE_PROFILE_STORAGE_KEY so the last workspace can be restored on re-login.
  }, []);


  // setAuthenticated is only handed to useWorkspace, which reports the session
  // state observed while loading the workspace.
  return { authenticated, setAuthenticated, authVersion, sessionExpiredLoggedOut, login, logout, expireSession };
}

// Called after App has initialized its UI state, so expiration can clear both
// auth and interface state directly in the asynchronous session-check callback.
export function useSessionLiveness(authenticated, onExpired) {
  useEffect(() => {
    if (!authenticated) return undefined;
    let cancelled = false;
    const verifyActiveSession = async () => {
      try {
        const active = await checkSession();
        if (!cancelled && !active) {
          onExpired();
        }
      } catch {
        // Ignore transient network errors and keep current session state.
      }
    };
    const intervalId = window.setInterval(verifyActiveSession, 60000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') verifyActiveSession();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    verifyActiveSession();
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authenticated, onExpired]);

}
