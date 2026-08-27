import { describe, expect, it } from 'vitest';
import { clampVolume } from './sound';
import { DEFAULT_SETTINGS } from './settings';

describe('clampVolume', () => {
  it('passes a normal level through', () => {
    expect(clampVolume(0)).toBe(0);
    expect(clampVolume(0.35)).toBe(0.35);
    expect(clampVolume(1)).toBe(1);
  });

  it('never lets the mix go above the level it was tuned at', () => {
    expect(clampVolume(1.5)).toBe(1);
    expect(clampVolume(Infinity)).toBe(1);
  });

  it('never goes negative — that inverts a waveform rather than silencing it', () => {
    expect(clampVolume(-0.2)).toBe(0);
  });

  it('falls back to full volume on junk from storage', () => {
    // Anything non-finite is treated as "no usable setting" rather than as a
    // number to clamp. Full volume is the recoverable failure: silently
    // silencing everything just reads as broken audio.
    expect(clampVolume(NaN)).toBe(1);
    expect(clampVolume(Infinity)).toBe(1);
    expect(clampVolume(-Infinity)).toBe(1);
    expect(clampVolume(undefined as unknown as number)).toBe(1);
  });
});

describe('volume setting', () => {
  it('ships at full volume, so the slider can only ever attenuate', () => {
    expect(DEFAULT_SETTINGS.volume).toBe(1);
  });
});
