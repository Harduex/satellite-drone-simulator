import { useStore } from '../../store';
import css from './FlightMinimap.module.css';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  error: string | null;
}

export function FlightMinimap({ collapsed, onToggle, error }: Props) {
  const navigation = useStore(s => s.navigation);
  const distance = navigation?.homeDistance ?? 0;
  return <>
    <header className={css.header}>
      <span className={css.label}>NAV <span className={css.north} title="North"><span style={{ display: 'inline-block', transform: `rotate(${-(navigation?.heading ?? 0)}deg)` }}>↑</span> N</span></span>
      <button type="button" onClick={onToggle} aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show minimap' : 'Hide minimap'} className={css.toggle}>
        {collapsed ? '+' : '−'}
      </button>
    </header>
    {!collapsed && <>
      {error && <div role="status" className={css.error}>Map unavailable · home guidance still active</div>}
      <footer className={css.footer}>
        <span className={css.homeGuidance} title="Horizontal distance and direction to launch point">
          <span className={css.homeArrow} style={{ transform: `rotate(${navigation?.homeDirection ?? 0}deg)` }}>↑</span>
          HOME <strong>{distance < 1000 ? `${distance.toFixed(0)} m` : `${(distance / 1000).toFixed(1)} km`}</strong>
        </span>
        <span className={css.heading}>{(navigation?.heading ?? 0).toFixed(0).padStart(3, '0')}°</span>
      </footer>
    </>}
  </>;
}
