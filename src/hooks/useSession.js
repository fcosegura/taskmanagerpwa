import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { loginWithGoogleCredential, logoutSession, checkSession } from '../api/auth.js';
import { ACTIVE_PROFILE_STORAGE_KEY } from '../data/localStore.js';

export function useSession({ onLogin, onSessionEnd, beforeLogout }) {
  const callbacks = useRef({ onLogin, onSessionEnd, beforeLogout });
  useLayoutEffect(() => { callbacks.current = { onLogin, onSessionEnd, beforeLogout }; });
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
    callbacks.current.onLogin();
    setAuthenticated(true);
    setAuthVersion((version) => version + 1);
  }, []);

  const logout = async () => {
    try {
      await callbacks.current.beforeLogout();
    } catch {
      // Best-effort flush before ending session.
    }
    await logoutSession();
    setAuthenticated(false);
    callbacks.current.onSessionEnd(false);
    try {
      localStorage.removeItem('taskmanager_session_expired');
    } catch {
      // ignore
    }
    localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
  };

  const forceLogout = useCallback(() => {
    try {
      localStorage.setItem('taskmanager_session_expired', '1');
    } catch {
      // ignore
    }
    setSessionExpiredLoggedOut(true);
    setAuthenticated(false);
    callbacks.current.onSessionEnd(true);
    // Keep ACTIVE_PROFILE_STORAGE_KEY so the last workspace can be restored on re-login.
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;
    let cancelled = false;
    const verifyActiveSession = async () => {
      try {
        const active = await checkSession();
        if (!cancelled && !active) {
          forceLogout();
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
  }, [authenticated, forceLogout]);

  return { authenticated, setAuthenticated, authVersion, setAuthVersion, sessionExpiredLoggedOut, login, logout };
}
