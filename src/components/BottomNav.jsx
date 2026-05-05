export default function BottomNav({ currentView, setView }) {
  const tabs = [
    { id: 'tasks', label: 'Tareas', icon: '📋' },
    { id: 'calendar', label: 'Calendario', icon: '📅' },
    { id: 'board', label: 'Tablero', icon: '📌' },
  ];

  return (
    <nav 
      className="show-mobile"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--nav-height)',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--color-border-tertiary)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 100,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)'
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setView(tab.id)}
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
