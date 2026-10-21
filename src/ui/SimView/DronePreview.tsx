import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import type { DronePreviewRenderer } from '../../world/DronePreviewRenderer';
import { useStore } from '../../store';
import css from './DronePreview.module.css';
import controls from '../controls.module.css';

export function DronePreview() {
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<DronePreviewRenderer | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const instructions = useId();
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

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <section className={css.preview} aria-label="Your aircraft">
    <div><h2>Freestyle quad</h2><p>Representative aircraft preview</p></div>
    <div className={css.stage} role="group" aria-label="Rotate aircraft preview" aria-describedby={instructions}
      aria-disabled={state !== 'ready'} tabIndex={state === 'ready' ? 0 : -1}
      onPointerDown={event => {
        if (state !== 'ready' || !event.isPrimary || event.button !== 0) return;
        event.preventDefault(); event.currentTarget.focus();
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const previous = drag.current;
        if (!previous || previous.id !== event.pointerId) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        renderer.current?.rotateBy(-(event.clientX - previous.x) / Math.max(bounds.width, 1) * Math.PI * 2,
          (event.clientY - previous.y) / Math.max(bounds.height, 1) * Math.PI);
        drag.current = { id: previous.id, x: event.clientX, y: event.clientY };
      }} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
      onKeyDown={event => {
        if (state !== 'ready') return;
        const step = Math.PI / 12;
        switch (event.key) {
          case 'ArrowLeft': renderer.current?.rotateBy(-step, 0); break;
          case 'ArrowRight': renderer.current?.rotateBy(step, 0); break;
          case 'ArrowUp': renderer.current?.rotateBy(0, -step); break;
          case 'ArrowDown': renderer.current?.rotateBy(0, step); break;
          case 'Home': renderer.current?.resetView(); break;
          default: return;
        }
        event.preventDefault(); event.stopPropagation();
      }}>
      <div ref={container} className={css.canvas} />
      {state === 'loading' && <span role="status" className={css.message}>Loading aircraft…</span>}
      {state === 'failed' && <div className={css.message}><p>Preview unavailable. Your flight is unaffected.</p>
        <button className={controls.secondary} onClick={() => setAttempt(value => value + 1)}>Retry preview</button></div>}
    </div>
    <div className={css.previewTools}>
      <p id={instructions} className={css.pointerHint}>Drag to rotate · Arrow keys when focused</p>
      <button className={controls.quiet} disabled={state !== 'ready'} onClick={() => renderer.current?.resetView()}>Reset view</button>
    </div>
    <dl className={css.specs}><div><dt>Propellers</dt><dd>{((diameter ?? 0.1295) / 0.0254).toFixed(1)}″</dd></div><div><dt>Mass</dt><dd>{mass.toFixed(3)} kg</dd></div><div><dt>Flight mode</dt><dd>ACRO</dd></div></dl>
    <p className={css.credit}>Model: <a href="https://sketchfab.com/3d-models/racing-drone-lite-graphics-version-370fa7dd443c409789c9b0a2794a61ac" target="_blank" rel="noreferrer">BlueMesh</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>
  </section>;
}
