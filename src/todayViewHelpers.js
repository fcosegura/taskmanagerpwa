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
