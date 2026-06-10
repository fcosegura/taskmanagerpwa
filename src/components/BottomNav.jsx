export default function BottomNav({ currentView, setView, onOpenExternalApp }) {
  const tabs = [
    { id: 'tasks', label: 'Tareas' },
    { id: 'kanban', label: 'Kanban' },
    { id: 'calendar', label: 'Calendario' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'board', label: 'Tablero' },
    { id: 'notebook', label: 'Notebook', external: true },
  ];

  const iconFor = (id) => {
    const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
    if (id === 'tasks') {
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      );
    }
    if (id === 'kanban') {
      return (
        <svg {...common}>
          <rect x="3" y="5" width="6" height="14" rx="1.5" />
          <rect x="10.5" y="5" width="10.5" height="8" rx="1.5" />
          <rect x="10.5" y="14.5" width="10.5" height="4.5" rx="1.5" />
        </svg>
      );
    }
    if (id === 'agenda') {
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 11h16" />
          <circle cx="12" cy="15" r="5" fill="currentColor" stroke="none" opacity="0.2" />
          <path d="M12 13v3l2 1" stroke="currentColor" fill="none" />
        </svg>
      );
    }
    if (id === 'calendar') {
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    }
    if (id === 'notebook') {
      return (
        <svg {...common}>
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z" />
          <path d="M5 5.5v16M9 7h6M9 11h6" />
        </svg>
      );
    }
    return (
      <svg {...common}>
        <path d="M8 5h8M8 9h8" />
        <rect x="5" y="4" width="14" height="16" rx="2.5" />
      </svg>
    );
  };

  return (
    <nav className="show-mobile" aria-label="Vistas principales">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-current={!tab.external && currentView === tab.id ? 'page' : undefined}
          onClick={() => (tab.external ? onOpenExternalApp?.() : setView(tab.id))}
          className={!tab.external && currentView === tab.id ? 'active' : ''}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            border: 'none',
            background: 'transparent',
            color: !tab.external && currentView === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
        >
          <span className="mobile-tab-icon" aria-hidden="true">{iconFor(tab.id)}</span>
          <span className="mobile-tab-label" style={{ fontWeight: !tab.external && currentView === tab.id ? 700 : 500 }}>
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
