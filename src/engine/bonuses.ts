import { SLOTS, type Loadout, type OffensiveBonuses } from './types';

/** Aggregated loadout stats for the in-game "Equip Your Character" style panel. */
export interface LoadoutBonuses {
  attack: OffensiveBonuses;
  defence: OffensiveBonuses;
  meleeStr: number;
  rangedStr: number;
  /** Magic damage bonus in percent (already /10 from the raw x10 encoding). */
  magicDmgPercent: number;
  prayer: number;
  /** Weapon attack interval, game ticks (null when no weapon equipped). */
  speedTicks: number | null;
}

const zero = (): OffensiveBonuses => ({ stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 });

export const loadoutBonuses = (loadout: Loadout): LoadoutBonuses => {
  const out: LoadoutBonuses = {
    attack: zero(),
    defence: zero(),
    meleeStr: 0,
    rangedStr: 0,
    magicDmgPercent: 0,
    prayer: 0,
    speedTicks: loadout.weapon?.speed ?? null,
  };
  for (const slot of SLOTS) {
    const item = loadout[slot];
    if (!item) continue;
    for (const k of Object.keys(out.attack) as (keyof OffensiveBonuses)[]) {
      out.attack[k] += item.offensive?.[k] ?? 0;
      out.defence[k] += item.defensive?.[k] ?? 0;
    }
    out.meleeStr += item.bonuses?.str ?? 0;
    out.rangedStr += item.bonuses?.ranged_str ?? 0;
    out.magicDmgPercent += (item.bonuses?.magic_str ?? 0) / 10;
    out.prayer += item.bonuses?.prayer ?? 0;
  }
  return out;
};

/** 1 game tick = 0.6s — the panel shows "Base: 2.4s" like the game. */
export const speedSeconds = (ticks: number): string => `${(ticks * 0.6).toFixed(1)}s`;
