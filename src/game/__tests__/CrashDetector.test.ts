import { describe, expect, it, vi } from 'vitest';
import { CrashDetector } from '../CrashDetector';
import { createDefaultDroneState } from '../../core/physics/types';
import type { ContactResult } from '../../core/physics/SurfaceContact';

const contact = (speed: number): ContactResult => ({ touching: true, supported: true, impactSpeed: speed, point: { x: 0, y: 0, z: 0 } });
describe('CrashDetector impact classification', () => {
  it('disables a severe hit even during the feedback cooldown after a scrape', () => {
    const detector = new CrashDetector();
    detector.check(contact(3), createDefaultDroneState(0.05), false, 0.002);
    detector.check(contact(0), createDefaultDroneState(0.05), false, 0.05);
    expect(detector.check(contact(10), createDefaultDroneState(0.05), false, 0.002)).toBe(true);
    expect(detector.disabled).toBe(true);
  });
  it('accepts a stationary or gentle landing indefinitely', () => {
    const detector = new CrashDetector();
    for (let i = 0; i < 5000; i++) detector.check(contact(0.5), createDefaultDroneState(0.05), false, 0.002);
    expect(detector.disabled).toBe(false);
    expect(detector.hasImpactFeedback).toBe(false);
  });
  it('disables severe standard impacts and preserves the latch across a mode change', () => {
    const detector = new CrashDetector();
    expect(detector.check(contact(10), createDefaultDroneState(0.05), false, 0.002)).toBe(true);
    detector.check(contact(0), createDefaultDroneState(0.05), true, 0.002);
    expect(detector.disabled).toBe(true);
    detector.reset();
    expect(detector.disabled).toBe(false);
  });
  it('keeps God mode flyable after the same impact', () => {
    const detector = new CrashDetector();
    expect(detector.check(contact(10), createDefaultDroneState(0.05), true, 0.002)).toBe(false);
    expect(detector.disabled).toBe(false);
    expect(detector.hasImpactFeedback).toBe(true);
  });
  it('debounces impacts in simulation seconds, independently of render/HUD rate', () => {
    const detector = new CrashDetector(), callback = vi.fn();
    detector.setOnCrash(callback);
    for (let i = 0; i < 50; i++) detector.check(contact(3), createDefaultDroneState(0.05), false, 0.002);
    expect(callback).toHaveBeenCalledOnce();
    expect(detector.disabled).toBe(false);
  });
});
