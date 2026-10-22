export async function shortHashForLog(value) {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    const bytes = new Uint8Array(digest);
    return [...bytes.slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'unknown';
  }
}
