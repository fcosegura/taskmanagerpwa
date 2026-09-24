import './QuickModeView.css';

export default function ModeSelector({ onSelectFull, onSelectQuick }) {
  return (
    <main className="mode-selector-shell">
      <div className="mode-selector-card material-elevated">
        <h1 className="mode-selector-title">¿Cómo quieres empezar?</h1>
        <p className="mode-selector-subtitle">Elige un modo. Puedes cambiarlo cuando quieras.</p>
        <div className="mode-selector-options">
          <button type="button" className="mode-option-card" onClick={onSelectFull} autoFocus>
            <span className="mode-option-title">Modo completo</span>
            <span className="mode-option-desc">Todas las vistas y funciones</span>
          </button>
          <button type="button" className="mode-option-card" onClick={onSelectQuick}>
            <span className="mode-option-title">Modo rápido</span>
            <span className="mode-option-desc">Tu día de un vistazo</span>
          </button>
        </div>
      </div>
    </main>
  );
}
