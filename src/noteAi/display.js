// Vista derivada (cliente) de la metadata Note AI de una nota, respetando prefs y
// sugerencias descartadas. Compartida por la tarjeta del tablero y el modal de nota extendida.

export function isNoteAiSuggestionDismissed(meta, kind, value) {
  const key = `${kind}:${value}`;
  return Array.isArray(meta?.dismissed) && meta.dismissed.includes(key);
}

export function buildNoteAiDisplay(meta, prefs) {
  const tags = prefs?.autotag !== false
    ? (meta?.tags || []).filter((t) => !isNoteAiSuggestionDismissed(meta, 'tag', t))
    : [];
  const summary = prefs?.summary !== false ? (meta?.summary || '') : '';
  const classification = prefs?.classification !== false ? (meta?.classification || null) : null;
  const taskSuggestions = prefs?.taskSuggestions !== false
    ? (meta?.taskSuggestions || []).filter((t) => !isNoteAiSuggestionDismissed(meta, 'task', t))
    : [];
  const entities = prefs?.entities !== false ? meta?.entities : null;
  const entityChips = entities
    ? [
        ...(entities.tickets || []).map((v) => ({ kind: 'ticket', v })),
        ...(entities.urls || []).slice(0, 2).map((v) => ({ kind: 'url', v })),
        ...(entities.people || []).slice(0, 2).map((v) => ({ kind: 'person', v })),
      ].filter((e) => !isNoteAiSuggestionDismissed(meta, e.kind, e.v))
    : [];
  return {
    tags,
    summary,
    classification,
    taskSuggestions,
    entityChips,
    pending: meta?.status === 'pending',
  };
}
