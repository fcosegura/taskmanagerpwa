export const TRANSIENT_READ_STATUSES = new Set([502, 503, 504]);
const CLOUD_READ_MAX_ATTEMPTS = 3;
const CLOUD_READ_RETRY_BASE_DELAY_MS = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET idempotentes contra la nube: reintenta errores transitorios (502/503/504)
 * antes de rendirse, para no alarmar al usuario por caídas momentáneas de D1.
 */
export async function fetchCloudReadWithRetry(url, init = {}, retry = {}) {
  const attempts = Number.isFinite(retry.attempts) ? retry.attempts : CLOUD_READ_MAX_ATTEMPTS;
  const baseDelayMs = Number.isFinite(retry.baseDelayMs) ? retry.baseDelayMs : CLOUD_READ_RETRY_BASE_DELAY_MS;
  const wait = typeof retry.wait === 'function' ? retry.wait : delay;
  const fetchImpl = typeof retry.fetchImpl === 'function' ? retry.fetchImpl : fetch;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const resp = await fetchImpl(url, init);
      if (!TRANSIENT_READ_STATUSES.has(resp?.status) || attempt === attempts) {
        return resp;
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
    await wait(baseDelayMs * attempt);
  }

  if (lastError) throw lastError;
  throw new Error('Cloud read failed');
}
