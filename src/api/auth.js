export async function loginWithGoogleCredential(credential) {
  const resp = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ credential }),
  });
  if (!resp.ok) throw new Error('No se pudo iniciar sesión.');
  return true;
}

export async function logoutSession() {
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

export async function checkSession() {
  const resp = await fetch('/api/session', { credentials: 'same-origin' });
  // Only 401 means the session is gone; any other failure is transient and must
  // not log the user out.
  if (resp.status === 401) return false;
  if (!resp.ok) throw new Error(`Session check failed (${resp.status})`);
  return true;
}
