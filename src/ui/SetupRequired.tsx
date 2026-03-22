export function SetupRequired() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: '#e0e0e0',
      padding: '2rem',
      maxWidth: '600px',
      margin: '0 auto',
      gap: '1.5rem',
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 300, color: '#00ff88' }}>
        FPV Drone Simulator
      </h1>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 400, opacity: 0.8 }}>
        API Key Required
      </h2>

      <div style={{
        background: '#2a2a3e',
        borderRadius: '8px',
        padding: '1.5rem',
        width: '100%',
        fontSize: '0.9rem',
        lineHeight: 1.6,
      }}>
        <p style={{ margin: '0 0 1rem' }}>
          Create a <code style={codeStyle}>.env</code> file in the project root:
        </p>
        <pre style={{
          background: '#1a1a2e',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '0.85rem',
          fontFamily: "'Fira Code', 'Cascadia Code', monospace",
        }}>
{`VITE_GOOGLE_MAPS_API_KEY=your_key_here`}
        </pre>

        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ fontWeight: 600, color: '#00ff88', margin: '0 0 0.5rem' }}>
            Google Maps Platform
          </p>
          <p style={{ margin: '0 0 0.25rem', opacity: 0.8 }}>
            Enable: Maps JavaScript API, Places API, Map Tiles API
          </p>
          <p style={{ margin: '0', opacity: 0.6 }}>
            console.cloud.google.com
          </p>
        </div>
      </div>

      <p style={{ opacity: 0.5, fontSize: '0.8rem' }}>
        Restart the dev server after adding the key.
      </p>
    </div>
  );
}

const codeStyle = {
  background: '#1a1a2e',
  padding: '2px 6px',
  borderRadius: '3px',
  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
  fontSize: '0.85rem',
};
