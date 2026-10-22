import { cleanNoteTags } from '../noteAi/contentSignals.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/index.jsx';
import { useModalDialog } from '../hooks/useModalDialog.js';
import './ExtendedNoteModal.css';

export default function ExtendedNoteModal({ note, meta, prefs, onSave, onClose }) {
  const [title, setTitle] = useState(note.title || '');
  const [text, setText] = useState(note.text || '');
  const [confirmClose, setConfirmClose] = useState(false);
  const [saved, setSaved] = useState(false);
  const titleRef = useRef(null);
  const continueRef = useRef(null);
  const editorRef = useRef(null);
  const dirty = title !== (note.title || '') || text !== (note.text || '');
  const hasContent = Boolean(title.trim() || text.trim());
  const close = () => dirty ? setConfirmClose(true) : onClose();
  const dialogRef = useModalDialog({ isOpen: true, onClose: close, initialFocusRef: titleRef });
  const stats = useMemo(() => ({
    characters: Array.from(text).length.toLocaleString('es-ES'),
    words: (text.trim() ? text.trim().split(/\s+/u).length : 0).toLocaleString('es-ES'),
  }), [text]);

  useEffect(() => {
    if (confirmClose) continueRef.current?.focus();
  }, [confirmClose]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const save = () => {
    if (!hasContent) return;
    onSave({ title, text });
    setSaved(true);
    setConfirmClose(false);
  };
  const tags = prefs?.autotag !== false
    ? cleanNoteTags(meta?.tags).filter((tag) => !meta?.dismissed?.includes(`tag:${tag}`)) : [];
  const summary = prefs?.summary !== false ? meta?.summary : '';
  const classification = prefs?.classification !== false ? meta?.classification : '';

  return createPortal(
    <div className="extended-note-overlay" role="dialog" aria-modal="true" aria-labelledby="extended-note-heading"
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} className="extended-note-modal material-modal"
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            if (dirty) save();
          }
        }}>
        <header className="extended-note-header">
          <div>
            <small>Tablero de notas</small>
            <h2 id="extended-note-heading">Nota extendida</h2>
          </div>
          <button type="button" className="ghost-button" aria-label="Cerrar nota extendida" onClick={close}>×</button>
        </header>
        <form onSubmit={(event) => { event.preventDefault(); save(); }}>
          <div className="extended-note-scroll">
            <label htmlFor="extended-note-title">Título</label>
            <input ref={titleRef} id="extended-note-title" value={title} placeholder="Título de la nota"
              onChange={(event) => { setTitle(event.target.value); setSaved(false); }} />
            <label htmlFor="extended-note-text">Contenido</label>
            <textarea ref={editorRef} id="extended-note-text" value={text} placeholder="Desarrolla tus ideas…"
              aria-describedby="extended-note-stats"
              onChange={(event) => { setText(event.target.value); setSaved(false); }} />
            <small id="extended-note-stats">{stats.characters} caracteres · {stats.words} palabras</small>
            {(tags.length > 0 || summary || classification || meta?.status === 'pending') && (
              <aside className="extended-note-insights" aria-label="Organización de la nota">
                <strong>Organización automática</strong>
                {meta?.status === 'pending' && <small>Analizando la nota…</small>}
                {classification && <small>{classification}</small>}
                {tags.length > 0 && <div className="extended-note-tags" aria-label="Etiquetas de la nota">
                  {tags.map((tag) => <span key={tag}>#{tag}</span>)}
                </div>}
                {summary && <p>{summary}</p>}
                {dirty && <small>Las sugerencias corresponden a la última versión guardada.</small>}
              </aside>
            )}
          </div>
          {confirmClose && <div className="extended-note-confirm" role="alert">
            <p>Hay cambios sin guardar. Guarda la nota o descarta los cambios para cerrar.</p>
            <div>
              <Button ref={continueRef} variant="ghost" onClick={() => { setConfirmClose(false); editorRef.current?.focus(); }}>Seguir editando</Button>
              <Button variant="danger" onClick={onClose}>Descartar cambios</Button>
              <Button disabled={!hasContent} onClick={() => { save(); onClose(); }}>Guardar y cerrar</Button>
            </div>
          </div>}
          <footer>
            <span role="status">{dirty ? 'Cambios sin guardar' : saved ? 'Guardado en la app' : 'Sin cambios pendientes'}</span>
            <div className="extended-note-actions">
              <Button variant="ghost" onClick={close}>Cerrar</Button>
              <Button type="submit" disabled={!dirty || !hasContent} title="Guardar (Ctrl+S o ⌘S)">Guardar</Button>
            </div>
          </footer>
        </form>
      </div>
    </div>, document.body
  );
}
