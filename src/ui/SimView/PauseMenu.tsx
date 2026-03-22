import { useState } from 'react';
import { ControllerSetup } from '../Settings/ControllerSetup';
import { colors, fonts, fontSizes, gradients, spacing, glass } from '../theme';

interface Props {
  onResume: () => void;
  onChangeLocation: () => void;
}

export function PauseMenu({ onResume, onChangeLocation }: Props) {
  const [showSettings, setShowSettings] = useState(false);

  if (showSettings) {
    return (
      <div style={overlayStyle}>
        <div style={{
          background: colors.surface_container_low,
          borderRadius: 0,
          padding: spacing.xl,
          maxWidth: '560px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}>
          <ControllerSetup onClose={() => setShowSettings(false)} />
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}>
        <h2 style={{
          color: colors.on_surface,
          fontWeight: 300,
          marginBottom: '8px',
          fontFamily: fonts.display,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>Paused</h2>
        <button onClick={onResume} style={resumeButtonStyle}>
          Resume
        </button>
        <button onClick={() => setShowSettings(true)} style={ghostButtonStyle}>
          Controller Setup
        </button>
        <button onClick={onChangeLocation} style={ghostButtonStyle}>
          Change Location
        </button>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: glass.background,
  backdropFilter: glass.backdropFilter,
  zIndex: 20,
};

const resumeButtonStyle: React.CSSProperties = {
  padding: '12px 40px',
  fontSize: fontSizes.display_sm,
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  background: gradients.cta,
  color: colors.on_primary,
  fontWeight: 600,
  width: '200px',
};

const ghostButtonStyle: React.CSSProperties = {
  padding: '12px 40px',
  fontSize: fontSizes.display_sm,
  border: '1px solid ' + colors.outline_variant,
  borderRadius: 0,
  cursor: 'pointer',
  background: 'transparent',
  color: colors.on_surface,
  fontWeight: 600,
  width: '200px',
};
