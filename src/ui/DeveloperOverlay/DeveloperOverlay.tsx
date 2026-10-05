import { useEffect } from 'react';
import type { SimSession } from '../../game/SimSession';
import { useStore } from '../../store';
import styles from './DeveloperOverlay.module.css';

function memory(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`;
}

export function DeveloperOverlay({ session }: { session: SimSession }) {
  const visible = useStore(state => state.diagnosticsVisible);
  const snapshot = useStore(state => state.renderDiagnostics);
  const traffic = useStore(state => state.trafficDiagnostics);
  const trafficEnabled = useStore(state => state.roadTrafficEnabled);
  const pedestrians = useStore(state => state.pedestrianDiagnostics);
  const pedestriansEnabled = useStore(state => state.pedestriansEnabled);
  const cacheOnlyPractice = useStore(state => state.cacheOnlyPractice);
  const phase = useStore(state => state.phase);

  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if (event.code !== 'KeyD' || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement &&
          (target.isContentEditable || target.closest('input, textarea, select'))) return;
      event.preventDefault();
      // The shortcut includes a yaw key; it must never reach the flight input listener.
      event.stopImmediatePropagation();
      if (!event.repeat) useStore.getState().toggleDiagnostics();
    };
    window.addEventListener('keydown', toggle, true);
    return () => window.removeEventListener('keydown', toggle, true);
  }, []);

  useEffect(() => {
    session.setDiagnosticsEnabled(visible);
    return () => session.setDiagnosticsEnabled(false);
  }, [session, visible]);

  if (!visible) return null;

  const activeRequests = (snapshot?.pendingRequests ?? 0) > 0;
  const pressure = snapshot && snapshot.memoryAdjustedScreenSpaceError > snapshot.maximumScreenSpaceError;
  const status = !snapshot?.tilesetLoaded ? 'Awaiting flight'
    : cacheOnlyPractice ? (activeRequests ? 'Cache-only · finishing requests' : 'Cache-only · streaming stopped')
    : activeRequests ? 'Tile requests active'
    : snapshot.processingTiles > 0 ? 'Processing tiles'
    : snapshot.visibleTiles === 0 ? 'No tiles in view'
    : !snapshot.requestTimingAvailable ? 'Request timing unavailable'
    : pressure ? 'Cache under pressure'
    : snapshot.tileFetchesLast5Seconds > 0 ? 'Recent tile fetches'
    : snapshot.observationSeconds < 5 ? 'Checking cache activity…'
    : 'Quiet · no recent tile fetches';
  const budget = snapshot ? snapshot.cacheBytes + snapshot.overflowBytes : 0;

  return (
    <aside className={styles.panel} aria-label="Developer diagnostics">
      <header className={styles.header}>
        <span>WORLD / DEV</span>
        <button type="button" className={styles.close} aria-label="Hide developer diagnostics"
          onClick={() => useStore.getState().toggleDiagnostics()}>×</button>
      </header>
      <div className={styles.performance}>
        <strong>{snapshot ? snapshot.fps.toFixed(0) : '—'}</strong><span>FPS</span>
        <span className={styles.frameTime}>{snapshot ? snapshot.frameTimeMs.toFixed(1) : '—'} ms / frame</span>
      </div>
      <div className={styles.status} data-active={activeRequests || pressure || (!cacheOnlyPractice && (snapshot?.tileFetchesLast5Seconds ?? 0) > 0)}>{status}</div>
      <div className={styles.practiceOption}>
        <button type="button" role="switch" className={styles.practiceToggle}
          aria-checked={cacheOnlyPractice} disabled={phase === 'PICKER'}
          onClick={() => session.setCacheOnlyPractice(!cacheOnlyPractice)}
          aria-label="Cache-only practice" aria-describedby="cache-only-description">
          <span>Cache-only practice</span><span aria-hidden="true">{cacheOnlyPractice ? 'ON' : 'OFF'}</span>
        </button>
        <p id="cache-only-description" className={styles.note}>{phase === 'PICKER'
          ? 'Start a flight to enable. Stops new 3D tile requests.'
          : 'Stops new 3D tile requests; keeps loaded tiles available.'}</p>
        <details className={styles.practiceHelp}>
          <summary>How this works</summary>
          <p>Fly around with this OFF to load your practice area. Turn it ON to reuse loaded 3D tiles without requesting more.</p>
          <p>Unloaded views may look incomplete. Requests already in flight may finish. Turn it OFF to load more detail.</p>
          <p>Only 3D tiles are blocked; search, elevation and globe services may still make requests. Closing this panel keeps the mode active. Leaving the flight resets it.</p>
        </details>
      </div>
      {snapshot?.tilesetLoaded && (
        <>
          <dl className={styles.metrics}>
            <dt title="Completed photoreal tile requests during the last five seconds and since the overlay opened; includes HTTP-cache hits">Tile fetches · 5s / total</dt>
            <dd>{snapshot.requestTimingAvailable ? `${snapshot.tileFetchesLast5Seconds} / ${snapshot.totalTileFetches}` : 'Unavailable'}</dd>
            <dt>Browser cache / network</dt>
            <dd>{snapshot.requestTimingAvailable ? `${snapshot.browserCacheTileFetches} / ${snapshot.networkTileFetches}` : '—'}</dd>
            <dt>Unknown fetch source</dt><dd>{snapshot.requestTimingAvailable ? snapshot.unknownTileFetches : '—'}</dd>
            <dt title="Resident tiles were already in Cesium memory; fresh tiles loaded during the last update">Visible · resident / fresh</dt>
            <dd>{snapshot.visibleTiles} · {snapshot.residentVisibleTiles} / {snapshot.newlyLoadedVisibleTiles}</dd>
            <dt>Requests / processing</dt><dd>{snapshot.pendingRequests} / {snapshot.processingTiles}</dd>
            <dt>Loaded / evicted per sec</dt>
            <dd>{(snapshot.loadedTiles / snapshot.sampleSeconds).toFixed(1)} / {(snapshot.evictedTiles / snapshot.sampleSeconds).toFixed(1)}</dd>
            <dt>Tiles in memory</dt><dd>{snapshot.cachedTiles}</dd>
            <dt>Tile memory</dt><dd>{memory(snapshot.memoryBytes)}</dd>
            <dt>Cache + view overflow</dt><dd>{memory(snapshot.cacheBytes)} + {memory(snapshot.overflowBytes)}</dd>
          </dl>
          <div className={styles.memoryTrack} title="Cesium tile memory relative to cache plus overflow allowance">
            <div style={{ width: `${budget > 0 ? Math.min(100, snapshot.memoryBytes / budget * 100) : 0}%` }} />
          </div>
          <dl className={styles.metrics}>
            <dt>LOD skipping / globe</dt><dd>{snapshot.skipLevelOfDetail ? 'ON' : 'OFF'} / {snapshot.globeVisible ? 'ON' : 'OFF'}</dd>
            <dt>SSE target / effective</dt><dd data-warning={pressure}>{snapshot.maximumScreenSpaceError.toFixed(1)} / {snapshot.memoryAdjustedScreenSpaceError.toFixed(1)}</dd>
            <dt>Failures while shown</dt><dd data-warning={snapshot.failedTiles > 0}>{snapshot.failedTiles}</dd>
          </dl>
        </>
      )}
      <section aria-label="Traffic diagnostics">
        <div className={styles.status}>TRAFFIC · SIMULATED</div>
        {traffic ? <dl className={styles.metrics}>
          <dt>Cars / validated roads</dt><dd>{traffic.cars} / {traffic.edges}</dd>
          <dt>Road cache · tiles / memory</dt><dd>{traffic.cachedTiles} / {memory(traffic.cachedBytes)}</dd>
          <dt>Road requests / failures</dt><dd>{traffic.pendingRequests} / {traffic.requestFailures}</dd>
          <dt>Surface pending / rejected</dt><dd>{traffic.pendingSurfaceRoads} / {traffic.rejectedRoads}</dd>
          <dt>Update / surface ms</dt><dd>{traffic.updateMs.toFixed(2)} / {traffic.surfaceMs.toFixed(2)}</dd>
          <dt>Surface samples / refreshes</dt><dd>{traffic.surfaceSamples} / {traffic.refreshes}</dd>
        </dl> : <p className={styles.note}>{trafficEnabled ? 'Preparing nearby roads…' : 'Road traffic is off.'}</p>}
      </section>
      <section aria-label="Pedestrian diagnostics">
        <div className={styles.status}>PEDESTRIANS · SIMULATED</div>
        {pedestrians ? <dl className={styles.metrics}>
          <dt>People / rendered</dt><dd>{pedestrians.people} / {pedestrians.renderedPeople}</dd>
          <dt>Paths / validated</dt><dd>{pedestrians.pendingPaths} / {pedestrians.paths}</dd>
          <dt>Path cache · tiles / memory</dt><dd>{pedestrians.cachedTiles} / {memory(pedestrians.cachedBytes)}</dd>
          <dt>Surface samples / ms</dt><dd>{pedestrians.surfaceSamples} / {pedestrians.surfaceMs.toFixed(2)}</dd>
          <dt>Rejected paths / refreshes</dt><dd>{pedestrians.rejectedPaths} / {pedestrians.refreshes}</dd>
        </dl> : <p className={styles.note}>{pedestriansEnabled ? 'Preparing nearby paths…' : 'Pedestrians are off.'}</p>}
      </section>
      <p className={styles.note}>{cacheOnlyPractice
        ? 'New 3D tile requests are blocked. Uncached views may appear incomplete.'
        : 'Tile requests only; unknown sources may use the API. Turning or altitude changes can fetch more detail.'}</p>
      <footer className={styles.footer}>CTRL + SHIFT + D <span>2 updates / sec</span></footer>
    </aside>
  );
}
