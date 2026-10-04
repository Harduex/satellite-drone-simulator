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
});
