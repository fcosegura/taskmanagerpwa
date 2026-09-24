/**
 * Resolves the display metadata for a task status.
 *
 * Uses the normalized status map when the status exists; otherwise falls back
 * to a formatted label and the info theme so orphan/imported statuses still
 * render a pill consistently across views (Hoy and Modo rápido).
 */
export function getStatusInfo(statusKey, statusMap) {
  if (!statusKey) return null;
  if (statusMap && statusMap[statusKey]) return statusMap[statusKey];
  const formattedLabel = statusKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return {
    v: statusKey,
    label: formattedLabel,
    tv: '--color-text-info',
    bv: '--color-background-info',
    bov: '--color-border-info',
  };
}
