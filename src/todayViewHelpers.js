export function normalizeTaskUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export function formatTaskUrlLabel(url) {
  const href = normalizeTaskUrl(url);
  if (!href) return '';
  try {
    const parsed = new URL(href);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return href.length > 36 ? `${href.slice(0, 36)}…` : href;
  }
}

export function getDisplayDescription(task) {
  if (!task) return '';
  const rawDesc = task.notes || task.description;
  if (!rawDesc || typeof rawDesc !== 'string') return '';
  const trimmed = rawDesc.trim();
  if (!trimmed) return '';

  const isTechnicalToken =
    trimmed.startsWith('v1.') ||
    trimmed.startsWith('eyJ') ||
    (trimmed.length > 30 && !trimmed.includes(' '));

  if (isTechnicalToken) return '';
  return trimmed;
}
