import { useEffect, useRef, useState } from 'react';

function BoardNoteCard({ note, onDelete, onUpdate, onDragHandlePointerDown, isDragging, noteWidth }) {
  return (
    <div
      className="board-note material-elevated"
      style={{
        position: 'absolute', left: note.x ?? 0, top: note.y ?? 0,
        zIndex: isDragging ? 50 : 10,
        cursor: 'default',
        borderRadius: 'var(--border-radius-lg)',
        padding: 14,
        minHeight: 180,
        width: noteWidth,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        boxShadow: isDragging ? '0 20px 40px rgba(0,0,0,0.3)' : 'var(--shadow-card)',
        transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        touchAction: 'none'
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
            padding: '2px 4px'
          }}
        >
          ✕
        </button>
      </div>

      <input
        value={note.title}
        onChange={(e) => onUpdate(note.id, { title: e.target.value })}
        placeholder="Título de la nota..."
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          outline: 'none'
        }}
      />
      <textarea
        value={note.text}
        onChange={(e) => onUpdate(note.id, { text: e.target.value })}
        placeholder="Escribe tus ideas aquí..."
        style={{
          flex: 1,
          width: '100%',
          minHeight: 110,
          resize: 'none',
          border: 'none',
          background: 'transparent',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.4,
          outline: 'none',
          whiteSpace: 'pre-wrap'
        }}
      />
      <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'right', fontWeight: 600 }}>
        {new Date(note.createdAt || note.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

export default function BoardView({ notes, onAddNote, onUpdateNote, onDeleteNote }) {
  const boardRef = useRef(null);
  const dragCaptureRef = useRef(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [boardWidth, setBoardWidth] = useState(0);
  const noteWidth = Math.max(150, Math.min(220, boardWidth > 0 ? boardWidth - 24 : 200));

  useEffect(() => {
    if (!boardRef.current) return undefined;
    const updateWidth = () => setBoardWidth(boardRef.current?.clientWidth || 0);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!boardWidth) return;
    const maxX = Math.max(boardWidth - noteWidth - 8, 8);
    notes.forEach((note) => {
      const originalX = typeof note.x === 'number' ? note.x : 8;
      const clampedX = Math.min(Math.max(originalX, 8), maxX);
      if (clampedX !== originalX) {
        onUpdateNote(note.id, { x: clampedX });
      }
    });
  }, [boardWidth, noteWidth, notes, onUpdateNote]);

  const handlePointerDown = (e, note) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragCaptureRef.current = e.currentTarget;
    setDraggedId(note.id);
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    setDragOffset({ x: e.clientX - boardRect.left - (note.x ?? 0), y: e.clientY - boardRect.top - (note.y ?? 0) });
  };

  const handlePointerMove = (e) => {
    if (!draggedId || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left - dragOffset.x, 8), Math.max(rect.width - noteWidth - 8, 8));
    const y = Math.max(e.clientY - rect.top - dragOffset.y, 8);
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

  return (
    <div className="board-view" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="board-toolbar material-base" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderRadius: 'var(--border-radius-xl)', padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 850 }}>Tablero de Notas</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Notas visuales e ideas libres.</div>
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
      </div>

      <div
        className="board-canvas material-base"
        ref={boardRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative',
          minHeight: 'calc(100vh - 280px)',
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
              onDelete={onDeleteNote}
              onUpdate={onUpdateNote}
              onDragHandlePointerDown={(e) => handlePointerDown(e, displayNote)}
              isDragging={draggedId === note.id}
              noteWidth={noteWidth}
            />
          );
        })}
      </div>
    </div>
  );
}
