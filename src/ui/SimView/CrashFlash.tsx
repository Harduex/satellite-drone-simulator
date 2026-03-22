import { useState, useEffect, useCallback } from 'react';

/** Red flash overlay for crash feedback */
export function CrashFlash() {
  const [visible, setVisible] = useState(false);

  const flash = useCallback(() => {
    setVisible(true);
    setTimeout(() => setVisible(false), 200);
  }, []);

  // Expose globally so GameLoop can trigger it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__fpvsim_crash_flash = flash;
    return () => {
      delete (window as unknown as Record<string, unknown>).__fpvsim_crash_flash;
    };
  }, [flash]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(255, 0, 0, 0.4)',
      zIndex: 15,
      pointerEvents: 'none',
      animation: 'crashFade 200ms ease-out forwards',
    }} />
  );
}

/** Call this from non-React code to trigger the crash flash */
export function triggerCrashFlash(): void {
  const fn = (window as unknown as Record<string, unknown>).__fpvsim_crash_flash;
  if (typeof fn === 'function') fn();
}
