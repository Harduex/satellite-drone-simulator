// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SettingsDialog } from '../SettingsDialog';
import { useStore } from '../../../store';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
function button(label: string) { return [...host.querySelectorAll('button')].find(b => b.textContent === label)!; }

it('keeps aircraft tuning and telemetry behind their own categories without changing mappings', () => {
  const mapping = useStore.getState().axisMapping;
  const exportTelemetry = vi.fn();
  act(() => root.render(<SettingsDialog onClose={vi.fn()} onExportTelemetry={exportTelemetry} />));
  expect(host.querySelector('[aria-label="Mass"]')).toBeNull();
  expect(host.textContent).not.toContain('Export Telemetry');
  act(() => button('Aircraft tuning').click());
  expect(host.querySelector('[aria-label="Mass"]')).not.toBeNull();
  act(() => button('Developer tools').click());
  act(() => button('Export Telemetry').click());
  expect(exportTelemetry).toHaveBeenCalledOnce();
  expect(useStore.getState().axisMapping).toBe(mapping);
});

it('consumes Escape before the global resume handler and restores focus', () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const resume = vi.fn(), close = vi.fn(); window.addEventListener('keydown', resume);
  try {
    act(() => root.render(<SettingsDialog onClose={close} />));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })));
    expect(close).toHaveBeenCalledOnce(); expect(resume).not.toHaveBeenCalled();
    act(() => root.render(null)); expect(document.activeElement).toBe(trigger);
  } finally { window.removeEventListener('keydown', resume); trigger.remove(); }
});

it('contains focus at the dialog boundaries', () => {
  act(() => root.render(<SettingsDialog onClose={vi.fn()} />));
  const buttons = host.querySelectorAll<HTMLButtonElement>('button');
  const first = buttons[0]!, last = buttons[buttons.length - 1]!;
  last.focus();
  act(() => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(first);
  first.focus();
  act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(last);
});
