import { forwardRef } from 'react';

export const Button = forwardRef(function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}, ref) {
  const baseClass = variant === 'primary'
    ? 'primary-button'
    : variant === 'danger'
      ? 'ghost-button danger'
      : 'ghost-button';
  return (
    <button ref={ref} type={type} className={`${baseClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({
  children,
  label,
  className = '',
  ...rest
}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`icon-button ${className}`.trim()}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  );
});

export const Input = forwardRef(function Input({
  label,
  id,
  className = '',
  wrapperClassName = '',
  ...rest
}, ref) {
  return (
    <div className={`form-group ${wrapperClassName}`.trim()}>
      {label && <label htmlFor={id}>{label}</label>}
      <input ref={ref} id={id} className={className} {...rest} />
    </div>
  );
});

import { useModalDialog } from '../../hooks/useModalDialog.js';

export function Modal({
  isOpen,
  onClose,
  title,
  titleId,
  children,
  className = '',
}) {
  const dialogRef = useModalDialog({ isOpen, onClose });
  if (!isOpen) return null;
  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId || undefined}>
      <div ref={dialogRef} className={`material-modal ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
        {title && <h2 id={titleId}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Sheet({
  isOpen,
  onClose,
  title,
  titleId,
  children,
  className = '',
}) {
  const dialogRef = useModalDialog({ isOpen, onClose });
  if (!isOpen) return null;
  return (
    <div className="sheet-drawer-overlay dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId || undefined}>
      <div ref={dialogRef} className={`sheet-drawer-card material-modal ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="sheet-drawer-header">
            <h2 id={titleId}>{title}</h2>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
