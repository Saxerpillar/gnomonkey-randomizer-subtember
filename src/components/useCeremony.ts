import { useEffect, useMemo, useRef, useState } from 'react';
import { effectiveTier, revealBeats } from '../engine/reel';
import { SLOTS, type Item, type Loadout, type Slot, type Tier } from '../engine/types';
import type { Boss } from './DataProvider';

export type RevealData =
  | { key: string; kind: 'slot'; slot: Slot; item: Item; tier: Tier; candidates: Item[]; target: string }
  | { key: string; kind: 'boss'; boss: Boss; target: string };

export interface CeremonyView {
  /** Slots that have already locked in (locked slots are present from t=0). */
  settled: Partial<Record<Slot, Item>>;
  /** Slots whose tile is on screen and whose roll card is currently up. */
  pending: Slot[];
  /** The boss stage is visible (appears right before the boss roll). */
  bossStage: boolean;
  /** Boss reveal — null until the finale card lands. */
  boss: Boss | null;
}

type RevealStep = { kind: 'slot'; slot: Slot; item: Item } | { kind: 'boss'; item: Boss };

// Beat timing (ms). The per-card duration lives in RevealCard — the full tick
// (~3.8s) plays each reveal, so this only paces the gaps.
const SLOTS_START_MS = 800;
const BEAT_GAP_MS = 260;
const FINAL_HOLD_MS = 1200;

const buildQueue = (loadout: Loadout, boss: Boss, locked: ReadonlySet<Slot>): RevealStep[] => {
  const steps: RevealStep[] = [];
  for (const slot of revealBeats(locked).flat()) {
    const item = loadout[slot];
    if (item) steps.push({ kind: 'slot', slot, item });
  }
  steps.push({ kind: 'boss', item: boss });
  return steps;
};

/**
 * Orchestrates the DECIDE ceremony: the gear skeleton assembles tile-by-tile
 * (helmet first), each item rolling at screen centre before flying into its
 * tile, then the boss stage appears and the boss card rolls as the finale. The
 * challenge was fully rolled already; `onDone` fires once the last card held.
 */
export const useCeremony = (items: Item[]) => {
  const bySlot = useMemo(() => {
    const map = new Map<Slot, Item[]>(SLOTS.map((s) => [s, []]));
    for (const it of items) map.get(it.slot)!.push(it);
    return map;
  }, [items]);

  const [view, setView] = useState<CeremonyView | null>(null);
  const [reveal, setReveal] = useState<RevealData | null>(null);

  const timersRef = useRef<number[]>([]);
  const queueRef = useRef<RevealStep[]>([]);
  const indexRef = useRef(0);
  const tierOverridesRef = useRef<Partial<Record<Slot, Tier>>>({});
  const onDoneRef = useRef<(() => void) | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  const schedule = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => clearTimers, []);

  const advance = () => {
    const step = queueRef.current[indexRef.current];
    if (!step) {
      schedule(() => {
        setView(null);
        setReveal(null);
        const done = onDoneRef.current;
        onDoneRef.current = null;
        done?.();
      }, FINAL_HOLD_MS);
      return;
    }
    if (step.kind === 'slot') {
      setView((v) => (v ? { ...v, pending: [step.slot] } : v));
      setReveal({
        key: `${step.slot}-${step.item.id}`,
        kind: 'slot',
        slot: step.slot,
        item: step.item,
        tier: effectiveTier(step.item, tierOverridesRef.current[step.slot]),
        candidates: bySlot.get(step.slot) ?? [],
        target: `[data-slot="${step.slot}"]`,
      });
    } else {
      setView((v) => (v ? { ...v, pending: [], bossStage: true } : v));
      setReveal({ key: 'boss', kind: 'boss', boss: step.item, target: '[data-boss]' });
    }
  };

  const onRevealDone = () => {
    const step = queueRef.current[indexRef.current];
    indexRef.current += 1;
    if (step?.kind === 'slot') {
      setView((v) => (v ? { ...v, settled: { ...v.settled, [step.slot]: step.item }, pending: [] } : v));
    } else if (step?.kind === 'boss') {
      setView((v) => (v ? { ...v, boss: step.item } : v));
    }
    setReveal(null);
    schedule(advance, BEAT_GAP_MS);
  };

  const start = (
    loadout: Loadout,
    boss: Boss,
    locks: Partial<Record<Slot, Item>>,
    onDone: () => void,
    tierOverrides?: Partial<Record<Slot, Tier>>,
  ) => {
    clearTimers();
    onDoneRef.current = onDone;
    tierOverridesRef.current = tierOverrides ?? {};
    queueRef.current = buildQueue(loadout, boss, new Set(Object.keys(locks) as Slot[]));
    indexRef.current = 0;

    setView({ settled: { ...locks }, pending: [], bossStage: false, boss: null });
    setReveal(null);
    schedule(advance, SLOTS_START_MS);
  };

  return { view, reveal, start, onRevealDone, running: view !== null };
};
