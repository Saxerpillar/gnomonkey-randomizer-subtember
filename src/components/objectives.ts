/**
 * Boss-specific objectives that scale with how good the rolled gear is: some
 * fights aren't "kill it", they're "get as deep as your kit allows". The depth
 * scales linearly with loadout value, from a floor at 0 gp to a cap at 200m.
 */
/** Loadout-value scale for ordinary objective scaling (gp / cap). */
export const VALUE_CAP = 200_000_000;

interface ObjectiveSpec {
  /** Rendered line, given the scaled number. */
  label: (n: number) => string;
  /** Depth at 0 gp. */
  min: number;
  /** Depth at (or above) the value cap. */
  max: number;
  /** Wave at which the final-boss fight replaces the "complete wave N" line. */
  bossWave?: number;
  /** Shown instead of the wave line at `bossWave` and beyond. */
  bossLabel?: string;
}

const OBJECTIVES: Record<string, ObjectiveSpec> = {
  'Doom of Mokhaiotl': { label: (n) => `Complete delve ${n}`, min: 4, max: 16 },
  'Fortis Colosseum': {
    label: (n) => `Complete wave ${n}`,
    min: 4,
    max: 12,
    bossWave: 9,
    bossLabel: 'Defeat Sol Heredit',
  },
  'The Inferno': {
    label: (n) => `Complete wave ${n}`,
    min: 18,
    max: 69,
    bossWave: 58,
    bossLabel: 'Defeat TzKal-Zuk',
  },
  'TzTok-Jad': {
    label: (n) => `Complete wave ${n}`,
    min: 8,
    max: 63,
    bossWave: 45,
    bossLabel: 'Defeat TzTok-Jad',
  },
};

/**
 * What a boss's upgraded version is actually called. Every fight has its own
 * word for it, and "HARD MODE" on Tombs of Amascut is simply wrong.
 *
 * Uppercase because the stamp has no text-transform — the caps are the string.
 */
const HARD_MODE_NAME: Record<string, string> = {
  'Tombs of Amascut': 'EXPERT MODE',
  // Chambers of Xeric is the raid; the Olm is the fight.
  'Chambers of Xeric': 'CHALLENGE MODE',
  Brutus: 'DEMONIC BRUTUS',
};

export const hardModeLabel = (boss: { name: string; tags: string[] } | null): string => {
  if (!boss) return 'HARD MODE';
  // The Desert Treasure II bosses share one word for it.
  return HARD_MODE_NAME[boss.name] ?? (boss.tags.includes('dt2') ? 'AWAKENED' : 'HARD MODE');
};

/** The scaled objective for this boss, or null when it's an ordinary kill.
 *  `progress01` is the 0..1 power lever — for ordinary fights the loadout
 *  value over the cap, for wave-based fights the tier-point gear score. */
export const bossObjective = (bossName: string, progress01: number): string | null => {
  const spec = OBJECTIVES[bossName];
  if (!spec) return null;
  const t = Math.min(1, Math.max(0, progress01));
  const depth = Math.round(spec.min + t * (spec.max - spec.min));
  // A strong enough kit skips the climb and names the final boss instead.
  if (spec.bossWave != null && depth >= spec.bossWave && spec.bossLabel != null) {
    return spec.bossLabel;
  }
  return spec.label(depth);
};
