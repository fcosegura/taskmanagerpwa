import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalDialog } from '../hooks/useModalDialog.js';
import { buildNoteAiDisplay } from '../noteAi/display.js';
import { EXTENDED_NOTE_MAX_CHARS, countWords } from '../extendedNotes.js';
import './ExtendedNoteModal.css';

export default function ExtendedNoteModal({
  note,
  meta,
  prefs,
  onSave,
  onClose,
  onDelete,
  onConvertToTask,
  onConvertToQuick,
  onConvertSuggestion,
  onDismissSuggestion,
}) {
  const titleInputRef = useRef(null);
  const backdropPointerDownRef = useRef(false);
  const [draft, setDraft] = useState(() => ({ title: note.title || '', text: note.text || '' }));
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const dirty = draft.title !== (note.title || '') || draft.text !== (note.text || '');
  const ai = buildNoteAiDisplay(meta, prefs);

  const save = () => {
    if (!dirty) return;
    onSave(note.id, { title: draft.title, text: draft.text });
    setSavedAt(Date.now());
    setConfirmingClose(false);
  };

  // onClose recibe el contenido que queda persistido (o null si la nota ya no existe),
  // para que el tablero pueda descartar una nota nueva que se cierra vacía.
  const persisted = { title: note.title || '', text: note.text || '' };

  const requestClose = () => {
    if (dirty) {
      setConfirmingClose(true);
      return;
    }
    onClose(persisted);
  };

  const dialogRef = useModalDialog({ isOpen: true, onClose: requestClose, initialFocusRef: titleInputRef });

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
    if (!savedAt) return undefined;
    const timer = setTimeout(() => setSavedAt(null), 1800);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
    }
  };

  const words = countWords(draft.text);
  const nearLimit = draft.text.length >= EXTENDED_NOTE_MAX_CHARS * 0.9;
  const statusLabel = dirty
    ? 'Cambios sin guardar'
    : savedAt
      ? 'Guardado'
      : ai.pending
        ? 'Organizando con IA…'
        : 'Sin cambios';

  // Portal: el canvas del tablero crea su propio contexto de apilamiento.
  return createPortal(
    <div
      className="modal-backdrop extended-note-backdrop"
      // Solo cierra si el click empezó en el fondo: seleccionar texto arrastrando fuera no debe cerrar.
      onMouseDown={(e) => { backdropPointerDownRef.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (backdropPointerDownRef.current && e.target === e.currentTarget) requestClose();
        backdropPointerDownRef.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className="liquid-glass-modal extended-note-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extended-note-modal-title"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <header className="extended-note-modal__header">
          <span id="extended-note-modal-title" className="extended-note-modal__eyebrow">Nota extendida</span>
          <div className="extended-note-modal__header-actions">
            {ai.classification && <span className="extended-note-modal__classification">{ai.classification}</span>}
            <button type="button" className="extended-note-modal__icon-btn" onClick={requestClose} aria-label="Cerrar nota extendida">
              ×
            </button>
          </div>
        </header>

        <input
          ref={titleInputRef}
          className="extended-note-modal__title"
          value={draft.title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Título"
          aria-label="Título de la nota extendida"
        />

        <div className="extended-note-modal__body">
          <textarea
            className="extended-note-modal__text"
            value={draft.text}
            onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
            maxLength={EXTENDED_NOTE_MAX_CHARS}
            placeholder="Escribe tu nota extendida…"
            aria-label="Contenido de la nota extendida"
          />

          {(ai.summary || ai.tags.length > 0 || ai.entityChips.length > 0 || ai.taskSuggestions.length > 0) && (
            <aside className="extended-note-modal__ai" aria-label="Organización automática de la nota">
              {ai.summary && (
                <section>
                  <h3>Resumen</h3>
                  <p>{ai.summary}</p>
                </section>
              )}
              {ai.tags.length > 0 && (
                <section>
                  <h3>Etiquetas</h3>
                  <div className="extended-note-modal__chips">
                    {ai.tags.map((tag) => (
                      <span key={tag} className="extended-note-modal__tag" title={tag}>#{tag}</span>
                    ))}
                  </div>
                </section>
              )}
              {ai.entityChips.length > 0 && (
                <section>
                  <h3>Entidades</h3>
                  <div className="extended-note-modal__chips">
                    {ai.entityChips.map((e) => (
                      <span key={`${e.kind}-${e.v}`} className="extended-note-modal__entity" title={e.v}>
                        {e.kind === 'url' ? `🔗 ${e.v}` : e.v}
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {ai.taskSuggestions.length > 0 && (
                <section>
                  <h3>Tareas sugeridas</h3>
                  <ul className="extended-note-modal__suggestions">
                    {ai.taskSuggestions.map((suggestion) => (
                      <li key={suggestion}>
                        <span>→ {suggestion}</span>
                        <button type="button" onClick={() => onConvertSuggestion?.(note, suggestion)}>Crear</button>
                        <button
                          type="button"
                          onClick={() => onDismissSuggestion?.(note.id, 'task', suggestion)}
                          aria-label="Descartar sugerencia"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          )}
        </div>

        {confirmingClose ? (
          <div className="extended-note-modal__confirm" role="alert">
            <span>Tienes cambios sin guardar.</span>
            <div className="extended-note-modal__footer-actions">
              <button type="button" className="extended-note-modal__ghost" onClick={() => setConfirmingClose(false)}>
                Seguir editando
              </button>
              <button type="button" className="extended-note-modal__ghost" onClick={() => onClose(persisted)}>
                Descartar
              </button>
              <button
                type="button"
                className="primary-button extended-note-modal__primary"
                onClick={() => { onSave(note.id, { title: draft.title, text: draft.text }); onClose(draft); }}
              >
                Guardar y cerrar
              </button>
            </div>
          </div>
        ) : (
          <footer className="extended-note-modal__footer">
            <span className="extended-note-modal__meta" aria-live="polite">
              {words} palabra{words === 1 ? '' : 's'} ·{' '}
              <span className={nearLimit ? 'extended-note-modal__limit' : undefined}>
                {nearLimit
                  ? `${draft.text.length.toLocaleString('es-ES')} / ${EXTENDED_NOTE_MAX_CHARS.toLocaleString('es-ES')} caracteres`
                  : `${draft.text.length.toLocaleString('es-ES')} caracteres`}
              </span>
              {' '}· {statusLabel}
            </span>
            <div className="extended-note-modal__footer-actions">
              <button
                type="button"
                className="extended-note-modal__ghost extended-note-modal__danger"
                onClick={() => { onDelete?.(note.id); onClose(null); }}
              >
                Eliminar
              </button>
              {onConvertToQuick && (
                <button
                  type="button"
                  className="extended-note-modal__ghost"
                  title="Mostrar la nota completa y editable directamente en el tablero"
                  onClick={() => { onConvertToQuick(note.id, { title: draft.title, text: draft.text }); onClose(null); }}
                >
                  Pasar a nota rápida
                </button>
              )}
              {onConvertToTask && (
                <button
                  type="button"
                  className="extended-note-modal__ghost"
                  disabled={!draft.title.trim()}
                  title={draft.title.trim() ? 'Convertir a tarea' : 'Se requiere un título para convertirla en tarea'}
                  onClick={() => { onConvertToTask({ ...note, ...draft }); onClose(null); }}
                >
                  ⚡ Tarea
                </button>
              )}
              <button
                type="button"
                className="primary-button extended-note-modal__primary"
                onClick={save}
                disabled={!dirty}
              >
                Guardar
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
