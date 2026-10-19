const SESSION_COOKIE = '__Host-taskmanager_session';
const LOCAL_SESSION_COOKIE = 'taskmanager_session';
const SESSION_MAX_AGE_SEC = 3600;

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
}

function isLocalRequest(request) {
  const url = new URL(request.url);
  return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
}

export function sessionCookie(value, request) {
  if (isLocalRequest(request)) {
    return `${LOCAL_SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; HttpOnly; SameSite=Lax`;
  }
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie(request) {
  const localCookie = `${LOCAL_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  const secureCookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
  return isLocalRequest(request) ? localCookie : secureCookie;
}

export async function createOpaqueSession(env, userId) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, userId, expiresAt).run();
  return token;
}

export async function pruneExpiredSessions(env) {
  const now = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  } catch {
    // ignore
  }
}

export function getSessionTokenFromRequest(request) {
  return getCookie(request, SESSION_COOKIE) || getCookie(request, LOCAL_SESSION_COOKIE);
}

export function isValidSessionTokenFormat(token) {
  return typeof token === 'string' && /^[0-9a-f]{64}$/i.test(token);
}

const GOOGLE_ID_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export async function verifyGoogleToken(token, env) {
  if (!token || !env?.GOOGLE_CLIENT_ID || typeof env.GOOGLE_CLIENT_ID !== 'string' || !env.GOOGLE_CLIENT_ID.trim()) return null;
  // Only JWT-shaped values are Google ID tokens; opaque/other cookies must not hit Google.
  if (!GOOGLE_ID_TOKEN_PATTERN.test(token)) return null;
  const googleResp = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
  );
  const info = await googleResp.json();
  if (!googleResp.ok || info.error) return null;
  if (info.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) return null;
  if (!info.exp || Number(info.exp) * 1000 <= Date.now()) return null;
  return info.sub || null;
}

export async function authenticate(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  if (isValidSessionTokenFormat(token)) {
    const now = Math.floor(Date.now() / 1000);
    const row = await env.DB.prepare(
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?'
    ).bind(token, now).first();
    return row?.user_id || null;
  }
  return verifyGoogleToken(token, env);
}
