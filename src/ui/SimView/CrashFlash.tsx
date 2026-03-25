import { useStore } from '../../store';
import styles from './CrashFlash.module.css';

/** Red flash overlay for crash feedback. Driven by Zustand store. */
export function CrashFlash() {
  const visible = useStore((s) => s.crashFlashActive);

  if (!visible) return null;

  return <div className={styles.overlay} />;
}
