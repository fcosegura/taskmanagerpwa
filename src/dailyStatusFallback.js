import { STATUS } from './constants.js';

const STATUS_LABEL = Object.fromEntries(STATUS.map((s) => [s.v, s.label]));

function label(status) {
  return STATUS_LABEL[status] || status;
}

export function buildDailyStatusFallbackReport(activities, days) {
  const list = Array.isArray(activities) ? activities : [];
  if (list.length === 0) {
    return `Daily status (${days} día(s)): sin actividad registrada en el periodo.`;
  }

  const lines = [`Daily status (${days} día(s)) — resumen automático`, ''];

  list.forEach((item) => {
    const header = item.ticketNumber
      ? `[${item.ticketNumber}] ${item.name}`
      : item.name;
    lines.push(`• ${header} (${label(item.currentStatus)})`);
    if (item.createdInWindow && item.createdAt) {
      lines.push('  - Creada en el periodo');
    }
    (item.statusChanges || []).forEach((change) => {
      const from = change.fromStatus ? label(change.fromStatus) : '—';
      lines.push(`  - ${from} → ${label(change.toStatus)}: ${change.comment}`);
    });
    if (item.completedInWindow) {
      lines.push('  - Completada en el periodo');
    }
    if (item.notes) {
      lines.push(`  - Notas: ${item.notes.slice(0, 200)}${item.notes.length > 200 ? '…' : ''}`);
    }
    lines.push('');
  });

  const blocked = list.filter((a) => a.currentStatus === 'blocked');
  if (blocked.length > 0) {
    lines.push('Bloqueadores:', ...blocked.map((a) => `- ${a.name}`));
  }

  return lines.join('\n').trim();
}
