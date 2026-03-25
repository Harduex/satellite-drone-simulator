import { HUD } from './HUD';
import { PauseMenu } from './PauseMenu';
import { CrashFlash } from './CrashFlash';
import type { SimSession } from '../../game/SimSession';
import styles from './SimView.module.css';

interface Props {
  session: SimSession;
  isPaused: boolean;
}

export function SimView({ session, isPaused }: Props) {
  return (
    <div className={styles.root}>
      {/* CesiumJS canvas is behind this in #cesium-container */}
      <HUD locationName={session.getSpawnOrigin()?.name ?? ''} />
      <CrashFlash />
      {isPaused && (
        <PauseMenu
          onResume={() => session.resume()}
          onSaveCurrentAsDefault={() => session.saveCurrentLocationAsDefault()}
          onChangeLocation={() => session.changeLocationFromPause()}
        />
      )}
    </div>
  );
}
