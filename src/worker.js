import { importDataEncryptionKey } from './d1-field-crypto.js';
import { ensureNoteAiSchema, processNoteAiJob } from './noteAi/pipeline.js';
import { SECURITY_HEADERS, json } from './worker/http.js';
import { ensureSecuritySchema, ensureProfilesSchema } from './worker/schema.js';
import { authenticate } from './worker/auth.js';
import { resolveProfileId } from './worker/profiles.js';
import { handleAuthRoutes } from './worker/routes/auth.js';
import { handleNoteRoutes } from './worker/routes/notes.js';
import { handleTaskAiRoutes } from './worker/routes/taskAi.js';
import { handleProfileRoutes } from './worker/routes/profiles.js';
import { handleDataRoutes } from './worker/routes/data.js';

export default {
  // Worker Version: 2026.08.06.1
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (!env?.DB) {
        return json({ error: 'D1 binding missing: DB is not configured in this environment.' }, { status: 500 });
      }

      await ensureSecuritySchema(env);

      const authResponse = await handleAuthRoutes({ request, url, env });
      if (authResponse) return authResponse;

      const userId = await authenticate(request, env);
      if (!userId) return json({ error: 'No autorizado' }, { status: 401 });

      const path = url.pathname.replace('/api', '');
      
      try {
        if (request.method === 'GET' && path === '/session') {
          return json({ authenticated: true });
        }
        const taskSchema = await ensureProfilesSchema(env);
        await ensureNoteAiSchema(env);
        const dataKey = await importDataEncryptionKey(env.DATA_ENCRYPTION_KEY);
        if (!dataKey) {
          return json({ error: 'data_encryption_misconfigured' }, { status: 500 });
        }
        const requestedProfileId = url.searchParams.get('profileId');
        const profileId = await resolveProfileId(env, userId, requestedProfileId, dataKey);

        const context = { request, path, url, env, ctx, userId, profileId, dataKey, taskSchema };
        for (const handle of [handleNoteRoutes, handleTaskAiRoutes, handleProfileRoutes, handleDataRoutes]) {
          const response = await handle(context);
          if (response) return response;
        }
      } catch (err) {
        console.error('API error', path, err);
        return json({ error: 'internal_error' }, { status: 500 });
      }
    }

    // Modern Assets (2026): El Worker sirve los archivos de la carpeta assets configurada
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  },

  async queue(batch, env) {
    const dataKey = await importDataEncryptionKey(env.DATA_ENCRYPTION_KEY);
    if (!dataKey) {
      console.error('[noteAi] queue: encryption key missing');
      return;
    }
    await ensureNoteAiSchema(env);
    for (const message of batch.messages) {
      try {
        const job = message.body;
        await processNoteAiJob(env, dataKey, job);
        message.ack?.();
      } catch (err) {
        console.error('[noteAi] queue job failed', err?.message || err);
        message.retry?.();
      }
    }
  },
};
