import type { Boss } from './DataProvider';

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
}

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
};

/** Applies every pool toggle to the boss list; used by both the roll and the
 *  DECIDE-ready check so the two can never disagree. */
export const filterBossPool = (bosses: readonly Boss[], settings: Settings): Boss[] =>
  bosses.filter((b) => {
    if (settings.excludeWildy && b.tags.includes('wildy')) return false;
    if (!settings.slayerBosses && b.tags.includes('slayer')) return false;
    if (!settings.sporadicBosses && b.tags.includes('sporadic')) return false;
    for (const p of settings.excludedPools) {
      if (b.tags.includes(p)) return false;
    }
    return true;
  });
