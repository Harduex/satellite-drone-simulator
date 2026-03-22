import { useStore } from '../../store';
import { colors } from '../theme';

/** Red flash overlay for crash feedback. Driven by Zustand store. */
export function CrashFlash() {
  const visible = useStore((s) => s.crashFlashActive);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: colors.crash_flash,
      zIndex: 15,
      pointerEvents: 'none',
    }} />
  );
}
