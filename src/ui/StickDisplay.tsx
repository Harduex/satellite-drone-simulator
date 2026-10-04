import css from "./StickDisplay.module.css";

// ── Dual-Stick Crosshair ──────────────────────────────────
export function DualStickCrosshair({ leftX, leftY, rightX, rightY, size = 140 }: {
  leftX: number; leftY: number; rightX: number; rightY: number; size?: number;
}) {
  return (
    <div className={css.dualStickRow}>
      <div className={css.stickColumn}>
        <StickBox x={leftX} y={leftY} yIsThrottle={true} xLabel="YAW" yLabel="THR" size={size} />
        <div className={css.stickColumnLabel}>Left Stick</div>
      </div>
      <div className={css.stickColumn}>
        <StickBox x={rightX} y={rightY} yIsThrottle={false} xLabel="ROLL" yLabel="PITCH" size={size} />
        <div className={css.stickColumnLabel}>Right Stick</div>
      </div>
    </div>
  );
}

// ── Single Stick Box ──────────────────────────────────────
function StickBox({ x, y, yIsThrottle, xLabel, yLabel, size }: {
  x: number; y: number; yIsThrottle: boolean; xLabel: string; yLabel: string; size: number;
}) {
  // x: [-1,1], y: [0,1] for throttle or [-1,1] for pitch
  const dotX = ((x + 1) / 2) * size;
  const dotY = yIsThrottle ? (1 - y) * size : ((1 - y) / 2) * size;
  const centerY = yIsThrottle ? size : size / 2;

  return (
    <div role="img" aria-label={`${xLabel} ${x.toFixed(2)}, ${yLabel} ${y.toFixed(2)}`} className={css.stickBoxWrapper} style={{ width: size + 20, height: size + 20 }}>
      {/* Background */}
      <div className={css.stickBoxBg} style={{ width: size, height: size }} />
      {/* Horizontal center line */}
      <div className={css.stickBoxHLine} style={{ top: 10 + centerY, width: size }} />
      {/* Vertical center line */}
      <div className={css.stickBoxVLine} style={{ left: 20 + size / 2, height: size }} />
      {/* Dot — uses transform for GPU-composited positioning */}
      <div
        className={css.stickBoxDot}
        style={{ transform: `translate(${20 + dotX - 6}px, ${10 + dotY - 6}px)` }}
      />
      {/* X label (below box) */}
      <span className={css.stickBoxXLabel} style={{ left: 20 + size / 2 }}>
        {xLabel}
      </span>
      {/* Y label (left of box, rotated) */}
      <span className={css.stickBoxYLabel} style={{ top: 10 + size / 2 }}>
        {yLabel}
      </span>
    </div>
  );
}
