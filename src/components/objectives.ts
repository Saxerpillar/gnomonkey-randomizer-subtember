/**
 * Boss-specific objectives that scale with how good the rolled gear is: some
 * fights aren't "kill it", they're "get as deep as your kit allows". The depth
 * scales linearly with loadout value, from a floor at 0 gp to a cap at 200m.
 */
const VALUE_CAP = 200_000_000;

interface ObjectiveSpec {
  /** Rendered line, given the scaled number. */
  label: (n: number) => string;
  /** Depth at 0 gp. */
  min: number;
  /** Depth at (or above) the value cap. */
  max: number;
}

const OBJECTIVES: Record<string, ObjectiveSpec> = {
  'Doom of Mokhaiotl': { label: (n) => `Complete delve ${n}`, min: 4, max: 16 },
  'Fortis Colosseum': { label: (n) => `Complete wave ${n}`, min: 4, max: 12 },
  'The Inferno': { label: (n) => `Complete wave ${n}`, min: 18, max: 69 },
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
};

export const hardModeLabel = (boss: { name: string; tags: string[] } | null): string => {
  if (!boss) return 'HARD MODE';
  // The Desert Treasure II bosses share one word for it.
  return HARD_MODE_NAME[boss.name] ?? (boss.tags.includes('dt2') ? 'AWAKENED' : 'HARD MODE');
};

/** The scaled objective for this boss, or null when it's an ordinary kill. */
export const bossObjective = (bossName: string, loadoutGp: number): string | null => {
  const spec = OBJECTIVES[bossName];
  if (!spec) return null;
  const t = Math.min(1, Math.max(0, loadoutGp / VALUE_CAP));
  return spec.label(Math.round(spec.min + t * (spec.max - spec.min)));
};
