import { useEffect, useRef, useState } from 'react';
import type { DronePreviewRenderer } from '../../world/DronePreviewRenderer';
import { useStore } from '../../store';
import css from './DronePreview.module.css';
import controls from '../controls.module.css';

export function DronePreview() {
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<DronePreviewRenderer | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const mass = useStore(s => s.physicsConfig.mass);
  const diameter = useStore(s => s.physicsConfig.rotorDiameter);

  useEffect(() => {
    let disposed = false;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => renderer.current?.setReducedMotion(motion.matches);
    const fail = () => { if (!disposed) { renderer.current?.destroy(); renderer.current = null; setState('failed'); } };
    setState('loading');
    void import('../../world/DronePreviewRenderer').then(async ({ DronePreviewRenderer }) => {
      if (disposed) return;
      renderer.current = new DronePreviewRenderer(container.current!, fail);
      updateMotion();
      await renderer.current.load();
      if (!disposed && renderer.current) setState('ready');
    }).catch(fail);
    motion.addEventListener('change', updateMotion);
    return () => { disposed = true; motion.removeEventListener('change', updateMotion); renderer.current?.destroy(); renderer.current = null; };
  }, [attempt]);

  return <section className={css.preview} aria-label="Your aircraft">
    <div><span className={controls.eyebrow}>Your aircraft / 01</span><h2>Freestyle quad</h2><p>Racing airframe · Representative preview</p></div>
    <div className={css.stage} onPointerMove={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      renderer.current?.setPointer((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1);
    }} onPointerLeave={() => renderer.current?.setPointer(0, 0)}>
      <div ref={container} className={css.canvas} />
      {state === 'loading' && <span role="status" className={css.message}>Loading aircraft…</span>}
      {state === 'failed' && <div className={css.message}><p>Preview unavailable. Your flight is unaffected.</p>
        <button className={controls.secondary} onClick={() => setAttempt(value => value + 1)}>Retry preview</button></div>}
    </div>
    <p className={css.pointerHint}>Move your pointer to look around</p>
    <dl className={css.specs}><div><dt>Propellers</dt><dd>{((diameter ?? 0.1295) / 0.0254).toFixed(1)}″</dd></div><div><dt>Mass</dt><dd>{mass.toFixed(3)} kg</dd></div><div><dt>Flight mode</dt><dd>ACRO</dd></div></dl>
    <p className={css.credit}>Model: <a href="https://sketchfab.com/3d-models/racing-drone-lite-graphics-version-370fa7dd443c409789c9b0a2794a61ac" target="_blank" rel="noreferrer">BlueMesh</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>
  </section>;
}
