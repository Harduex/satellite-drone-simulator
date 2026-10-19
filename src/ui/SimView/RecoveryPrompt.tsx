import { useStore } from '../../store';
import styles from './RecoveryPrompt.module.css';

export function RecoveryPrompt() {
  const condition = useStore(s => s.flightCondition);
  const unavailable = useStore(s => s.recoveryUnavailable);
  if (unavailable) return <div className={styles.status} role="status">Surface data unavailable · press Space to retry</div>;
  if (condition === 'disabled') return <div className={styles.status} role="status">Drone damaged · motors disabled · Space to recover</div>;
  return null;
}
