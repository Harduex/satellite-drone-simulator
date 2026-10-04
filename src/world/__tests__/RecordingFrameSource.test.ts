// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Event as CesiumEvent, type Viewer } from 'cesium';
import { createRecordingFrameSource, getRecordingDimensions } from '../RecordingFrameSource';

afterEach(() => vi.restoreAllMocks());

describe('recording frames', () => {
  it('rejects attribution that cannot fit before publishing any scenery', async () => {
    const context = { drawImage: vi.fn(), measureText: (text: string) => ({ width: text.length * 7 }) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const credits = document.createElement('div'); credits.textContent = 'Provider attribution '.repeat(120);
    const postRender = new CesiumEvent();
    const viewer = { canvas, scene: { postRender }, cesiumWidget: { creditContainer: credits } } as unknown as Viewer;
    await expect(createRecordingFrameSource(viewer)).rejects.toThrow('attribution');
    expect(context.drawImage).not.toHaveBeenCalled(); expect(postRender.numberOfListeners).toBe(0);
  });

  it('pairs a scene frame with credits updated after the postRender event', async () => {
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(), measureText: (text: string) => ({ width: text.length * 7 }) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const credits = document.createElement('div'); credits.textContent = 'Provider A';
    const postRender = new CesiumEvent();
    const viewer = { canvas, scene: { postRender }, cesiumWidget: { creditContainer: credits } } as unknown as Viewer;
    const source = await createRecordingFrameSource(viewer);
    context.fillText.mockClear();
    postRender.raiseEvent(); credits.textContent = 'Provider B';
    await vi.waitFor(() => { postRender.raiseEvent(); expect(context.fillText.mock.calls.flat().join(' ')).toContain('Provider B'); });
    expect(context.fillText.mock.calls.flat().join(' ')).not.toContain('Provider A');
    source.dispose();
  });
  it('rejects missing credits before attaching a render listener', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const postRender = new CesiumEvent();
    const viewer = { canvas, scene: { postRender }, cesiumWidget: { creditContainer: document.createElement('div') } } as unknown as Viewer;
    await expect(createRecordingFrameSource(viewer)).rejects.toThrow('attribution');
    expect(postRender.numberOfListeners).toBe(0);
  });
  it('fits even dimensions without upscaling', () => {
    expect(getRecordingDimensions(3840, 2160)).toEqual({ width: 1920, height: 1080 });
    expect(getRecordingDimensions(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(getRecordingDimensions(3440, 1440)).toEqual({ width: 1920, height: 802 });
    expect(() => getRecordingDimensions(0, 0)).toThrow();
    expect(() => getRecordingDimensions(Infinity, 2)).toThrow();
  });

  it('composes scenery and full changing credits, letterboxes, and detaches', async () => {
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillText: vi.fn(), measureText: (text: string) => ({ width: text.length * 7 }) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const credits = document.createElement('div'); credits.innerHTML = '<a href="https://example.org">Google Maps · Example provider</a><a>Data attribution</a>';
    const postRender = new CesiumEvent();
    let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
    const viewer = { canvas, scene: { postRender }, cesiumWidget: { creditContainer: credits } } as unknown as Viewer;
    const source = await createRecordingFrameSource(viewer);
    postRender.raiseEvent();
    await Promise.resolve();
    expect(context.drawImage).toHaveBeenCalled();
    expect(context.fillText.mock.calls.flat().join(' ')).toContain('Google Maps');
    expect(context.fillText.mock.calls.flat().join(' ')).not.toContain('Data attribution');
    const frames = context.drawImage.mock.calls.length;
    postRender.raiseEvent(); expect(context.drawImage).toHaveBeenCalledTimes(frames);
    canvas.width = 720; canvas.height = 720; now = 50;
    credits.innerHTML = '<a href="https://example.org">Different provider</a>';
    postRender.raiseEvent();
    await vi.waitFor(() => {
      postRender.raiseEvent();
      expect(context.fillText.mock.calls.flat().join(' ')).toContain('Different provider');
    });
    expect(source.canvas.width).toBe(1280);
    expect(context.drawImage.mock.calls.filter(call => call[0] === canvas).at(-1)).toEqual([canvas, 280, 0, 720, 720]);
    expect(context.fillText.mock.calls.flat().join(' ')).toContain('Different provider');
    source.dispose(); source.dispose();
    expect(postRender.numberOfListeners).toBe(0);
  });
});
