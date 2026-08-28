import type { Boss } from './DataProvider';
import { CORE_SLOTS, TIERS, type Tier } from '../engine/types';

export const POOL_TAGS = ['gwd', 'dt2', 'raid', 'minigame', 'delve'] as const;
export type PoolTag = (typeof POOL_TAGS)[number];

export const POOL_LABEL: Record<PoolTag, string> = {
  gwd: 'GWD bosses',
  dt2: 'DT2 bosses',
  raid: 'Include Raids',
  minigame: 'Wave-based encounters',
  delve: 'Doom of Mokhaiotl',
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
  /** Individual bosses switched off by name, from the boss pool manager. */
  excludedBosses: string[];
  /** Drop the white screen blowout from every stinger. The art and the boom
   *  still play — this only removes the part that hurts to look at. */
  removeFlashbangs: boolean;
  /** Master volume, 0..1. 1 is the mix as tuned; the slider only attenuates. */
  volume: number;
  /**
   * Bad-RNG mitigation: the minimum number of the nine core slots that must
   * land on each tier. Counts sum to at most CORE_SLOTS.length, and a raid
   * satisfies them per skeleton rather than across the team.
   */
  tierFloors: Partial<Record<Tier, number>>;

  /** Nuzlocke: rolls avoid repeating a boss until the whole pool is fought. */
  nuzlocke: boolean;
  /** 0..1 chance a roll lands on an already-fought boss (0 = never repeat). */
  nuzlockeRepeat: number;

  // ---- debug (all inert by default; hidden unless debugMode is on) ----
  /** Master switch: reveals the debug controls in Settings. */
  debugMode: boolean;
  /** Force the boss pool down to one kind of fight. */
  forceBoss: ForceBoss;
  /** Force every rolled item to one rarity tier. */
  forceTier: Tier | 'off';
  /** Always take the hard-mode variant when the boss has one (normally 50%). */
  forceHardMode: boolean;
  /** Force the extra challenge: any one, or specifically the timed one. */
  forceChallenge: ForceChallenge;
  /** Ignore the gp budget entirely. */
  ignoreBudget: boolean;
  /** Always flashbang on an elite item landing (normally 50%). */
  forceFlashbang: boolean;
  /** Always fire the GAMBA stinger on the first reveal (normally 2%, once per run). */
  forceGamba: boolean;
  /** Show the "new version ready" prompt. It cannot appear on the dev server
   *  otherwise — there is no hashed bundle to compare against. */
  forceUpdatePrompt: boolean;
  /** Always show the AHHHH emote beside a hard-mode challenge (normally 50%). */
  forceHardModeEmote: boolean;
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

export const FORCE_CHALLENGE_OPTIONS = ['off', 'any', 'timed'] as const;
export type ForceChallenge = (typeof FORCE_CHALLENGE_OPTIONS)[number];

export const FORCE_CHALLENGE_LABEL: Record<ForceChallenge, string> = {
  off: 'Off',
  any: 'Always roll one',
  timed: 'Always the timer',
};

/** Wilderness fights cap the budget here when the field is left empty. */
export const WILDY_DEFAULT_GP = 1_000_000;

/**
 * The gp ceiling for a run, in gp, or null for unlimited.
 *
 * A wilderness fight CAPS the loadout — you should not be taking 384m into the
 * wild — so the lower of the two budgets always wins. The wildy allowance is
 * itself floored at {@link WILDY_DEFAULT_GP} so an empty or tiny field can
 * never make a wildy run unrollable.
 *
 * The cap direction is the whole point of this function: reading it as "take
 * the larger" silently disables the wilderness rule for anyone whose normal
 * budget is over 1m, which is nearly everyone.
 */
export const effectiveBudget = (
  normalGp: number | null,
  wildyGp: number | null,
  isWildy: boolean,
): number | null => {
  if (!isWildy) return normalGp;
  const cap = Math.max(wildyGp ?? WILDY_DEFAULT_GP, WILDY_DEFAULT_GP);
  return normalGp == null ? cap : Math.min(cap, normalGp);
};

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
  excludedBosses: [],
  removeFlashbangs: false,
  volume: 1,
  tierFloors: {},
  nuzlocke: false,
  nuzlockeRepeat: 0,
  debugMode: false,
  forceBoss: 'off',
  forceTier: 'off',
  forceHardMode: false,
  forceChallenge: 'off',
  ignoreBudget: false,
  forceFlashbang: false,
  forceGamba: false,
  forceUpdatePrompt: false,
  forceHardModeEmote: false,
  ceremonySpeed: 1,
};

/**
 * Settings as loaded from storage, healed against the current shape. Only
 * `forceChallenge` needs it so far: it used to be a boolean, and an old save
 * would otherwise hand the Choice control a value it cannot show.
 */
export const mergeSettings = (saved: unknown): Settings => {
  const s: Settings = { ...DEFAULT_SETTINGS, ...((saved as Partial<Settings>) ?? {}) };
  const legacy = s.forceChallenge as unknown;
  if (typeof legacy === 'boolean') s.forceChallenge = legacy ? 'any' : 'off';
  return s;
};

/** Slots still unspoken for by a tier floor. */
export const freeFloorSlots = (floors: Partial<Record<Tier, number>>): number =>
  CORE_SLOTS.length - TIERS.reduce((sum, t) => sum + (floors[t] ?? 0), 0);

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
/**
 * Why a group-level toggle is keeping this boss out, or null if none is.
 *
 * Returned as a reason rather than a boolean so the pool manager can say WHICH
 * setting is responsible — a boss ticked on in the manager but silently held
 * out by "Slayer bosses off" is the most confusing state this UI can produce.
 * `filterBossPool` uses the same helper, so the explanation can never drift
 * from the actual rule.
 */
export const blockedByGroupRule = (boss: Boss, settings: Settings): string | null => {
  if (settings.excludeWildy && boss.tags.includes('wildy')) return 'Wilderness excluded';
  if (!settings.slayerBosses && boss.tags.includes('slayer')) return 'Slayer bosses off';
  if (!settings.sporadicBosses && boss.tags.includes('sporadic')) return 'Sporadic bosses off';
  for (const p of settings.excludedPools) {
    if (boss.tags.includes(p)) return `${POOL_LABEL[p]} off`;
  }
  return null;
};

export const filterBossPool = (bosses: readonly Boss[], settings: Settings): Boss[] => {
  // Debug forcing bypasses the normal pool toggles: if you asked for gauntlets,
  // a "slayer bosses off" toggle should not empty the pool.
  if (settings.debugMode && settings.forceBoss !== 'off') {
    return applyForceBoss(bosses, settings.forceBoss);
  }
  return bosses.filter(
    (b) => !settings.excludedBosses.includes(b.name) && !blockedByGroupRule(b, settings),
  );
};

