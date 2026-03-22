import { useState } from 'react';
import { ControllerSetup } from '../Settings/ControllerSetup';
import { PhysicsSettings } from '../Settings/PhysicsSettings';
import { colors, fonts, fontSizes, gradients, spacing, glass } from '../theme';

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
          {/* Tab bar */}
          <div style={{
            display: 'flex',
            gap: '0',
            marginBottom: spacing.md,
            borderBottom: '1px solid ' + colors.outline_variant,
          }}>
            <button
              onClick={() => setActiveTab('controller')}
              style={tabStyle(activeTab === 'controller')}
            >
              Controller
            </button>
            <button
              onClick={() => setActiveTab('physics')}
              style={tabStyle(activeTab === 'physics')}
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
          Settings
        </button>
        <button onClick={onSaveCurrentAsDefault} style={ghostButtonStyle}>
          Save Current As Default
        </button>
        <button onClick={onChangeLocation} style={ghostButtonStyle}>
          Change Location
        </button>
      </div>
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 20px',
    fontSize: fontSizes.body_md,
    border: 'none',
    borderBottom: active ? '2px solid ' + colors.primary : '2px solid transparent',
    borderRadius: 0,
    cursor: 'pointer',
    background: 'transparent',
    color: active ? colors.primary : colors.on_surface_variant,
    fontWeight: active ? 600 : 400,
    transition: 'color 0.15s, border-color 0.15s',
  };
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
