import { asset } from '../asset';

let tick: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;

/**
 * Master volume, 0..1. Every level in this file is a fraction of it, so the
 * shipped mix IS full volume and the slider can only ever attenuate — nothing
 * gets louder than it was tuned to be.
 */
let masterVolume = 1;

/**
 * Holds a level inside 0..1. A stray value from storage must not be able to
 * push the mix above the tuned level, or make a gain negative (which inverts
 * the waveform rather than silencing it).
 */
export const clampVolume = (v: number): number =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;

/** Set from the volume setting. */
export const setMasterVolume = (v: number) => {
  masterVolume = clampVolume(v);
};

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
    // Decode the boom now, while we are inside the user gesture.
    primeVineBoom();
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
    tick.volume = volume * masterVolume;
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
    gain.gain.setValueAtTime(0.045 * masterVolume, c.currentTime);
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
    gain.gain.setValueAtTime(0.18 * masterVolume, c.currentTime);
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
      gain.gain.setValueAtTime(0.09 * masterVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {
    /* never let audio break a roll */
  }
};

/**
 * Fallback vine boom, synthesised: a hard transient over a low sine dropping
 * ~200Hz to ~32Hz through a soft-clipper.
 *
 * Only used if `public/audio/vine-boom.mp3` fails to load. The real sample is
 * vendored, so in practice this is a safety net rather than the normal path.
 */
const synthBoom = (volume: number) => {
  try {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;

    // Soft-clipping curve: gentle in the middle, hard at the shoulders.
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 3.2);
    }
    const shaper = c.createWaveShaper();
    shaper.curve = curve;

    const out = c.createGain();
    out.gain.value = volume * masterVolume;
    shaper.connect(out).connect(c.destination);

    // Body: the drop itself.
    const osc = c.createOscillator();
    const body = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.38);
    body.gain.setValueAtTime(0.0001, t);
    body.gain.exponentialRampToValueAtTime(1, t + 0.006); // near-instant attack
    body.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    osc.connect(body).connect(shaper);
    osc.start(t);
    osc.stop(t + 1);

    // Transient: a very short noise smack so the hit has an edge.
    const frames = Math.floor(c.sampleRate * 0.05);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
    }
    const noise = c.createBufferSource();
    noise.buffer = buf;
    const crack = c.createGain();
    crack.gain.value = 0.35;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    noise.connect(lp).connect(crack).connect(shaper);
    noise.start(t);
  } catch {
    /* never let audio break a roll */
  }
};

/**
 * The decoded vine boom, and the in-flight decode. Loaded through the shared
 * AudioContext rather than an <audio> element on purpose: `unlockAudio()`
 * already resumes that context on the DECIDE click, so playback needs no
 * autoplay permission of its own. The element route kept losing a play()
 * promise to the autoplay policy and silently demoting the whole session to
 * the synthesised stand-in.
 */
let boomBuffer: AudioBuffer | null = null;
let boomLoad: Promise<AudioBuffer | null> | null = null;

const loadBoom = (c: AudioContext): Promise<AudioBuffer | null> => {
  boomLoad ??= fetch(asset('audio/vine-boom.mp3'))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((bytes) => c.decodeAudioData(bytes))
    .then((buf) => {
      boomBuffer = buf;
      return buf;
    })
    // Only a genuine fetch/decode failure lands here — i.e. the file is
    // missing or corrupt, which is when the synth is the right answer.
    .catch(() => null);
  return boomLoad;
};

/** Decode the boom ahead of the first stinger. Called from `unlockAudio`. */
export const primeVineBoom = () => {
  const c = getCtx();
  if (c) void loadBoom(c);
};

/**
 * The vine boom, for the screen-flash stingers.
 *
 * Returns a stop handle; the caller calls it when the visual goes away, so a
 * boom can never play over a screen that has moved on.
 */
export const playVineBoom = (volume = 0.7): (() => void) => {
  const c = getCtx();
  if (!c) return () => {};
  if (c.state === 'suspended') void c.resume();

  let source: AudioBufferSourceNode | null = null;
  let cancelled = false;

  const start = (buf: AudioBuffer) => {
    if (cancelled) return;
    try {
      const gain = c.createGain();
      gain.gain.value = volume * masterVolume;
      source = c.createBufferSource();
      source.buffer = buf;
      source.connect(gain).connect(c.destination);
      source.start();
    } catch {
      /* never let audio break a roll */
    }
  };

  if (boomBuffer) {
    start(boomBuffer);
  } else {
    void loadBoom(c).then((buf) => {
      if (cancelled) return;
      if (buf) start(buf);
      else synthBoom(volume);
    });
  }

  return () => {
    cancelled = true;
    try {
      source?.stop();
    } catch {
      /* already finished */
    }
  };
};
