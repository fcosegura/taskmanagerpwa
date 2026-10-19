import { json } from '../http.js';
import { verifyGoogleToken, pruneExpiredSessions, createOpaqueSession, sessionCookie,
  getSessionTokenFromRequest, isValidSessionTokenFormat, clearSessionCookie } from '../auth.js';
import { pruneStaleRateLimits } from '../rateLimits.js';

export async function handleAuthRoutes({ request, url, env }) {
  if (request.method === 'POST' && url.pathname === '/api/login') {
    try {
      const { credential } = await request.json();
      const userId = await verifyGoogleToken(credential, env);
      if (!userId) return json({ error: 'Token inválido' }, { status: 401 });
      await pruneExpiredSessions(env);
      await pruneStaleRateLimits(env);
      const sessionToken = await createOpaqueSession(env, userId);
      return json(
        { success: true },
        { headers: { 'Set-Cookie': sessionCookie(sessionToken, request) } }
      );
    } catch {
      return json({ error: 'Login inválido' }, { status: 400 });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    const token = getSessionTokenFromRequest(request);
    if (token && isValidSessionTokenFormat(token)) {
      try {
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      } catch {
        // ignore
      }
    }
    return json(
      { success: true },
      { headers: { 'Set-Cookie': clearSessionCookie(request) } }
    );
  }
  return null;
}
