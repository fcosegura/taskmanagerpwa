import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/index.jsx';
import { useModalDialog } from '../hooks/useModalDialog.js';
import './ExtendedNoteModal.css';

export default function ExtendedNoteModal({ note, meta, prefs, onSave, onClose }) {
  const [title, setTitle] = useState(note.title || '');
  const [text, setText] = useState(note.text || '');
  const [confirmClose, setConfirmClose] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = title !== (note.title || '') || text !== (note.text || '');
  const close = () => dirty ? setConfirmClose(true) : onClose();
  const dialogRef = useModalDialog({ isOpen: true, onClose: close });
  const save = () => {
    onSave({ title, text });
    setSaved(true);
    setConfirmClose(false);
  };
  const tags = prefs?.autotag !== false
    ? (meta?.tags || []).filter((tag) => !meta?.dismissed?.includes(`tag:${tag}`)) : [];
  return createPortal(
    <div className="extended-note-overlay" role="dialog" aria-modal="true" aria-labelledby="extended-note-heading"
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} className="extended-note-modal material-modal">
      <h2 id="extended-note-heading">Nota extendida</h2>
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <div className="extended-note-scroll">
          <label htmlFor="extended-note-title">Título</label>
          <input id="extended-note-title" value={title} placeholder="Título de la nota"
            onChange={(event) => { setTitle(event.target.value); setSaved(false); }} />
          <label htmlFor="extended-note-text">Contenido</label>
          <textarea id="extended-note-text" value={text} placeholder="Desarrolla tus ideas…"
            onChange={(event) => { setText(event.target.value); setSaved(false); }} />
          <small>{Array.from(text).length.toLocaleString('es-ES')} caracteres</small>
          {tags.length > 0 && <div aria-label="Etiquetas de la nota">{tags.map((tag) => <span key={tag}>#{tag} </span>)}</div>}
          {prefs?.summary !== false && meta?.summary && <p>{meta.summary}</p>}
        </div>
        <footer>
          <span role="status">{dirty ? 'Cambios sin guardar' : saved ? 'Guardado en la app' : ''}</span>
          <Button variant="ghost" onClick={close}>Cerrar</Button>
          <Button type="submit" disabled={!dirty}>Guardar</Button>
        </footer>
        {confirmClose && <div className="extended-note-confirm" role="alert">
          <p>Hay cambios sin guardar. Guarda la nota o descarta los cambios para cerrar.</p>
          <Button variant="ghost" onClick={() => setConfirmClose(false)}>Seguir editando</Button>
          <Button variant="danger" onClick={onClose}>Descartar cambios</Button>
          <Button onClick={() => { save(); onClose(); }}>Guardar y cerrar</Button>
        </div>}
      </form>
      </div>
    </div>, document.body
  );
}
