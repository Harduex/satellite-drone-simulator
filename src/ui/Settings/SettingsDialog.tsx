import { useEffect, useId, useRef, useState } from 'react';
import { ControllerSetup } from './ControllerSetup';
import { PhysicsSettings } from './PhysicsSettings';
import { FlightSettings } from './FlightSettings';
import { SettingsPanelHeader } from './shared';
import { useStore } from '../../store';
import css from './SettingsDialog.module.css';
import controls from '../controls.module.css';

type Category = 'flight' | 'controller' | 'advanced' | 'developer';
interface Props { onClose: () => void; onExportTelemetry?: () => void; initialCategory?: Category }

export function SettingsDialog({ onClose, onExportTelemetry, initialCategory = 'flight' }: Props) {
  const [category, setCategory] = useState<Category>(initialCategory);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const title = useId();
  const diagnostics = useStore(s => s.diagnosticsVisible);
  const toggleDiagnostics = useStore(s => s.toggleDiagnostics);

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current!;
    element.showModal();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); close.current();
      }
      if (event.key !== 'Tab') return;
      const focusable = [...element.querySelectorAll<HTMLElement>(':is(button, input, select, a[href]):not(:disabled)')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keyboard, true);
    return () => {
      window.removeEventListener('keydown', keyboard, true);
      element.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);

  const navigation = (key: Category, label: string) => (
    <button type="button" key={key} className={css.category} aria-current={category === key ? 'page' : undefined}
      onClick={() => setCategory(key)}>{label}</button>
  );

  return (
    <dialog ref={dialog} className={css.dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className={css.layout}>
        <aside className={css.sidebar}>
          <span className={controls.eyebrow}>Flight deck / Preferences</span>
          <h1 id={title}>Make it yours.</h1>
          <nav aria-label="Settings categories">
            {navigation('flight', 'Flight & environment')}
            {navigation('controller', 'Controller')}
            <p className={controls.eyebrow}>Advanced</p>
            {navigation('advanced', 'Aircraft tuning')}
            {navigation('developer', 'Developer tools')}
          </nav>
          <p className={css.note}>Changes save automatically.<br />Your flight stays paused.</p>
        </aside>
        <div className={css.content}>
          {category === 'flight' && <FlightSettings onClose={onClose} />}
          {category === 'controller' && <ControllerSetup onClose={onClose} />}
          {category === 'advanced' && <PhysicsSettings onClose={onClose} />}
          {category === 'developer' && <div>
            <SettingsPanelHeader title="Developer tools" onClose={onClose} />
            <p className={css.note}>Diagnostics and flight troubleshooting.</p>
            <label className={css.toggle}><span>World diagnostics<small>Frame timing, tile streaming and actor statistics.</small></span>
              <input type="checkbox" role="switch" aria-label="World diagnostics" checked={diagnostics} onChange={toggleDiagnostics} />
            </label>
            <p className={css.note}>Cache-only practice is available in the diagnostics panel during a flight. Shortcut: Ctrl + Shift + D.</p>
            {onExportTelemetry ? <button className={controls.secondary} onClick={onExportTelemetry}>Export Telemetry</button>
              : <p className={css.note}>Start a flight to export telemetry.</p>}
          </div>}
          <footer className={css.footer}><button className={controls.primary} onClick={onClose}>Done</button><span>ESC to close</span></footer>
        </div>
      </div>
    </dialog>
  );
}
