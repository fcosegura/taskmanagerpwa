export function Pill({ s, fixedWidth = null }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
        background: `var(${s.bv})`, color: `var(${s.tv})`,
        minWidth: fixedWidth || undefined,
        textAlign: fixedWidth ? 'center' : undefined,
      }}
    >
      {s.label}
    </span>
  );
}

export function CategoryPill({ name }) {
  return (
    <span className="category-pill" title={name}>
      {name}
    </span>
  );
}

export function NBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34, height: 34, fontSize: 16, cursor: 'pointer',
        border: '1px solid var(--color-border-secondary)',
        background: 'var(--color-background-primary)',
        borderRadius: '999px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-secondary)',
        boxShadow: '0 10px 22px rgba(15,23,42,0.06)',
      }}
    >
      {children}
    </button>
  );
}

export function Chip({ label, count, active, onClick, colorVar }) {
  return (
    <button
      type="button"
      className={`filter-chip${active ? ' filter-chip--active' : ''}`}
      onClick={onClick}
      style={{
        ...(active && colorVar ? { color: `var(${colorVar})` } : {}),
      }}
    >
      <span className="filter-chip__label">{label}</span>
      <span className="filter-chip__count">{count}</span>
    </button>
  );
}
