import { json } from '../http.js';
import { consumeAiRateLimit } from '../rateLimits.js';
import { buildDailyStatusFallbackReport } from '../../dailyStatusFallback.js';
import {
  parseTaskFallback, parseTaskWithAi, sanitizeParsedTask,
  generateTasksFromTextWithAi, normalizeGeneratedTaskPlan, clampDailyStatusDaysInput,
  sanitizeDailyStatusActivities, generateDailyStatusWithAi,
} from '../taskAi.js';

export async function handleTaskAiRoutes({ request, path, env, userId }) {
  if (request.method === 'POST' && path === '/ai/parse-task') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido' }, { status: 400 });
    }
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return json({ error: 'text es requerido' }, { status: 400 });
    if (text.length > 500) return json({ error: 'text demasiado largo (max 500)' }, { status: 400 });

    const rateLimited = await consumeAiRateLimit(env, userId);
    if (rateLimited) return rateLimited;

    const fallback = parseTaskFallback(text);
    try {
      const aiParsed = await parseTaskWithAi(text, env);
      if (!aiParsed) return json({ task: fallback, source: 'fallback' });
      return json({ task: sanitizeParsedTask(aiParsed, text), source: 'ai' });
    } catch {
      return json({ task: fallback, source: 'fallback' });
    }
  }

  if (request.method === 'POST' && path === '/ai/generate-tasks') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido' }, { status: 400 });
    }
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return json({ error: 'text es requerido' }, { status: 400 });
    if (text.length > 700) return json({ error: 'text demasiado largo (max 700)' }, { status: 400 });

    const rateLimited = await consumeAiRateLimit(env, userId);
    if (rateLimited) return rateLimited;

    const fallbackPlan = normalizeGeneratedTaskPlan(null, text);

    try {
      const aiPlan = await generateTasksFromTextWithAi(text, env);
      if (!aiPlan) {
        return json({
          mainTasks: fallbackPlan.mainTasks,
          childTasks: fallbackPlan.childTasks,
          source: 'fallback'
        });
      }
      const normalized = normalizeGeneratedTaskPlan(aiPlan, text);
      return json({
        mainTasks: normalized.mainTasks,
        childTasks: normalized.childTasks,
        source: 'ai'
      });
    } catch {
      return json({
        mainTasks: fallbackPlan.mainTasks,
        childTasks: fallbackPlan.childTasks,
        source: 'fallback'
      });
    }
  }

  if (request.method === 'POST' && path === '/ai/daily-status') {
    let body = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido' }, { status: 400 });
    }
    const days = clampDailyStatusDaysInput(body?.days);
    const activities = sanitizeDailyStatusActivities(body?.activities);
    if (activities.length === 0) {
      return json({ error: 'No hay actividad para generar el daily status.' }, { status: 400 });
    }

    const rateLimited = await consumeAiRateLimit(env, userId);
    if (rateLimited) return rateLimited;

    const fallbackReport = buildDailyStatusFallbackReport(activities, days);
    try {
      const aiReport = await generateDailyStatusWithAi(days, activities, env);
      if (!aiReport) return json({ report: fallbackReport, source: 'fallback' });
      return json({ report: aiReport.slice(0, 8000), source: 'ai' });
    } catch {
      return json({ report: fallbackReport, source: 'fallback' });
    }
  }
  return null;
}
