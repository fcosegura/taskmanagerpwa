import { useState } from 'react';
import { STATUS } from '../constants.js';
import { Chip } from './shared/index.jsx';
import TaskRow from './TaskRow.jsx';

export default function TasksView({
  tasks, total, filter, setFilter, searchQuery, setSearchQuery,
  categoryFilter, setCategoryFilter, categories,
  statusCounts, categoryCounts,
  onEdit, onToggleDone, onToggleSubtaskDone, onReorderSubtasks, onQuickAdd, onQuickSuggest,
}) {
  const [quickText, setQuickText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [quickAiLoading, setQuickAiLoading] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState('');

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    onQuickAdd(quickText);
    setQuickText('');
    setQuickFeedback('');
  };

  const handleQuickAISubmit = async () => {
    if (!quickText.trim() || quickAiLoading || !onQuickSuggest) return;
    setQuickAiLoading(true);
    setQuickFeedback('');
    try {
      await onQuickSuggest(quickText);
      setQuickText('');
      setQuickFeedback('Tarea creada con sugerencia IA.');
    } catch (error) {
      setQuickFeedback(error.message || 'No se pudo sugerir la tarea.');
    } finally {
      setQuickAiLoading(false);
    }
  };

  const cnt = { ...statusCounts };
  STATUS.forEach((s) => { if (cnt[s.v] === undefined) cnt[s.v] = 0; });
  const catCount = {};
  categories.forEach((cat) => { catCount[cat] = categoryCounts[cat] || 0; });

  return (
    <div className="tasks-view">
      <div className="toolbar-panel">
        <div className="toolbar-row">
          <div className="search-box">
            <span>⌕</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tareas..."
              style={{ width: '100%', height: 42, padding: '10px 14px 10px 40px', borderRadius: '999px', border: '1px solid rgba(148,163,184,0.25)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontSize: 13, boxShadow: '0 2px 8px rgba(15,23,42,0.02)', transition: 'border 0.2s, box-shadow 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-border-info)'; e.target.style.boxShadow = '0 4px 12px rgba(56,189,248,0.1)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.25)'; e.target.style.boxShadow = '0 2px 8px rgba(15,23,42,0.02)'; }}
            />
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              onClick={() => setShowFilters((p) => !p)}
              className="filter-button"
              style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: showFilters ? 'var(--color-accent)' : 'var(--color-text-secondary)', boxShadow: '0 2px 8px rgba(15,23,42,0.02)', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-background-primary)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              <span className="hide-mobile">Filtros</span> {(filter !== 'all' || categoryFilter !== 'all') && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)' }} />}
            </button>
            <div className="visible-counter" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-background-primary)', padding: '8px 16px', borderRadius: 999, border: '0.5px solid var(--color-border-tertiary)', boxShadow: '0 2px 8px rgba(15,23,42,0.02)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-text-info)', display: 'inline-block' }} />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>{tasks.length}</strong><span className="hide-mobile"> de {total}</span>
              </span>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="filters-panel">
            <div className="filter-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.4)', padding: '6px 10px', borderRadius: 16 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 65, textAlign: 'right' }}>Etapa</span>
              <div style={{ width: 1, height: 16, background: 'var(--color-border-secondary)' }} />
              <Chip label="Todas" count={total} active={filter === 'all'} onClick={() => setFilter('all')} />
              {STATUS.map((s) => (
                <Chip key={s.v} label={s.label} count={cnt[s.v]} active={filter === s.v} onClick={() => setFilter(filter === s.v ? 'all' : s.v)} colorVar={s.tv} />
              ))}
            </div>

            {categories.length > 0 && (
              <div className="filter-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.4)', padding: '6px 10px', borderRadius: 16 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 65, textAlign: 'right' }}>Etiqueta</span>
                <div style={{ width: 1, height: 16, background: 'var(--color-border-secondary)' }} />
                <Chip label="Todas" count={total} active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} />
                {categories.map((cat) => (
                  <Chip key={cat} label={cat} count={catCount[cat] || 0} active={categoryFilter === cat} onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)} colorVar="--color-text-info" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
          {searchQuery ? 'No hay tareas que coincidan con tu búsqueda.' : filter !== 'all' ? 'No hay tareas con este filtro.' : 'Sin tareas aún. Usa el campo inferior para crear la primera!'}
        </div>
      ) : (
        <div className="task-list" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onClick={() => onEdit(t)}
              onToggleDone={onToggleDone}
              onToggleSubtaskDone={onToggleSubtaskDone}
              onReorderSubtasks={onReorderSubtasks}
            />
          ))}
        </div>
      )}

      <form
        onSubmit={handleQuickSubmit}
        className="quick-add"
        style={{ 
          marginTop: 24, 
          position: 'sticky', 
          bottom: 'calc(20px + env(safe-area-inset-bottom))', 
          zIndex: 10, 
          background: 'var(--color-background-primary)', 
          borderRadius: 999, 
          padding: '6px 6px 6px 20px', 
          display: 'flex', 
          gap: 10, 
          alignItems: 'center', 
          boxShadow: '0 10px 40px -10px rgba(15,23,42,0.15)', 
          border: '1px solid var(--color-border-tertiary)', 
          transition: 'box-shadow 0.2s' 
        }}
        onFocus={(e) => (e.currentTarget.style.boxShadow = '0 15px 50px -10px rgba(37,99,235,0.2)')}
        onBlur={(e) => (e.currentTarget.style.boxShadow = '0 10px 40px -10px rgba(15,23,42,0.15)')}
      >
        <span style={{ color: 'var(--color-accent)', fontSize: 18 }}>+</span>
        <input
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          placeholder="Escribe una tarea y presiona Enter..."
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, outline: 'none', color: 'var(--color-text-primary)' }}
        />
        <button
          type="button"
          onClick={handleQuickAISubmit}
          disabled={!quickText.trim() || quickAiLoading}
          style={{ background: quickText.trim() && !quickAiLoading ? 'var(--color-background-info)' : 'var(--color-background-secondary)', color: quickText.trim() && !quickAiLoading ? 'var(--color-text-info)' : 'var(--color-text-secondary)', border: 'none', padding: '10px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: quickText.trim() && !quickAiLoading ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
        >
          {quickAiLoading ? 'IA...' : 'IA'}
        </button>
        <button
          type="submit"
          disabled={!quickText.trim()}
          style={{ background: quickText.trim() ? 'var(--color-accent)' : 'var(--color-background-secondary)', color: quickText.trim() ? 'white' : 'var(--color-text-secondary)', border: 'none', padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: quickText.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
        >
          Añadir
        </button>
      </form>
      {quickFeedback && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>{quickFeedback}</div>
      )}
    </div>
  );
}
