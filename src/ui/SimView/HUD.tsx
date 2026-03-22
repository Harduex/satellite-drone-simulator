import { useStore } from '../../store';

const MONO = "'Fira Code', 'Cascadia Code', 'SF Mono', monospace";

interface Props {
  locationName: string;
}

export function HUD({ locationName }: Props) {
  const speed = useStore((s) => s.speed);
  const altitudeAGL = useStore((s) => s.altitudeAGL);
  const batteryPercent = useStore((s) => s.batteryPercent);
  const batteryVoltage = useStore((s) => s.batteryVoltage);
  const throttle = useStore((s) => s.throttle);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 10,
      fontFamily: MONO,
    }}>
      {/* Top-left: location name */}
      <div style={{ position: 'absolute', top: 16, left: 16, ...textStyle }}>
        {locationName}
      </div>

      {/* Bottom-left: throttle bar */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '6px',
      }}>
        <div style={{
          width: 12,
          height: 120,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 3,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          <div style={{
            width: '100%',
            height: `${throttle * 100}%`,
            background: throttle > 0.8 ? '#ff4444' : '#00ff88',
            borderRadius: 3,
            transition: 'height 0.05s',
          }} />
        </div>
        <span style={{ ...textStyle, fontSize: '0.7rem' }}>
          {(throttle * 100).toFixed(0)}%
        </span>
      </div>

      {/* Bottom-center: speed + altitude */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        ...textStyle,
      }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>
          {speed.toFixed(1)} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>m/s</span>
        </div>
        <div style={{ fontSize: '1rem', opacity: 0.8 }}>
          {altitudeAGL.toFixed(1)} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>m AGL</span>
        </div>
      </div>

      {/* Bottom-right: battery */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        textAlign: 'right',
        ...textStyle,
      }}>
        <div style={{
          fontSize: '1rem',
          color: batteryPercent < 20 ? '#ff4444' : batteryPercent < 40 ? '#ffaa00' : '#e0e0e0',
        }}>
          {batteryPercent.toFixed(0)}%
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          {batteryVoltage.toFixed(1)}V
        </div>
      </div>

      {/* Keyboard controls hint (visible when first flying) */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        ...textStyle,
        fontSize: '0.65rem',
        opacity: 0.3,
      }}>
        W/S: throttle | A/D: yaw | Arrows: roll/pitch | ESC: pause
      </div>
    </div>
  );
}

const textStyle = {
  color: '#e0e0e0',
  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
  fontSize: '0.85rem',
};
