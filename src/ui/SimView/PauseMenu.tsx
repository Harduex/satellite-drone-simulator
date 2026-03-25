import { useState } from 'react';
import { ControllerSetup } from '../Settings/ControllerSetup';
import { PhysicsSettings } from '../Settings/PhysicsSettings';
import css from './PauseMenu.module.css';

interface Props {
  onResume: () => void;
  onSaveCurrentAsDefault: () => void;
  onChangeLocation: () => void;
}

type SettingsTab = 'controller' | 'physics';

export function PauseMenu(
  { onResume, onSaveCurrentAsDefault, onChangeLocation }: Props,
) {
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('controller');

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
          </div>

          {/* Tab content */}
          {activeTab === 'controller' && (
            <ControllerSetup onClose={() => setShowSettings(false)} />
          )}
          {activeTab === 'physics' && (
            <PhysicsSettings onClose={() => setShowSettings(false)} />
          )}
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
        <button onClick={onChangeLocation} className={css.ghostButton}>Change Location</button>
      </div>
    </div>
  );
}
