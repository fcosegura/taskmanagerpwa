import { Button as UiButton, IconButton as UiIconButton, Input as UiInput, Modal as UiModal, Sheet as UiSheet } from '../ui/index.jsx';

export const Button = UiButton;
export const IconButton = UiIconButton;
export const Input = UiInput;
export const Modal = UiModal;
export const Sheet = UiSheet;

export function Pill({ s, fixedWidth = null }) {
  const className = fixedWidth ? `pill pill--fixed` : 'pill';
  return (
    <span
      className={className}
      style={{
        background: `var(${s.bv})`,
        color: `var(${s.tv})`,
        minWidth: fixedWidth || undefined,
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

export function NBtn({ onClick, children, label }) {
  return (
    <UiIconButton onClick={onClick} label={label}>
      {children}
    </UiIconButton>
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
