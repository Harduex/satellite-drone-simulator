import { useStore } from '../../store';
import { colors } from '../theme';
import css from './HUD.module.css';

interface Props {
  locationName: string;
}

export function HUD({ locationName }: Props) {
  const windSpeed = useStore(s => s.windSpeed);
  const windTravelHeading = useStore(s => s.windTravelHeading);
  const heading = useStore(s => s.navigation?.heading ?? 0);
  const speed = useStore((s) => s.speed);
  const altitudeAGL = useStore((s) => s.altitudeAGL);
  const throttle = useStore((s) => s.throttle);
  const cacheOnlyPractice = useStore(s => s.cacheOnlyPractice);

  return (
    <div className={css.root}>
      {/* Top-left: location name */}
      <div className={css.locationName}>{locationName}</div>
      {cacheOnlyPractice && <div className={css.practiceBadge}>Cache-only practice · 3D streaming off</div>}

      <div className={css.windIndicator} aria-label={`Airflow travel: ${windSpeed.toFixed(1)} meters per second`}>
        {windSpeed > 0.05 && <span className={css.windArrow} aria-hidden="true" style={{ transform: `rotate(${windTravelHeading - heading}deg)` }}>&#8593;</span>}
        <span>Airflow {windSpeed.toFixed(1)} m/s</span>
      </div>

      {/* Bottom-left: throttle bar */}
      <div className={css.throttleGroup}>
        <div className={css.throttleTrack}>
          <div
            className={css.throttleFill}
            style={{
              height: `${throttle * 100}%`,
              background: throttle > 0.8 ? colors.error : colors.primary,
            }}
          />
        </div>
        <span className={css.throttleLabel}>
          {(throttle * 100).toFixed(0)}%
        </span>
      </div>

      {/* Bottom-center: speed + altitude */}
      <div className={css.telemetryCenter}>
        <div className={css.speedValue}>
          {speed.toFixed(1)} <span className={css.unitLabel}>m/s</span>
        </div>
        <div className={css.altValue}>
          {altitudeAGL.toFixed(1)} <span className={css.unitLabel}>m AGL</span>
        </div>
      </div>

      {/* Keyboard controls hint */}
      <div className={css.controlsHint}>
        W/S: throttle | A/D: yaw | Arrows: roll/pitch | ESC: pause
      </div>
    </div>
  );
}
