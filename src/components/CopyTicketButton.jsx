import { useEffect, useRef, useState } from 'react';

export default function CopyTicketButton({ ticketNumber }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  if (!ticketNumber) return null;

  const copyTicket = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(ticketNumber);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 1400);
    } catch {
      setCopied(false);
    }
  };

  const stopCardInteraction = (event) => {
    event.stopPropagation();
  };

  return (
    <button
      type="button"
      className="copy-ticket-button"
      draggable={false}
      onClick={copyTicket}
      onMouseDown={stopCardInteraction}
      onPointerDown={stopCardInteraction}
      onDragStart={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      aria-label={`Copiar ticket ${ticketNumber}`}
      title={copied ? 'Ticket copiado' : `Copiar ticket ${ticketNumber}`}
      style={{
        border: '1px solid var(--color-border-tertiary)',
        borderRadius: 999,
        padding: '4px 8px',
        background: copied ? 'var(--color-background-success)' : 'var(--color-background-secondary)',
        color: copied ? 'var(--color-text-success)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden>{copied ? '✓' : '⧉'}</span>
      <span>{copied ? 'copiado' : ticketNumber}</span>
    </button>
  );
}
