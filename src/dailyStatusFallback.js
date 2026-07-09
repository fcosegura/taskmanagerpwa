import { STATUS } from './constants.js';
import { partitionDailyStatusActivities } from './dailyStatusActivities.js';

function getStoredStatuses() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem('taskmanager_custom_statuses');
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return STATUS;
}

function label(status) {
  const currentStatuses = getStoredStatuses();
  const match = currentStatuses.find((s) => s.v === status);
  return match ? match.label : status;
}

function formatActivityLines(item) {
  const lines = [];
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
  return lines;
}

export function buildDailyStatusFallbackReport(activities, days) {
  const list = Array.isArray(activities) ? activities : [];
  if (list.length === 0) {
    return `Daily status (${days} día(s)): sin actividad registrada en el periodo.`;
  }

  const { doneInPeriod, activeNow, blocked } = partitionDailyStatusActivities(list);
  const lines = [`Daily status (${days} día(s)) — resumen automático`, ''];

  lines.push('## Hecho');
  if (doneInPeriod.length === 0) {
    lines.push('Ninguno.');
  } else {
    doneInPeriod.forEach((item) => {
      lines.push(...formatActivityLines(item));
      lines.push('');
    });
  }

  lines.push('## Hoy / En curso');
  if (activeNow.length === 0) {
    lines.push('Ninguno.');
  } else {
    activeNow.forEach((item) => {
      lines.push(...formatActivityLines(item));
      lines.push('');
    });
  }

  lines.push('## Bloqueadores');
  if (blocked.length === 0) {
    lines.push('Ninguno.');
  } else {
    blocked.forEach((item) => {
      lines.push(...formatActivityLines(item));
      lines.push('');
    });
  }

  return lines.join('\n').trim();
}
