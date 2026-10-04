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
    const timeout = setTimeout(() => reject(new Error('Required map attribution timed out.')), 10_000);
    image.onload = () => { clearTimeout(timeout); resolve(image); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error('Required map attribution could not load.')); };
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
  const staging = document.createElement('canvas');
  staging.width = canvas.width; staging.height = canvas.height;
  const stagingContext = staging.getContext('2d', { alpha: false });
  if (!stagingContext) throw new Error('Video capture is unavailable in this browser.');
  const creditContainer = viewer.cesiumWidget.creditContainer;
  const logoCache = new Map<string, Promise<HTMLImageElement>>();
  let attribution: Attribution = { text: '', logos: [] };
  let signature = '';
  let pending = false;
  let disposed = false;
  let error: string | null = null;
  let lastFrame = -Infinity;
  let queued = false;

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

  function layoutCredits() {
    const fontSize = Math.max(12, Math.round(canvas.height / 60));
    const lineHeight = fontSize + 4;
    stagingContext!.font = `${fontSize}px sans-serif`;
    const lines = wrapCredits(stagingContext!, attribution.text, canvas.width - 24);
    const logoHeight = attribution.logos.length ? 20 : 0;
    const panelHeight = lines.length * lineHeight + logoHeight + 16;
    const logoWidths = attribution.logos.map(logo => logo.naturalWidth * logoHeight / logo.naturalHeight);
    if (panelHeight > canvas.height / 2 || logoWidths.some(width => !Number.isFinite(width))
      || logoWidths.reduce((sum, width) => sum + width + 14, 12) > canvas.width - 12
      || lines.some(line => stagingContext!.measureText(line).width > canvas.width - 24)) {
      throw new Error('The recording is too small for readable map attribution.');
    }
    return { lines, lineHeight, logoHeight, panelHeight, logoWidths };
  }
  layoutCredits();

  function drawFrame(): void {
    if (disposed || pending || error) return;
    if (signature !== creditContainer.innerHTML) {
      pending = true;
      void refreshCredits().then(() => { pending = false; drawFrame(); })
        .catch(() => { pending = false; error = 'Required map attribution could not load.'; });
      return;
    }
    const now = performance.now();
    if (now - lastFrame < 1000 / 60) return;
    lastFrame = now;
    try {
      const { lines, lineHeight, logoHeight, panelHeight, logoWidths } = layoutCredits();
      const source = viewer.canvas;
      const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
      const width = source.width * scale; const height = source.height * scale;
      stagingContext!.fillStyle = '#000'; stagingContext!.fillRect(0, 0, canvas.width, canvas.height);
      stagingContext!.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      stagingContext!.fillStyle = 'rgba(0,0,0,0.75)';
      stagingContext!.fillRect(0, canvas.height - panelHeight, canvas.width, panelHeight);
      let x = 12;
      for (const [index, logo] of attribution.logos.entries()) {
        const logoWidth = logoWidths[index]!;
        stagingContext!.drawImage(logo, x, canvas.height - panelHeight + 6, logoWidth, logoHeight);
        x += logoWidth + 14;
      }
      stagingContext!.fillStyle = '#fff'; stagingContext!.textBaseline = 'top';
      lines.forEach((line, index) => stagingContext!.fillText(line, 12, canvas.height - panelHeight + 8 + logoHeight + index * lineHeight));
      context!.drawImage(staging, 0, 0);
    } catch {
      error = 'The flight view could not be captured.';
    }
  }

  const removePostRender = viewer.scene.postRender.addEventListener(() => {
    if (queued || disposed) return;
    queued = true;
    // Cesium updates credit DOM after raising postRender, within the same render call.
    queueMicrotask(() => { queued = false; drawFrame(); });
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
