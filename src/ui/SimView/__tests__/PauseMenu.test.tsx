// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PauseMenu } from '../PauseMenu';

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function render(onCopyLocation: () => Promise<boolean>) {
  act(() => root.render(
    <PauseMenu onResume={vi.fn()} onSaveCurrentAsDefault={vi.fn()} onCopyLocation={onCopyLocation} onChangeLocation={vi.fn(async () => {})} />,
  ));
}
function labels() { return [...container.querySelectorAll('button')].map(b => b.textContent); }

describe('PauseMenu copy location', () => {
  it('sits below Save Current As Default and shows Copied! briefly', async () => {
    const copy = vi.fn(async () => true); render(copy);
    const l = labels(); expect(l.indexOf('Copy Location')).toBe(l.indexOf('Save Current As Default') + 1);
    await act(async () => { [...container.querySelectorAll('button')].find(b => b.textContent === 'Copy Location')!.click(); });
    expect(copy).toHaveBeenCalledOnce(); expect(labels()).toContain('Copied!');
    act(() => { vi.advanceTimersByTime(2000); }); expect(labels()).toContain('Copy Location');
  });

  it('shows failure when copying is rejected', async () => {
    render(vi.fn(async () => false));
    await act(async () => { [...container.querySelectorAll('button')].find(b => b.textContent === 'Copy Location')!.click(); });
    expect(labels()).toContain('Copy failed');
  });

  it('calls onExportTelemetry when Export Telemetry is clicked', () => {
    const exportTelemetry = vi.fn();
    act(() => root.render(
      <PauseMenu
        onResume={vi.fn()}
        onSaveCurrentAsDefault={vi.fn()}
        onCopyLocation={vi.fn(async () => true)}
        onExportTelemetry={exportTelemetry}
        onChangeLocation={vi.fn(async () => {})}
      />,
    ));
    const btn = [...container.querySelectorAll('button')].find(b => b.textContent === 'Export Telemetry');
    expect(btn).toBeDefined();
    act(() => { btn!.click(); });
    expect(exportTelemetry).toHaveBeenCalledOnce();
  });

  it('renders Random Location button and shows loading state when clicked', async () => {
    let finishPromise: () => void;
    const randomPromise = new Promise<void>((resolve) => {
      finishPromise = resolve;
    });
    const onRandomLocation = vi.fn(() => randomPromise);

    act(() => root.render(
      <PauseMenu
        onResume={vi.fn()}
        onSaveCurrentAsDefault={vi.fn()}
        onCopyLocation={vi.fn(async () => true)}
        onChangeLocation={vi.fn(async () => {})}
        onRandomLocation={onRandomLocation}
      />,
    ));

    const btn = [...container.querySelectorAll('button')].find(b => b.textContent === 'Random Location');
    expect(btn).toBeDefined();

    await act(async () => {
      btn!.click();
    });

    expect(onRandomLocation).toHaveBeenCalledOnce();
    expect(btn!.textContent).toBe('Loading...');

    await act(async () => {
      finishPromise();
    });

    expect(btn!.textContent).toBe('Random Location');
  });

  it('reports random-load failure and permits retry without resuming an empty flight', async () => {
    const onRandomLocation = vi.fn().mockRejectedValueOnce(new Error('Tiles unavailable')).mockResolvedValue(undefined);
    act(() => root.render(
      <PauseMenu onResume={vi.fn()} onSaveCurrentAsDefault={vi.fn()}
        onCopyLocation={vi.fn(async () => true)} onChangeLocation={vi.fn(async () => {})}
        onRandomLocation={onRandomLocation} />,
    ));
    const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'Random Location')!;
    await act(async () => button.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Unable to load');
    expect([...container.querySelectorAll('button')].find(b => b.textContent === 'Resume')!.disabled).toBe(true);
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
