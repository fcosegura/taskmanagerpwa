import { useEffect, useMemo, useRef, useState } from 'react';

function isDismissed(meta, kind, value) {
  const key = `${kind}:${value}`;
  return Array.isArray(meta?.dismissed) && meta.dismissed.includes(key);
}

function BoardNoteCard({
  note,
  meta,
  prefs,
  selected,
  onSelect,
  onDelete,
  onUpdate,
  onConvertToTask,
  onConvertSuggestion,
  onDismissSuggestion,
  onDragHandlePointerDown,
  isDragging,
  noteWidth,
}) {
  const tags = prefs?.autotag !== false ? (meta?.tags || []).filter((t) => !isDismissed(meta, 'tag', t)) : [];
  const summary = prefs?.summary !== false ? (meta?.summary || '') : '';
  const classification = prefs?.classification !== false ? meta?.classification : null;
  const taskSuggestions = prefs?.taskSuggestions !== false
    ? (meta?.taskSuggestions || []).filter((t) => !isDismissed(meta, 'task', t))
    : [];
  const entities = prefs?.entities !== false ? meta?.entities : null;
  const entityChips = entities
    ? [
        ...(entities.tickets || []).map((v) => ({ kind: 'ticket', v })),
        ...(entities.urls || []).slice(0, 2).map((v) => ({ kind: 'url', v })),
        ...(entities.people || []).slice(0, 2).map((v) => ({ kind: 'person', v })),
      ].filter((e) => !isDismissed(meta, e.kind, e.v))
    : [];

  return (
    <div
      className={`board-note material-elevated${selected ? ' board-note--selected' : ''}`}
      onClick={() => onSelect?.(note.id)}
      style={{
        position: 'absolute', left: note.x ?? 0, top: note.y ?? 0,
        zIndex: isDragging ? 50 : (selected ? 20 : 10),
        cursor: 'default',
        borderRadius: 'var(--border-radius-lg)',
        padding: 14,
        minHeight: 180,
        width: noteWidth,
        maxWidth: noteWidth,
        boxSizing: 'border-box',
        overflow: 'hidden',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        boxShadow: isDragging ? '0 20px 40px rgba(0,0,0,0.3)' : 'var(--shadow-card)',
        transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        touchAction: 'none',
        outline: selected ? '2px solid var(--color-accent)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <button
          type="button"
          onPointerDown={onDragHandlePointerDown}
          aria-label="Mover nota"
          title="Mover nota"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: isDragging ? 'grabbing' : 'grab',
            fontSize: 13,
            lineHeight: 1,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span style={{ fontSize: 13 }}>⋮⋮</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>Mover</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {meta?.status === 'pending' && (
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Organizando…</span>
          )}
          {classification && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 999,
                background: 'var(--color-accent-subtle, rgba(59,130,246,0.12))',
                color: 'var(--color-accent)',
              }}
            >
              {classification}
            </span>
          )}
          {onConvertToTask && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onConvertToTask(note); }}
              aria-label="Convertir nota a tarea"
              title={note.title?.trim() ? 'Convertir a tarea al instante' : 'Se requiere un título en la nota para convertirla en tarea'}
              style={{
                border: 'none',
                background: 'var(--color-accent-subtle, rgba(59, 130, 246, 0.1))',
                color: 'var(--color-accent, #3b82f6)',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '2px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                opacity: note.title?.trim() ? 1 : 0.6,
              }}
            >
              <span>⚡</span> Tarea
            </button>
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
            aria-label="Eliminar nota"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>

      <input
        value={note.title || ''}
        onChange={(e) => onUpdate(note.id, { title: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        placeholder="Título"
        style={{
          border: 'none',
          background: 'transparent',
          fontWeight: 700,
          fontSize: 14,
          color: 'var(--color-text-primary)',
          outline: 'none',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      />
      <textarea
        value={note.text || ''}
        onChange={(e) => onUpdate(note.id, { text: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        placeholder="Escribe tu nota…"
        style={{
          border: 'none',
          background: 'transparent',
          resize: 'none',
          flex: 1,
          fontSize: 13,
          color: 'var(--color-text-primary)',
          outline: 'none',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          minHeight: 72,
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          overflowX: 'hidden',
        }}
      />

      {summary && (
        <div style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.35,
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          maxWidth: '100%',
        }}>
          {summary}
        </div>
      )}

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 6,
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {entityChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {entityChips.slice(0, 4).map((e) => (
            <span
              key={`${e.kind}-${e.v}`}
              title={e.v}
              style={{
                fontSize: 10,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '2px 6px',
                borderRadius: 6,
                border: '1px solid var(--color-border-tertiary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {e.kind === 'ticket' ? e.v : e.kind === 'url' ? '🔗 link' : e.v}
            </span>
          ))}
        </div>
      )}

      {taskSuggestions.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          {taskSuggestions.slice(0, 2).map((suggestion) => (
            <div
              key={suggestion}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: 'var(--color-text-secondary)',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                → {suggestion}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConvertSuggestion?.(note, suggestion);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-accent)',
                  fontWeight: 700,
                  fontSize: 10,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Crear
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissSuggestion?.(note.id, 'task', suggestion);
                }}
                aria-label="Descartar sugerencia"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BoardView({
  notes,
  noteAiMetaById = {},
  noteAiPrefs,
  relatedNotes = [],
  searchResults = null,
  searchQuery = '',
  searchBusy = false,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  selectedNoteId,
  onSelectNote,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onConvertToTask,
  onConvertSuggestion,
  onDismissSuggestion,
}) {
  const boardRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(800);
  const [draggedId, setDraggedId] = useState(null);
  const dragCaptureRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const noteWidth = Math.min(Math.max(boardWidth - 24, 150), 220);

  useEffect(() => {
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === 'number') setBoardWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handlePointerDown = (e, note) => {
    e.stopPropagation();
    e.preventDefault();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    dragOffsetRef.current = {
      x: e.clientX - boardRect.left - (note.x ?? 0),
      y: e.clientY - boardRect.top - (note.y ?? 0),
    };
    setDraggedId(note.id);
    dragCaptureRef.current = e.currentTarget;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!draggedId) return;
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    const x = Math.min(
      Math.max(e.clientX - boardRect.left - dragOffsetRef.current.x, 8),
      Math.max(boardWidth - noteWidth - 8, 8)
    );
    const y = Math.max(e.clientY - boardRect.top - dragOffsetRef.current.y, 8);
    onUpdateNote(draggedId, { x, y });
  };

  const handlePointerUp = (e) => {
    if (draggedId) {
      const captureEl = dragCaptureRef.current;
      if (captureEl?.hasPointerCapture?.(e.pointerId)) {
        try {
          captureEl.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer might already be released.
        }
      }
      dragCaptureRef.current = null;
      setDraggedId(null);
    }
  };

  const handleAddNote = () => {
    onAddNote({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: '', text: '', createdAt: new Date().toISOString(),
      x: 20 + Math.random() * 40, y: 20 + Math.random() * 40,
    });
  };

  const pendingCount = useMemo(
    () => Object.values(noteAiMetaById).filter((m) => m?.status === 'pending').length,
    [noteAiMetaById]
  );

  const showRelated = noteAiPrefs?.related !== false && selectedNoteId;

  return (
    <div className="board-view" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="board-toolbar material-base" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderRadius: 'var(--border-radius-xl)', padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 850 }}>Tablero de Notas</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {pendingCount > 0
                ? `Organizando ${pendingCount} nota${pendingCount === 1 ? '' : 's'} en segundo plano…`
                : 'La IA organiza tus notas en silencio.'}
            </div>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={handleAddNote}
            style={{ borderRadius: '999px', padding: '8px 16px', fontSize: 13, fontWeight: 700 }}
          >
            + Nueva Nota
          </button>
        </div>

        {noteAiPrefs?.semanticSearch !== false && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit?.();
            }}
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Buscar por significado… (ej. tickets de autenticación)"
              aria-label="Búsqueda semántica de notas"
              style={{
                flex: 1,
                borderRadius: 10,
                border: '1px solid var(--color-border-tertiary)',
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
                padding: '8px 12px',
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              disabled={searchBusy || !searchQuery.trim()}
              className="primary-button"
              style={{ borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, opacity: searchBusy ? 0.7 : 1 }}
            >
              {searchBusy ? '…' : 'Buscar'}
            </button>
            {searchResults && (
              <button
                type="button"
                onClick={onClearSearch}
                style={{
                  border: '1px solid var(--color-border-tertiary)',
                  background: 'transparent',
                  borderRadius: 10,
                  padding: '8px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Limpiar
              </button>
            )}
          </form>
        )}

        {Array.isArray(searchResults) && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Resultados ({searchResults.length})</div>
            {searchResults.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Sin coincidencias.</div>
            ) : searchResults.map((r) => (
              <button
                key={r.noteId}
                type="button"
                onClick={() => onSelectNote?.(r.noteId)}
                style={{
                  textAlign: 'left',
                  border: '1px solid var(--color-border-tertiary)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  background: selectedNoteId === r.noteId ? 'var(--color-accent-subtle, rgba(59,130,246,0.12))' : 'var(--color-background-secondary)',
                  cursor: 'pointer',
                  color: 'var(--color-text-primary)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 650 }}>{r.title || 'Sin título'}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {r.summary || (r.text || '').slice(0, 100)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showRelated ? 'minmax(0, 1fr) 260px' : '1fr', gap: 12 }}>
        <div
          className="board-canvas material-base"
          ref={boardRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'relative',
            minHeight: 'calc(100vh - 320px)',
            width: '100%',
            backgroundImage: 'radial-gradient(var(--color-border-tertiary) 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
            borderRadius: 'var(--border-radius-xl)',
            overflow: 'hidden',
          }}
        >
          {notes.length === 0 ? (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--color-text-secondary)', textAlign: 'center', padding: 20, fontSize: 'var(--font-size-sm)' }}>
              Pulsa + Nueva Nota para crear tu primer post-it.
            </div>
          ) : notes.map((note, index) => {
            const displayNote = {
              ...note,
              x: Math.min(
                Math.max(note.x ?? (index % 2) * (noteWidth + 20) + 12, 8),
                Math.max(boardWidth - noteWidth - 8, 8)
              ),
              y: Math.max(note.y ?? Math.floor(index / 2) * 200 + 20, 8),
              createdAt: note.createdAt || note.created_at || new Date().toISOString(),
            };
            return (
              <BoardNoteCard
                key={note.id}
                note={displayNote}
                meta={noteAiMetaById[note.id]}
                prefs={noteAiPrefs}
                selected={selectedNoteId === note.id}
                onSelect={onSelectNote}
                onDelete={onDeleteNote}
                onUpdate={onUpdateNote}
                onConvertToTask={onConvertToTask}
                onConvertSuggestion={onConvertSuggestion}
                onDismissSuggestion={onDismissSuggestion}
                onDragHandlePointerDown={(e) => handlePointerDown(e, displayNote)}
                isDragging={draggedId === note.id}
                noteWidth={noteWidth}
              />
            );
          })}
        </div>

        {showRelated && (
          <aside
            className="material-base"
            style={{
              borderRadius: 'var(--border-radius-xl)',
              padding: 14,
              alignSelf: 'start',
              position: 'sticky',
              top: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 8 }}>Notas relacionadas</div>
            {relatedNotes.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Aún no hay notas cercanas para esta selección. Prueba otra o espera a que se organice.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {relatedNotes.map((r) => (
                  <button
                    key={r.noteId}
                    type="button"
                    onClick={() => onSelectNote?.(r.noteId)}
                    style={{
                      textAlign: 'left',
                      border: '1px solid var(--color-border-tertiary)',
                      borderRadius: 10,
                      padding: 10,
                      background: 'var(--color-background-secondary)',
                      cursor: 'pointer',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 650 }}>{r.title || 'Sin título'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      {(r.text || '').slice(0, 80)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
