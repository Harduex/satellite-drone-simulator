import type { Viewer } from 'cesium';

export interface RecordingFrameSource {
  canvas: HTMLCanvasElement;
  readonly error?: string | null;
  dispose(): void;
}

export function getRecordingDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    throw new Error('The flight view is not ready to record.');
  }
  const scale = Math.min(1, 1920 / width, 1080 / height);
  return { width: Math.max(2, Math.floor(width * scale / 2) * 2), height: Math.max(2, Math.floor(height * scale / 2) * 2) };
}

interface Attribution {
  text: string;
  logos: HTMLImageElement[];
}

function readCredits(container: Element): { text: string; images: string[] } {
  const text: string[] = [];
  const images = new Set<string>();
  function visit(node: Node): void {
    if (node instanceof Element) {
      // Links without a destination are credit-display controls, not provider credits.
      if (node.tagName === 'A' && !node.hasAttribute('href')) return;
      if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT') return;
      if (node instanceof HTMLImageElement) { if (node.src) images.add(node.src); return; }
    }
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) text.push(node.textContent.trim());
    for (const child of node.childNodes) visit(child);
  }
  visit(container);
  return { text: text.join(' '), images: [...images] };
}

function loadLogo(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Required map attribution could not load.'));
    image.src = url;
  });
}

function wrapCredits(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

export async function createRecordingFrameSource(viewer: Viewer): Promise<RecordingFrameSource> {
  const canvas = document.createElement('canvas');
  const dimensions = getRecordingDimensions(viewer.canvas.width, viewer.canvas.height);
  canvas.width = dimensions.width; canvas.height = dimensions.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Video capture is unavailable in this browser.');
  const creditContainer = viewer.cesiumWidget.creditContainer;
  const logoCache = new Map<string, Promise<HTMLImageElement>>();
  let attribution: Attribution = { text: '', logos: [] };
  let signature = '';
  let pending = false;
  let disposed = false;
  let error: string | null = null;
  let lastFrame = -Infinity;

  async function refreshCredits(): Promise<void> {
    const credits = readCredits(creditContainer);
    signature = creditContainer.innerHTML;
    if (!credits.text && credits.images.length === 0) throw new Error('Required map attribution is unavailable.');
    attribution = {
      text: credits.text,
      logos: await Promise.all(credits.images.map(url => {
        let load = logoCache.get(url);
        if (!load) { load = loadLogo(url); logoCache.set(url, load); }
        return load;
      })),
    };
  }
  await refreshCredits();

  const removePostRender = viewer.scene.postRender.addEventListener(() => {
    if (disposed || pending || error) return;
    if (signature !== creditContainer.innerHTML) {
      pending = true;
      void refreshCredits().catch(() => { error = 'Required map attribution could not load.'; })
        .finally(() => { pending = false; });
      return;
    }
    const now = performance.now();
    if (now - lastFrame < 1000 / 60) return;
    lastFrame = now;
    try {
      const source = viewer.canvas;
      const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
      const width = source.width * scale; const height = source.height * scale;
      context.fillStyle = '#000'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      const fontSize = Math.max(12, Math.round(canvas.height / 60));
      const lineHeight = fontSize + 4;
      context.font = `${fontSize}px sans-serif`;
      const lines = wrapCredits(context, attribution.text, canvas.width - 24);
      const logoHeight = attribution.logos.length ? 20 : 0;
      const panelHeight = lines.length * lineHeight + logoHeight + 16;
      if (panelHeight > canvas.height / 2 || attribution.logos.some(logo => !logo.naturalHeight)) {
        error = 'The recording is too small for readable map attribution.'; return;
      }
      context.fillStyle = 'rgba(0,0,0,0.75)';
      context.fillRect(0, canvas.height - panelHeight, canvas.width, panelHeight);
      let x = 12;
      for (const logo of attribution.logos) {
        const logoWidth = logo.naturalWidth * logoHeight / logo.naturalHeight;
        if (x + logoWidth > canvas.width - 12) { error = 'Map attribution does not fit this recording.'; return; }
        context.drawImage(logo, x, canvas.height - panelHeight + 6, logoWidth, logoHeight);
        x += logoWidth + 14;
      }
      context.fillStyle = '#fff'; context.textBaseline = 'top';
      lines.forEach((line, index) => context.fillText(line, 12, canvas.height - panelHeight + 8 + logoHeight + index * lineHeight));
    } catch {
      error = 'The flight view could not be captured.';
    }
  });

  return {
    canvas,
    get error() { return error; },
    dispose() {
      if (disposed) return;
      disposed = true; removePostRender(); logoCache.clear();
    },
  };
}
