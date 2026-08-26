import { asset } from '../asset';

let tick: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
};

/** Called inside the DECIDE click so the browser's autoplay gate is unlocked
 *  for the ceremony's later (timer-driven) ticks. Creates/resumes the shared
 *  AudioContext and plays a muted instance of the tick. */
export const unlockAudio = () => {
  try {
    const c = getCtx();
    if (c?.state === 'suspended') void c.resume();
    const a = new Audio(asset('audio/tick.wav'));
    a.muted = true;
    void a.play().catch(() => {});
  } catch {
    /* never let audio break a roll */
  }
};

/** Plays the full vendored tick. A held reference stops GC from cutting it
 *  short mid-playback. */
export const playTick = (volume = 0.6) => {
  try {
    if (tick) tick.pause();
    tick = new Audio(asset('audio/tick.wav'));
    tick.volume = volume;
    void tick.play().catch(() => {});
  } catch {
    /* never let audio break a roll */
  }
};

/** Short rising-pitch click for value count-up ticks. `progress` is 0→1. */
export const playIncrement = (progress: number) => {
  try {
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(480 + progress * 900, c.currentTime);
    gain.gain.setValueAtTime(0.045, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.06);
  } catch {
    /* never let audio break a roll */
  }
};

/** Low, fast-decaying "thud" for when a tape lands on a slot. */
export const playThud = () => {
  try {
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.22);
    gain.gain.setValueAtTime(0.18, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.28);
  } catch {
    /* never let audio break a roll */
  }
};

/** Short rising arpeggio for elite/boss landings. */
export const playFanfare = () => {
  try {
    const c = getCtx();
    if (!c) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const t = c.currentTime + i * 0.07;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {
    /* never let audio break a roll */
  }
};
