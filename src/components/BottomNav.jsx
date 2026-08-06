export default function BottomNav({ currentView, setView, onOpenCreateTask, onOpenExternalApp }) {
  const tabs = [
    { id: 'today', label: 'Hoy' },
    { id: 'tasks', label: 'Tareas' },
    { id: 'add', label: '', isAction: true },
    { id: 'calendar', label: 'Calendario' },
    { id: 'board', label: 'Notas' },
    { id: 'notebook', label: 'Notebook', external: true }
  ];

  const isAreaActive = (tabId) => {
    if (tabId === 'today' && currentView === 'today') return true;
    if (tabId === 'tasks' && (currentView === 'tasks' || currentView === 'kanban')) return true;
    if (tabId === 'calendar' && (currentView === 'calendar' || currentView === 'daily')) return true;
    if (tabId === 'board' && (currentView === 'board' || currentView === 'timeline' || currentView === 'graph')) return true;
    return false;
  };

  const iconFor = (id) => {
    const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
    if (id === 'today') {
      return (
        <svg {...common}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    }
    if (id === 'tasks') {
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="3" />
          <path d="M8 9h8M8 13h8M8 17h5" />
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
    if (id === 'board') {
      return (
        <svg {...common}>
          <path d="M8 5h8M8 9h8" />
          <rect x="5" y="4" width="14" height="16" rx="2.5" />
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
    return null;
  };

  return (
    <nav className="show-mobile material-floating" aria-label="Navegación principal">
      {tabs.map((tab) => {
        if (tab.isAction) {
          return (
            <button
              key="add"
              type="button"
              className="mobile-fab-button"
              onClick={() => onOpenCreateTask && onOpenCreateTask()}
              aria-label="Nueva tarea"
            >
              +
            </button>
          );
        }

        const active = !tab.external && isAreaActive(tab.id);
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => (tab.external ? onOpenExternalApp?.() : setView(tab.id))}
            className={`mobile-nav-item ${active ? 'active' : ''}`}
          >
            <span className="mobile-tab-icon" aria-hidden="true">{iconFor(tab.id)}</span>
            <span className="mobile-tab-label">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
