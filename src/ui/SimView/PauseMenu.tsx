import { useEffect, useRef, useState } from 'react';
import { SettingsDialog } from '../Settings/SettingsDialog';
import { DronePreview } from './DronePreview';
import { FlightBrand } from '../FlightBrand';
import { useStore } from '../../store';
import controls from '../controls.module.css';
import css from './PauseMenu.module.css';

interface Props {
  onResume: () => void;
  onSaveCurrentAsDefault: () => void;
  onCopyLocation: () => Promise<boolean>;
  onExportTelemetry?: () => void;
  onChangeLocation: () => Promise<void>;
  onRestart?: () => void;
  onRandomLocation?: () => Promise<void>;
}

const COPY_FEEDBACK_MS = 1500;

export function PauseMenu(
  { onResume, onSaveCurrentAsDefault, onCopyLocation, onExportTelemetry, onChangeLocation, onRestart, onRandomLocation }: Props,
) {
  const [settings, setSettings] = useState<'flight' | 'developer' | null>(null);
  const resumeButton = useRef<HTMLButtonElement>(null);
  const locationName = useStore(s => s.location?.name);
  useEffect(() => { resumeButton.current?.focus(); }, []);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [randomizing, setRandomizing] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const handleCopy = async () => {
    let ok = false;
    try { ok = await onCopyLocation(); } catch { ok = false; }
    setCopyState(ok ? 'copied' : 'failed');
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
  };

  const handleRandomLocation = async () => {
    if (randomizing || !onRandomLocation) return;
    setRandomizing(true);
    setRandomError(null);
    try {
      await onRandomLocation();
    } catch {
      setRandomError('Unable to load a random location. Retry or choose Change Location.');
    } finally {
      setRandomizing(false);
    }
  };

  return (
    <div className={css.overlay}>
      <div className={css.shell}>
        <header className={css.header}><FlightBrand /><span className={controls.eyebrow}>Flight on hold</span></header>
        <div className={css.layout}>
          {!settings && <DronePreview />}
          <section className={css.menuGroup} aria-label="Paused flight">
            <span className={controls.eyebrow}>Paused / {locationName || 'Your flight'}</span>
            <h1 className={css.pausedTitle}>Take a breath.</h1>
            <button ref={resumeButton} onClick={onResume} disabled={randomizing || randomError !== null} className={`${controls.primary} ${css.resumeButton}`}>Resume</button>
            {onRestart && <button onClick={onRestart} disabled={randomizing || randomError !== null} className={controls.secondary}>Restart from home</button>}
            <div className={css.actionSection}>
              <p className={css.sectionLabel}>Find your next line</p>
              <div className={css.destinations}>
                <button onClick={onChangeLocation} disabled={randomizing} className={controls.secondary}>Change Location</button>
                {onRandomLocation && <button onClick={handleRandomLocation} disabled={randomizing} className={controls.secondary}>{randomizing ? 'Loading...' : 'Random Location'}</button>}
              </div>
            </div>
            {randomError && <p role="alert" className={css.error}>{randomError}</p>}
            <div className={css.locationTools}>
              <button onClick={onSaveCurrentAsDefault} disabled={randomizing || randomError !== null} className={controls.quiet}>Save Current As Default</button>
              <button onClick={handleCopy} disabled={randomizing || randomError !== null} className={controls.quiet}>
                {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy Location'}
              </button>
            </div>
            <div className={css.menuBottom}>
              <button onClick={() => setSettings('flight')} className={controls.quiet}>Settings</button>
              <button onClick={() => setSettings('developer')} className={controls.quiet}>Developer tools</button>
            </div>
          </section>
        </div>
      </div>
      {settings && <SettingsDialog initialCategory={settings} onClose={() => setSettings(null)} onExportTelemetry={onExportTelemetry} />}
    </div>
  );
}
