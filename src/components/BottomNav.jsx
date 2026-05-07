export default function BottomNav({ currentView, setView }) {
  const tabs = [
    { id: 'tasks', label: 'Tareas' },
    { id: 'kanban', label: 'Kanban' },
    { id: 'calendar', label: 'Calendario' },
    { id: 'board', label: 'Tablero' },
  ];

  const iconFor = (id) => {
    const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
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
    if (id === 'calendar') {
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
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
    <nav 
      className="show-mobile"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setView(tab.id)}
          className={currentView === tab.id ? 'active' : ''}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            border: 'none',
            background: 'transparent',
            color: currentView === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
        >
          <span style={{ display: 'grid', placeItems: 'center' }}>{iconFor(tab.id)}</span>
          <span style={{ fontSize: 10, fontWeight: currentView === tab.id ? 700 : 500 }}>
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
