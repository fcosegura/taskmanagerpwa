import { useRef, useState } from 'react';

function BoardNoteCard({ note, onDelete, onUpdate, onPointerDown, isDragging }) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute', left: note.x || 0, top: note.y || 0,
        zIndex: isDragging ? 50 : 10,
        cursor: isDragging ? 'grabbing' : 'grab',
        background: '#fef3c7', border: '1px solid #fcd34d',
        borderRadius: 20, padding: 14, minHeight: 220, width: 220,
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: isDragging ? '0 25px 50px -12px rgba(0,0,0,0.25)' : '0 12px 24px rgba(15,23,42,0.08)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
      }}
    >
      <button
        type="button"
        onClick={() => onDelete(note.id)}
        aria-label="Eliminar nota"
        style={{ position: 'absolute', top: 10, right: 10, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
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
        {new Date(note.createdAt).toLocaleDateString()}
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
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--color-background-primary)', borderRadius: 'var(--border-radius-lg)', padding: 20, boxShadow: 'var(--shadow-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Tablero de notas</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Crea, arrastra y edita notas directamente en el tablero.</div>
          </div>
          <button
            type="button"
            onClick={handleAddNote}
            style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: '#f59e0b', color: 'white', fontSize: 24, fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 20px rgba(245,158,11,0.24)' }}
          >+</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Las notas son libres. Añade post-its, muévelos donde quieras y organiza tus ideas.</div>
      </div>

      <div
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
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            Pulsa + para crear tu primer post-it.
          </div>
        ) : notes.map((note, index) => {
          if (note.x === undefined) note.x = (index % 4) * 240 + 20;
          if (note.y === undefined) note.y = Math.floor(index / 4) * 240 + 20;
          return (
            <BoardNoteCard
              key={note.id}
              note={note}
              onDelete={onDeleteNote}
              onUpdate={onUpdateNote}
              onPointerDown={(e) => handlePointerDown(e, note)}
              isDragging={draggedId === note.id}
            />
          );
        })}
      </div>
    </div>
  );
}
