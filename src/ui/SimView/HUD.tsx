import { useStore } from '../../store';
import { colors, fontSizes, hud } from '../theme';

interface Props {
  locationName: string;
}

export function HUD({ locationName }: Props) {
  const speed = useStore((s) => s.speed);
  const altitudeAGL = useStore((s) => s.altitudeAGL);
  const throttle = useStore((s) => s.throttle);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 10,
      fontFamily: hud.fontFamily,
    }}>
      {/* Top-left: location name */}
      <div style={{ position: 'absolute', top: 16, left: 16, ...textStyle, ...hud.labelStyle }}>
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
          background: colors.surface_container_lowest + '80',
          borderRadius: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          <div style={{
            width: '100%',
            height: `${throttle * 100}%`,
            background: throttle > 0.8 ? colors.error : colors.primary,
            borderRadius: 0,
            transition: 'height 0.05s',
          }} />
        </div>
        <span style={{
          ...textStyle,
          ...hud.labelStyle,
          fontFeatureSettings: hud.fontFeatureSettings,
        }}>
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
        <div style={{
          fontSize: fontSizes.display_md,
          fontWeight: 600,
          fontFamily: hud.fontFamily,
          fontFeatureSettings: hud.fontFeatureSettings,
        }}>
          {speed.toFixed(1)} <span style={{ ...hud.labelStyle }}>m/s</span>
        </div>
        <div style={{
          fontSize: fontSizes.display_sm,
          opacity: 0.8,
          fontFamily: hud.fontFamily,
          fontFeatureSettings: hud.fontFeatureSettings,
        }}>
          {altitudeAGL.toFixed(1)} <span style={{ ...hud.labelStyle }}>m AGL</span>
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
  color: colors.on_surface,
  textShadow: hud.textShadow,
  fontSize: fontSizes.body_sm,
};
