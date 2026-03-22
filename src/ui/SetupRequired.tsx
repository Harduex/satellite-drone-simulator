import { colors, fonts, fontSizes, spacing } from './theme';

export function SetupRequired() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: colors.on_surface,
      fontFamily: fonts.body,
      padding: spacing.xl,
      maxWidth: '600px',
      margin: '0 auto',
      gap: spacing.lg,
    }}>
      <h1 style={{ fontSize: fontSizes.display_lg, fontWeight: 300, color: colors.primary, fontFamily: fonts.display }}>
        FPV Drone Simulator
      </h1>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 400, opacity: 0.8, fontFamily: fonts.display }}>
        API Key Required
      </h2>

      <div style={{
        background: colors.surface_container_high,
        borderRadius: 0,
        padding: spacing.lg,
        width: '100%',
        fontSize: fontSizes.body_md,
        lineHeight: 1.6,
      }}>
        <p style={{ margin: '0 0 1rem' }}>
          Create a <code style={codeStyle}>.env</code> file in the project root:
        </p>
        <pre style={{
          background: colors.surface,
          padding: spacing.md,
          borderRadius: 0,
          overflow: 'auto',
          fontSize: fontSizes.body_sm,
          fontFamily: "'Fira Code', 'Cascadia Code', monospace",
        }}>
{`VITE_GOOGLE_MAPS_API_KEY=your_key_here`}
        </pre>

        <div style={{ marginTop: spacing.lg }}>
          <p style={{ fontWeight: 600, color: colors.secondary, margin: '0 0 0.5rem' }}>
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

      <p style={{ opacity: 0.5, fontSize: fontSizes.body_sm }}>
        Restart the dev server after adding the key.
      </p>
    </div>
  );
}

const codeStyle = {
  background: colors.surface,
  padding: '2px 6px',
  borderRadius: 0,
  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
  fontSize: fontSizes.body_sm,
};
