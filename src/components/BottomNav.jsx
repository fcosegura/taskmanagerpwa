export default function BottomNav({ currentView, setView }) {
  const tabs = [
    { id: 'tasks', label: 'Tareas', icon: '📋' },
    { id: 'kanban', label: 'Kanban', icon: '🧩' },
    { id: 'calendar', label: 'Calendario', icon: '📅' },
    { id: 'board', label: 'Tablero', icon: '📌' },
  ];

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
          <span style={{ fontSize: 20 }}>{tab.icon}</span>
          <span style={{ fontSize: 10, fontWeight: currentView === tab.id ? 700 : 500 }}>
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
