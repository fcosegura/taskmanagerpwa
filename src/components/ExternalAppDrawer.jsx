import { useEffect, useRef, useState } from 'react';
import './ExternalAppDrawer.css';

export const MY_NOTEBOOK_URL = 'https://mynotebook.fcovidalsegura.workers.dev/';

const MIN_DRAWER_WIDTH = 320;
const DEFAULT_DRAWER_WIDTH = 720;
const WIDTH_STEP = 32;

function clampWidth(width) {
  if (typeof window === 'undefined') return width;
  const viewportWidth = window.innerWidth || DEFAULT_DRAWER_WIDTH;
  const maxWidth = Math.max(MIN_DRAWER_WIDTH, Math.min(1200, Math.floor(viewportWidth * 0.96)));
  return Math.min(Math.max(width, MIN_DRAWER_WIDTH), maxWidth);
}

export default function ExternalAppDrawer({ isOpen, onClose }) {
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const animationFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

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
          <div>
            <p className="external-app-eyebrow">Panel externo</p>
            <h2>MyNotebook</h2>
          </div>
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
