import type { Boss } from './DataProvider';
import type { Tier } from '../engine/types';

export const POOL_TAGS = ['gwd', 'dt2', 'raid', 'minigame', 'delve'] as const;
export type PoolTag = (typeof POOL_TAGS)[number];

export const POOL_LABEL: Record<PoolTag, string> = {
  gwd: 'GWD',
  dt2: 'DT2',
  raid: 'Raids',
  minigame: 'Minigames',
  delve: 'Delve',
};

/** Persisted challenge settings, editable from the pre-roll Settings button. */
export interface Settings {
  budgetText: string;
  wildyBudgetText: string;
  allowUntradeables: boolean;
  excludeWildy: boolean;
  skipAnimations: boolean;
  muteSounds: boolean;
  /** Slayer bosses are eligibility toggles, default OFF. */
  slayerBosses: boolean;
  /** Sporadic bosses are not repeatable on demand, default OFF. */
  sporadicBosses: boolean;
  /** Pool tags excluded from the boss pool (gwd/dt2/raid/minigame/delve). */
  excludedPools: PoolTag[];

  // ---- debug (all inert by default; hidden unless debugMode is on) ----
  /** Master switch: reveals the debug controls in Settings. */
  debugMode: boolean;
  /** Force the boss pool down to one kind of fight. */
  forceBoss: ForceBoss;
  /** Force every rolled item to one rarity tier. */
  forceTier: Tier | 'off';
  /** Always take the hard-mode variant when the boss has one (normally 50%). */
  forceHardMode: boolean;
  /** Always roll an extra challenge (normally 15-35% by difficulty). */
  forceChallenge: boolean;
  /** Ignore the gp budget entirely. */
  ignoreBudget: boolean;
  /** Animation speed multiplier for the ceremony (1x / 2x / 4x). Not debug. */
  ceremonySpeed: number;
}

export const FORCE_BOSS_OPTIONS = ['off', 'raid', 'gauntlet', 'doom', 'wildy', 'hardmode'] as const;
export type ForceBoss = (typeof FORCE_BOSS_OPTIONS)[number];

export const FORCE_BOSS_LABEL: Record<ForceBoss, string> = {
  off: 'Off',
  raid: 'Raids only',
  gauntlet: 'Gauntlets only',
  doom: 'Doom of Mokhaiotl',
  wildy: 'Wilderness only',
  hardmode: 'Hard-mode bosses',
};

export const FORCE_TIER_OPTIONS = ['off', 'junk', 'common', 'decent', 'strong', 'elite'] as const;

/** Wilderness fights cap the budget here when the field is left empty. */
export const WILDY_DEFAULT_GP = 1_000_000;

export const DEFAULT_SETTINGS: Settings = {
  budgetText: '',
  wildyBudgetText: '',
  allowUntradeables: false,
  excludeWildy: false,
  skipAnimations: false,
  muteSounds: false,
  slayerBosses: false,
  sporadicBosses: false,
  excludedPools: [],
  debugMode: false,
  forceBoss: 'off',
  forceTier: 'off',
  forceHardMode: false,
  forceChallenge: false,
  ignoreBudget: false,
  ceremonySpeed: 1,
};

/** Narrows the pool to whatever the debug "force boss" option asks for. */
export const applyForceBoss = (bosses: readonly Boss[], force: ForceBoss): Boss[] => {
  switch (force) {
    case 'raid':
      return bosses.filter((b) => b.tags.includes('raid'));
    case 'gauntlet':
      return bosses.filter((b) => b.tags.includes('gauntlet'));
    case 'doom':
      return bosses.filter((b) => b.name === 'Doom of Mokhaiotl');
    case 'wildy':
      return bosses.filter((b) => b.tags.includes('wildy'));
    case 'hardmode':
      return bosses.filter((b) => b.tags.includes('hard mode'));
    default:
      return [...bosses];
  }
};

/** Applies every pool toggle to the boss list; used by both the roll and the
 *  DECIDE-ready check so the two can never disagree. */
export const filterBossPool = (bosses: readonly Boss[], settings: Settings): Boss[] => {
  // Debug forcing bypasses the normal pool toggles: if you asked for gauntlets,
  // a "slayer bosses off" toggle should not empty the pool.
  if (settings.debugMode && settings.forceBoss !== 'off') {
    return applyForceBoss(bosses, settings.forceBoss);
  }
  return bosses.filter((b) => {
    if (settings.excludeWildy && b.tags.includes('wildy')) return false;
    if (!settings.slayerBosses && b.tags.includes('slayer')) return false;
    if (!settings.sporadicBosses && b.tags.includes('sporadic')) return false;
    for (const p of settings.excludedPools) {
      if (b.tags.includes(p)) return false;
    }
    return true;
  });
};
