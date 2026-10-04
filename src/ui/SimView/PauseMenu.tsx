import { useEffect, useRef, useState } from 'react';
import { ControllerSetup } from '../Settings/ControllerSetup';
import { PhysicsSettings } from '../Settings/PhysicsSettings';
import { FlightSettings } from '../Settings/FlightSettings';
import css from './PauseMenu.module.css';

interface Props {
  onResume: () => void;
  onSaveCurrentAsDefault: () => void;
  onCopyLocation: () => Promise<boolean>;
  onChangeLocation: () => Promise<void>;
}

type SettingsTab = 'controller' | 'physics' | 'flight';

const COPY_FEEDBACK_MS = 1500;

export function PauseMenu(
  { onResume, onSaveCurrentAsDefault, onCopyLocation, onChangeLocation }: Props,
) {
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('controller');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const handleCopy = async () => {
    const ok = await onCopyLocation();
    setCopyState(ok ? 'copied' : 'failed');
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
  };

  if (showSettings) {
    return (
      <div className={css.overlay}>
        <div className={css.settingsPanel}>
          {/* Tab bar */}
          <div className={css.tabBar}>
            <button
              onClick={() => setActiveTab('controller')}
              className={`${css.tab} ${activeTab === 'controller' ? css.active : ''}`}
            >
              Controller
            </button>
            <button
              onClick={() => setActiveTab('physics')}
              className={`${css.tab} ${activeTab === 'physics' ? css.active : ''}`}
            >
              Physics
            </button>
            <button onClick={() => setActiveTab('flight')}
              className={`${css.tab} ${activeTab === 'flight' ? css.active : ''}`}>Flight</button>
          </div>

          {/* Tab content */}
          {activeTab === 'controller' && (
            <ControllerSetup onClose={() => setShowSettings(false)} />
          )}
          {activeTab === 'physics' && (
            <PhysicsSettings onClose={() => setShowSettings(false)} />
          )}
          {activeTab === 'flight' && <FlightSettings onClose={() => setShowSettings(false)} />}
        </div>
      </div>
    );
  }

  return (
    <div className={css.overlay}>
      <div className={css.menuGroup}>
        <h2 className={css.pausedTitle}>Paused</h2>
        <button onClick={onResume} className={css.resumeButton}>Resume</button>
        <button onClick={() => setShowSettings(true)} className={css.ghostButton}>Settings</button>
        <button onClick={onSaveCurrentAsDefault} className={css.ghostButton}>Save Current As Default</button>
        <button onClick={handleCopy} className={css.ghostButton}>
          {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy Location'}
        </button>
        <button onClick={onChangeLocation} className={css.ghostButton}>Change Location</button>
      </div>
    </div>
  );
}
