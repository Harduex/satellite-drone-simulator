import { useState } from 'react';
import { ControllerSetup } from '../Settings/ControllerSetup';

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
          background: '#2a2a3e',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '500px',
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
        <h2 style={{ color: '#e0e0e0', fontWeight: 300, marginBottom: '8px' }}>Paused</h2>
        <button onClick={onResume} style={buttonStyle}>
          Resume
        </button>
        <button onClick={() => setShowSettings(true)} style={buttonStyle}>
          Controller Setup
        </button>
        <button onClick={onChangeLocation} style={{ ...buttonStyle, background: '#3a3a4e' }}>
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
  background: 'rgba(0, 0, 0, 0.5)',
  zIndex: 20,
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 40px',
  fontSize: '1rem',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  background: '#00ff88',
  color: '#1a1a2e',
  fontWeight: 600,
  width: '200px',
};
