import css from './controls.module.css';
export function FlightBrand() {
  return <div className={css.brand}>
    <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m8 8 20 20M28 8 8 28" /><circle cx="8" cy="8" r="5" /><circle cx="28" cy="8" r="5" />
      <circle cx="8" cy="28" r="5" /><circle cx="28" cy="28" r="5" /><path d="m15 14h6l1 8h-8z" fill="currentColor" />
    </svg><span>FPV / FLIGHT DECK<small>The world is your flight line</small></span>
  </div>;
}
