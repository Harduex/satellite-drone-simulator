import { HUD } from './HUD';
import { PauseMenu } from './PauseMenu';
import { CrashFlash } from './CrashFlash';
import type { SimSession } from '../../game/SimSession';

interface Props {
  session: SimSession;
  isPaused: boolean;
}

export function SimView({ session, isPaused }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {/* CesiumJS canvas is behind this in #cesium-container */}
      <HUD locationName={session.getSpawnOrigin()?.name ?? ''} />
      <CrashFlash />
      {isPaused && (
        <PauseMenu
          onResume={() => session.resume()}
          onChangeLocation={() => session.endSession()}
        />
      )}
    </div>
  );
}
