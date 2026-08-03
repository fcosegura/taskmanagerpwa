export const STATUS_KINDS = [
  { value: 'backlog', label: 'Pendiente', isTerminal: false, canBeFocused: true, sortWeight: 50 },
  { value: 'active', label: 'Activo', isTerminal: false, canBeFocused: true, sortWeight: 100 },
  { value: 'waiting', label: 'Esperando', isTerminal: false, canBeFocused: false, sortWeight: 20 },
  { value: 'blocked', label: 'Bloqueado', isTerminal: false, canBeFocused: false, sortWeight: 10 },
  { value: 'done', label: 'Completado', isTerminal: true, canBeFocused: false, sortWeight: 0 },
];

const DEFAULT_KEYS = new Set(['not_done', 'in_progress', 'paused', 'blocked', 'done']);

const DEFAULT_STATUS_KIND_MAP = {
  not_done: 'backlog',
  in_progress: 'active',
  paused: 'waiting',
  blocked: 'blocked',
  done: 'done',
};

export function normalizeStatusDefinition(status) {
  if (!status || typeof status !== 'object') {
    return { ...STATUS[0] };
  }

  const v = status.v || 'not_done';
  const label = status.label || v;

  const isStandard = DEFAULT_KEYS.has(v);

  let kind;
  if (isStandard) {
    kind = DEFAULT_STATUS_KIND_MAP[v];
  } else {
    const isValidKind = STATUS_KINDS.some((k) => k.value === status.kind);
    kind = isValidKind ? status.kind : 'backlog';
  }

  const kindMeta = STATUS_KINDS.find((k) => k.value === kind) || STATUS_KINDS[0];

  if (isStandard) {
    return {
      ...status,
      v,
      label,
      kind,
      isTerminal: kindMeta.isTerminal,
      canBeFocused: kindMeta.canBeFocused,
      sortWeight: kindMeta.sortWeight,
    };
  }

  return {
    ...status,
    v,
    label,
    kind,
    isTerminal: typeof status.isTerminal === 'boolean' ? status.isTerminal : kindMeta.isTerminal,
    canBeFocused: typeof status.canBeFocused === 'boolean' ? status.canBeFocused : kindMeta.canBeFocused,
    sortWeight: typeof status.sortWeight === 'number' ? status.sortWeight : kindMeta.sortWeight,
  };
}

export function normalizeStatuses(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return STATUS.map(normalizeStatusDefinition);
  }
  return statuses.map(normalizeStatusDefinition);
}

export const STATUS = [
  { v: 'not_done', label: 'Sin iniciar', tv: '--color-text-primary', bv: '--color-background-secondary', bov: '--color-border-secondary', kind: 'backlog', isTerminal: false, canBeFocused: true, sortWeight: 50 },
  { v: 'in_progress', label: 'En progreso', tv: '--color-text-warning', bv: '--color-background-warning', bov: '--color-border-warning', kind: 'active', isTerminal: false, canBeFocused: true, sortWeight: 100 },
  { v: 'paused', label: 'En pausa', tv: '--color-text-primary', bv: '--color-background-secondary', bov: '--color-border-secondary', kind: 'waiting', isTerminal: false, canBeFocused: false, sortWeight: 20 },
  { v: 'blocked', label: 'Bloqueado', tv: '--color-text-danger', bv: '--color-background-danger', bov: '--color-border-danger', kind: 'blocked', isTerminal: false, canBeFocused: false, sortWeight: 10 },
  { v: 'done', label: 'Completado', tv: '--color-text-success', bv: '--color-background-success', bov: '--color-border-success', kind: 'done', isTerminal: true, canBeFocused: false, sortWeight: 0 },
];


/** Parent statuses that propagate to dependency (child) tasks. */
export const PARENT_CASCADE_STATUSES = new Set(['blocked', 'paused', 'done']);

export const PRIORITY = [
  { v: 'low', label: 'Baja', tv: '--color-text-primary', bv: '--color-background-secondary', bov: '--color-border-secondary' },
  { v: 'medium', label: 'Media', tv: '--color-text-info', bv: '--color-background-info', bov: '--color-border-info' },
  { v: 'high', label: 'Alta', tv: '--color-text-warning', bv: '--color-background-warning', bov: '--color-border-warning' },
  { v: 'critical', label: 'Crítica', tv: '--color-text-danger', bv: '--color-background-danger', bov: '--color-border-danger' },
];

export const P_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const STORAGE_KEY = 'taskmanager_v1';

export const EVENT_COLORS = ['#2563eb', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#4b5563'];
