import * as Cesium from 'cesium';
import { afterEach, expect, it, vi } from 'vitest';
import { waitForDetailedTileCoverage } from '../TileCoverage';

afterEach(() => vi.useRealTimers());

it('accepts nearby detailed textured Google content and removes listeners', async () => {
  const tileVisible = new Cesium.Event();
  const point = new Cesium.Cartesian3(100, 0, 0);
  const pending = waitForDetailedTileCoverage({ tileVisible } as Cesium.Cesium3DTileset, point);
  point.x = 10000;
  tileVisible.raiseEvent({ geometricError: 2, boundingSphere: new Cesium.BoundingSphere(new Cesium.Cartesian3(100, 0, 0), 80),
    content: { trianglesLength: 1000, texturesByteLength: 5000 } });
  expect(await pending).toBe(true);
  expect(tileVisible.numberOfListeners).toBe(0);
});

it.each(['coarse', 'distant', 'untextured', 'sparse', 'absent'])('rejects %s evidence and removes listeners at timeout', async kind => {
  vi.useFakeTimers();
  const tileVisible = new Cesium.Event();
  const pending = waitForDetailedTileCoverage({ tileVisible } as Cesium.Cesium3DTileset, Cesium.Cartesian3.ZERO);
  if (kind !== 'absent') tileVisible.raiseEvent({ geometricError: kind === 'coarse' ? 500 : 2,
    boundingSphere: new Cesium.BoundingSphere(new Cesium.Cartesian3(kind === 'distant' ? 10000 : 0, 0, 0), 80),
    content: { trianglesLength: kind === 'sparse' ? 2 : 1000, texturesByteLength: kind === 'untextured' ? 0 : 5000 } });
  await vi.runAllTimersAsync();
  expect(await pending).toBe(false);
  expect(tileVisible.numberOfListeners).toBe(0);
});
