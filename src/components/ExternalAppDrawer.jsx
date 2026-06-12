import { useEffect, useRef, useState } from 'react';
import './ExternalAppDrawer.css';

export const MY_NOTEBOOK_URL = 'https://mynotebook.fcovidalsegura.workers.dev/';
const MY_NOTEBOOK_ORIGIN = new URL(MY_NOTEBOOK_URL).origin;
const CREATE_NOTEBOOK_MESSAGE_TYPE = 'taskmanager:create-notebook';
const CREATE_NOTEBOOK_RESULT_MESSAGE_TYPE = 'mynotebook:create-notebook:result';

const NOTEBOOK_REQUEST_TIMEOUT_MS = 6000;

const MIN_DRAWER_WIDTH = 320;
const DEFAULT_DRAWER_WIDTH = 1280;
const MAX_DRAWER_WIDTH = 1280;
const WIDTH_STEP = 32;

function buildRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `notebook-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clampWidth(width) {
  if (typeof window === 'undefined') return width;
  const viewportWidth = window.innerWidth || DEFAULT_DRAWER_WIDTH;
  const maxWidth = Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, Math.floor(viewportWidth * 0.96)));
  return Math.min(Math.max(width, MIN_DRAWER_WIDTH), maxWidth);
}

export default function ExternalAppDrawer({ isOpen, onClose }) {
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const [notebookTitle, setNotebookTitle] = useState('');
  const [notebookRequest, setNotebookRequest] = useState({ status: 'idle', message: '' });
  const iframeRef = useRef(null);
  const closeButtonRef = useRef(null);
  const pendingRequestIdRef = useRef(null);
  const requestTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const animationFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      pendingRequestIdRef.current = null;
      if (requestTimeoutRef.current) {
        window.clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleResize = () => setDrawerWidth((width) => clampWidth(width));
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleMessage = (event) => {
      if (event.origin !== MY_NOTEBOOK_ORIGIN) return;

      const data = event.data;
      if (!data || data.type !== CREATE_NOTEBOOK_RESULT_MESSAGE_TYPE) return;
      if (data.requestId !== pendingRequestIdRef.current) return;

      if (requestTimeoutRef.current) {
        window.clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }
      pendingRequestIdRef.current = null;

      if (data.success) {
        setNotebookTitle('');
        setNotebookRequest({ status: 'success', message: data.message || 'Libreta creada en MyNotebook.' });
        return;
      }

      const lockedMessage = 'MyNotebook no está desbloqueada. Desbloquéala en el panel e inténtalo de nuevo.';
      setNotebookRequest({
        status: 'error',
        message: data.error === 'locked' ? lockedMessage : (data.message || 'No se pudo crear la libreta en MyNotebook.')
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen]);

  const startResize = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const handlePointerMove = (moveEvent) => {
      setDrawerWidth(clampWidth(window.innerWidth - moveEvent.clientX));
    };

    const stopResize = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  };

  const createNotebook = (event) => {
    event.preventDefault();

    const title = notebookTitle.trim();
    if (!title) {
      setNotebookRequest({ status: 'error', message: 'Escribe un nombre para la libreta.' });
      return;
    }

    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow) {
      setNotebookRequest({ status: 'error', message: 'MyNotebook aún no está cargado.' });
      return;
    }

    const requestId = buildRequestId();
    pendingRequestIdRef.current = requestId;
    if (requestTimeoutRef.current) window.clearTimeout(requestTimeoutRef.current);
    requestTimeoutRef.current = window.setTimeout(() => {
      if (pendingRequestIdRef.current !== requestId) return;
      pendingRequestIdRef.current = null;
      requestTimeoutRef.current = null;
      setNotebookRequest({
        status: 'error',
        message: 'MyNotebook no respondió. Comprueba que está desbloqueado y actualizado.'
      });
    }, NOTEBOOK_REQUEST_TIMEOUT_MS);

    targetWindow.postMessage({
      type: CREATE_NOTEBOOK_MESSAGE_TYPE,
      requestId,
      payload: { title }
    }, MY_NOTEBOOK_ORIGIN);
    setNotebookRequest({ status: 'pending', message: 'Solicitando creación en MyNotebook...' });
  };

  const handleResizeKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    setDrawerWidth((width) => clampWidth(width + (event.key === 'ArrowLeft' ? WIDTH_STEP : -WIDTH_STEP)));
  };

  return (
    <div
      className={`external-app-overlay${isOpen ? ' open' : ''}`}
      onMouseDown={(event) => {
        if (isOpen && event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
      aria-hidden={!isOpen}
    >
      <aside
        className="external-app-drawer"
        aria-label="MyNotebook"
        style={{ '--external-drawer-width': `${drawerWidth}px` }}
      >
        <button
          type="button"
          className="external-app-resize-handle"
          aria-label="Redimensionar panel de MyNotebook"
          aria-valuemin={MIN_DRAWER_WIDTH}
          aria-valuenow={drawerWidth}
          disabled={!isOpen}
          onPointerDown={startResize}
          onKeyDown={handleResizeKeyDown}
        />
        <div className="external-app-header">
          <div className="external-app-title">
            <p className="external-app-eyebrow">Panel externo</p>
            <h2>MyNotebook</h2>
          </div>
          <form className="external-app-create-form" onSubmit={createNotebook}>
            <label className="external-app-create-label" htmlFor="mynotebook-title">Crear libreta</label>
            <div className="external-app-create-row">
              <input
                id="mynotebook-title"
                type="text"
                value={notebookTitle}
                onChange={(event) => setNotebookTitle(event.target.value)}
                placeholder="Nombre de la libreta"
                maxLength={120}
                disabled={!isOpen || notebookRequest.status === 'pending'}
              />
              <button type="submit" className="primary-button" disabled={!isOpen || notebookRequest.status === 'pending'}>
                Crear
              </button>
            </div>
            {notebookRequest.message ? (
              <p className={`external-app-create-message ${notebookRequest.status}`}>{notebookRequest.message}</p>
            ) : null}
          </form>
          <button
            type="button"
            className="ghost-button external-app-close"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="Cerrar MyNotebook"
            disabled={!isOpen}
          >
            ×
          </button>
        </div>
        <iframe
          ref={iframeRef}
          className="external-app-frame"
          src={MY_NOTEBOOK_URL}
          title="MyNotebook"
          allow="clipboard-read; clipboard-write"
          tabIndex={isOpen ? 0 : -1}
        />
      </aside>
    </div>
  );
}
