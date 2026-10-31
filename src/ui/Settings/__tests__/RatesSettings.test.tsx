// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RatesSettings } from '../RatesSettings';
import { useStore } from '../../../store';
import { DEFAULT_RATES } from '../../../core/physics/droneConfig';
import { SettingsPersistence } from '../../../store/SettingsPersistence';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const initial = useStore.getState().rates;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  useStore.setState({ rates: { ...DEFAULT_RATES, rollRate: 610, expo: 0.35 } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<RatesSettings />));
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); useStore.setState({ rates: initial }); localStorage.clear(); vi.unstubAllGlobals();
});
it('switches models without overwriting inactive settings and persists per-axis Actual values', () => {
  const mapping = useStore.getState().axisMapping;
  const choose = (model: string) => act(() => {
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Rate model"]')!;
    select.value = model; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  choose('actual');
  expect(host.querySelector('[aria-label="Roll center"]')).not.toBeNull();
  act(() => {
    const slider = host.querySelector<HTMLInputElement>('[aria-label="Roll center"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(slider, '120');
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(SettingsPersistence.readRates().actual!.roll.centerSensitivity).toBe(120);
  choose('polynomial');
  expect(host.querySelector<HTMLInputElement>('[aria-label="Roll Rate"]')!.value).toBe('610');
  expect(useStore.getState().rates.expo).toBe(0.35);
  choose('actual');
  expect(host.querySelector<HTMLInputElement>('[aria-label="Roll center"]')!.value).toBe('120');
  expect(useStore.getState().axisMapping).toBe(mapping);
});
