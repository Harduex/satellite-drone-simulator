import styles from './SetupRequired.module.css';

export function SetupRequired() {
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>FPV Drone Simulator</h1>
      <h2 className={styles.subtitle}>API Configuration Required</h2>

      <div className={styles.card}>
        <p style={{ margin: '0 0 1rem' }}>
          Create a <code className={styles.code}>.env</code> file in the project root:
        </p>
        <pre className={styles.preBlock}>
{`VITE_GOOGLE_MAPS_API_KEY=your_key_here
VITE_CESIUM_ION_ACCESS_TOKEN=your_token_here`}
        </pre>

        <div style={{ marginTop: 'var(--space-lg)' }}>
          <p className={styles.sectionTitle}>Google Maps Platform</p>
          <p style={{ margin: '0 0 0.25rem', opacity: 0.8 }}>
            Enable: Maps JavaScript API, Places API, Elevation API
          </p>
          <p style={{ margin: '0', opacity: 0.6 }}>
            console.cloud.google.com
          </p>
        </div>
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <p className={styles.sectionTitle}>Cesium ion</p>
          <p style={{ margin: '0 0 0.25rem', opacity: 0.8 }}>
            Add Google Photorealistic 3D Tiles to My Assets and use a token with access to it and Cesium World Imagery.
          </p>
          <p style={{ margin: '0', opacity: 0.6 }}>ion.cesium.com</p>
        </div>
      </div>

      <p className={styles.hint}>
        Restart the dev server after adding the key and token.
      </p>
    </div>
  );
}
