import { useRef, useState } from 'react';

function BoardNoteCard({ note, onDelete, onUpdate, onPointerDown, isDragging }) {
  return (
    <div
      className="board-note"
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute', left: note.x ?? 0, top: note.y ?? 0,
        zIndex: isDragging ? 50 : 10,
        cursor: isDragging ? 'grabbing' : 'grab',
        background: '#fef3c7', border: '1px solid #fcd34d',
        borderRadius: 16, padding: 12, minHeight: 180, width: 180,
        display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: isDragging ? '0 25px 50px -12px rgba(0,0,0,0.25)' : '0 12px 24px rgba(15,23,42,0.08)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
        touchAction: 'none'
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
        aria-label="Eliminar nota"
        style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1, zIndex: 5 }}
      >×</button>
      <input
        value={note.title}
        onChange={(e) => onUpdate(note.id, { title: e.target.value })}
        placeholder="Título"
        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: '#92400e', outline: 'none' }}
      />
      <textarea
        value={note.text}
        onChange={(e) => onUpdate(note.id, { text: e.target.value })}
        placeholder="Escribe aquí..."
        style={{ flex: 1, width: '100%', minHeight: 120, resize: 'none', border: 'none', background: 'transparent', fontSize: 13, color: '#374151', lineHeight: 1.4, outline: 'none', whiteSpace: 'pre-wrap' }}
      />
      <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'right' }}>
        {new Date(note.createdAt || note.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

export default function BoardView({ notes, onAddNote, onUpdateNote, onDeleteNote }) {
  const boardRef = useRef(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handlePointerDown = (e, note) => {
    if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggedId(note.id);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handlePointerMove = (e) => {
    if (!draggedId || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left - dragOffset.x, 0), Math.max(rect.width - 180, 0));
    const y = Math.max(e.clientY - rect.top - dragOffset.y, 0);
    onUpdateNote(draggedId, { x, y });
  };

  const handlePointerUp = (e) => {
    if (draggedId) {
      e.currentTarget.releasePointerCapture(e.pointerId);
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
      <div className="board-toolbar" style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Tablero</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Notas estilo post-it.</div>
          </div>
          <button
            type="button"
            onClick={handleAddNote}
            style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: '#f59e0b', color: 'white', fontSize: 24, fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 20px rgba(245,158,11,0.24)' }}
          >+</button>
        </div>
        <div className="hide-mobile" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Las notas son libres. Añade post-its, muévelos donde quieras y organiza tus ideas.</div>
      </div>

      <div
        className="board-canvas"
        ref={boardRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative', minHeight: 'calc(100vh - 280px)', width: '100%',
          backgroundColor: '#f8fafc',
          backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
          borderRadius: 'var(--border-radius-lg)', overflow: 'hidden',
          border: '1px solid var(--color-border-tertiary)', boxShadow: 'var(--shadow-soft)',
        }}
      >
        {notes.length === 0 ? (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--color-text-secondary)', textAlign: 'center', padding: 20 }}>
            Pulsa + para crear tu primer post-it.
          </div>
        ) : notes.map((note, index) => {
          const displayNote = {
            ...note,
            x: note.x ?? (index % 2) * 200 + 20,
            y: note.y ?? Math.floor(index / 2) * 200 + 20,
            createdAt: note.createdAt || note.created_at || new Date().toISOString(),
          };
          return (
            <BoardNoteCard
              key={note.id}
              note={displayNote}
              onDelete={onDeleteNote}
              onUpdate={onUpdateNote}
              onPointerDown={(e) => handlePointerDown(e, displayNote)}
              isDragging={draggedId === note.id}
            />
          );
        })}
      </div>
    </div>
  );
}
