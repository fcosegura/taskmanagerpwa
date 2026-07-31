import { useEffect, useRef } from 'react';

/**
 * Hook reutilizable para hacer diálogos y modales accesibles con teclado.
 *
 * @param {Object} params
 * @param {boolean} params.isOpen - Si el diálogo está visible
 * @param {Function} params.onClose - Función para cerrar el diálogo
 * @param {React.RefObject} [params.initialFocusRef] - Ref opcional del campo/elemento al que mover el foco al abrir
 * @param {boolean} [params.closeOnEscape=true] - Si se debe cerrar al presionar Escape
 * @returns {React.RefObject} dialogRef - Ref para asignar a la tarjeta/contenedor del diálogo
 */
export function useModalDialog({
  isOpen,
  onClose,
  initialFocusRef,
  closeOnEscape = true
}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const initialFocusRefInternal = useRef(initialFocusRef);

  useEffect(() => {
    onCloseRef.current = onClose;
    initialFocusRefInternal.current = initialFocusRef;
  });

  useEffect(() => {
    if (!isOpen) return;

    // 1. Guardar el elemento activo antes de abrir el modal
    if (document.activeElement && document.activeElement !== document.body) {
      previousFocusRef.current = document.activeElement;
    }

    // 2. Mover foco al abrir (initialFocusRef o primer elemento enfocable o contenedor del diálogo)
    const focusTimer = setTimeout(() => {
      const targetFocus = initialFocusRefInternal.current?.current;
      if (targetFocus && typeof targetFocus.focus === 'function') {
        targetFocus.focus();
      } else if (dialogRef.current) {
        const focusables = getFocusableElements(dialogRef.current);
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 30);

    // 3. Trampa de foco (Tab y Shift+Tab) y Escape
    const handleKeyDown = (e) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        if (onCloseRef.current) onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = getFocusableElements(dialogRef.current);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: si el elemento activo es el primero o está fuera, ir al último
          if (document.activeElement === firstElement || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: si el elemento activo es el último o está fuera, ir al primero
          if (document.activeElement === lastElement || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);

      // 4. Restaurar foco al elemento disparador sólo al desmontar el estado abierto
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, closeOnEscape]);

  return dialogRef;
}

function getFocusableElements(container) {
  if (!container) return [];
  const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll(selector)).filter((el) => {
    return (
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      (el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement)
    );
  });
}
