import { useState, useRef, useMemo } from 'react';
import { useModalDialog } from '../hooks/useModalDialog.js';

export default function CommandMenu({
  isOpen,
  onClose,
  tasks = [],
  onNavigateToView,
  onOpenCreateTask,
  onToggleTheme,
  onOpenWorkspaceMenu,
  onSelectTask
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const dialogRef = useModalDialog({
    isOpen,
    onClose,
    initialFocusRef: inputRef
  });

  const navigationActions = useMemo(() => [
    { id: 'nav-today', label: 'Ir a Hoy', icon: '🏠', action: () => onNavigateToView('today') },
    { id: 'nav-tasks', label: 'Ir a Tareas (Lista)', icon: '📋', action: () => onNavigateToView('tasks') },
    { id: 'nav-kanban', label: 'Ir a Tablero Kanban', icon: '📊', action: () => onNavigateToView('kanban') },
    { id: 'nav-calendar', label: 'Ir a Calendario', icon: '📅', action: () => onNavigateToView('calendar') },
    { id: 'nav-daily', label: 'Ir a Agenda Diaria', icon: '⏱️', action: () => onNavigateToView('daily') },
    { id: 'nav-board', label: 'Ir a Tablero de Notas', icon: '📝', action: () => onNavigateToView('board') },
    { id: 'nav-timeline', label: 'Ir a Cronología', icon: '📈', action: () => onNavigateToView('timeline') }
  ], [onNavigateToView]);

  const systemActions = useMemo(() => [
    { id: 'sys-new-task', label: 'Crear nueva tarea', icon: '➕', action: () => onOpenCreateTask && onOpenCreateTask() },
    { id: 'sys-toggle-theme', label: 'Cambiar tema (Claro/Oscuro)', icon: '🌓', action: () => onToggleTheme && onToggleTheme() },
    { id: 'sys-workspace', label: 'Cambiar Workspace', icon: '🏢', action: () => onOpenWorkspaceMenu && onOpenWorkspaceMenu() }
  ], [onOpenCreateTask, onToggleTheme, onOpenWorkspaceMenu]);

  const matchingTasks = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return tasks
      .filter((t) => (t.name || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q))
      .slice(0, 5);
  }, [searchQuery, tasks]);

  const filteredNav = useMemo(() => {
    if (!searchQuery.trim()) return navigationActions;
    const q = searchQuery.toLowerCase();
    return navigationActions.filter((item) => item.label.toLowerCase().includes(q));
  }, [searchQuery, navigationActions]);

  const filteredSystem = useMemo(() => {
    if (!searchQuery.trim()) return systemActions;
    const q = searchQuery.toLowerCase();
    return systemActions.filter((item) => item.label.toLowerCase().includes(q));
  }, [searchQuery, systemActions]);

  const allItems = useMemo(() => {
    const items = [];
    matchingTasks.forEach((t) => items.push({ type: 'task', id: `task-${t.id}`, label: t.name, task: t }));
    filteredNav.forEach((n) => items.push({ type: 'nav', ...n }));
    filteredSystem.forEach((s) => items.push({ type: 'sys', ...s }));
    return items;
  }, [matchingTasks, filteredNav, filteredSystem]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (allItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = allItems[selectedIndex];
      if (selected) {
        executeItem(selected);
      }
    }
  };

  const executeItem = (item) => {
    onClose();
    if (item.type === 'task') {
      if (onSelectTask) onSelectTask(item.task);
    } else if (item.action) {
      item.action();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="command-menu-overlay dialog-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-menu-heading"
    >
      <div
        ref={dialogRef}
        className="command-menu-card material-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <span id="command-menu-heading" className="sr-only" style={{ display: 'none' }}>Menú de Comandos</span>
        <div className="command-menu-header">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="command-menu-input"
            placeholder="Escribe un comando o busca tareas... (⌘K)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <kbd className="kbd-shortcut">ESC</kbd>
        </div>

        <div className="command-menu-results">
          {allItems.length === 0 ? (
            <div className="command-menu-empty">
              <span>No se encontraron resultados para &quot;{searchQuery}&quot;</span>
            </div>
          ) : (
            allItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`command-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      executeItem(item);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="command-icon">{item.icon || (item.type === 'task' ? '📌' : '⚡')}</span>
                  <div className="command-item-content">
                    <span className="command-item-title">{item.label}</span>
                    {item.type === 'task' && item.task.category && (
                      <span className="command-item-sub">{item.task.category}</span>
                    )}
                  </div>
                  {isSelected && <span className="command-item-enter">↵ Ejecutar</span>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
