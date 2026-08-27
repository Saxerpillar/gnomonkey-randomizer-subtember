import type { Slot } from '../engine/types';

export type Outcome = 'cleared' | 'failed';

/** One equipped piece, flattened for storage. */
export interface HistoryGear {
  slot: Slot;
  name: string;
  icon: string;
}

/**
 * One completed roll.
 *
 * Everything displayable is denormalised on purpose. A history entry is a
 * record of what happened, so a later data refresh that retiers an item,
 * renames a boss or changes what its hard mode is called must not rewrite the
 * past — which is exactly what storing ids and re-resolving them would do.
 */
export interface HistoryEntry {
  id: string;
  /** Epoch ms, stamped when the run was rolled. */
  at: number;
  boss: string;
  bossImage: string;
  /** The wording as it stood at the time, e.g. EXPERT MODE. Null when normal. */
  hardModeLabel: string | null;
  challenge: string | null;
  value: number;
  gear: HistoryGear[];
  outcome: Outcome | null;
}

export const HISTORY_KEY = 'gnome-subtember-history-v1';

/** Kept short deliberately: this is a log to glance back at, not an archive. */
export const HISTORY_LIMIT = 50;

/** Newest first, capped. */
export const appendRun = (history: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] =>
  [entry, ...history].slice(0, HISTORY_LIMIT);

/** Sets (or clears, when it matches) a run's outcome. */
export const markOutcome = (
  history: readonly HistoryEntry[],
  id: string,
  outcome: Outcome,
): HistoryEntry[] =>
  history.map((e) =>
    // Clicking the mark a run already carries takes it back to unmarked, so a
    // misclick is undoable without a third button.
    e.id === id ? { ...e, outcome: e.outcome === outcome ? null : outcome } : e,
  );

export interface HistoryTally {
  cleared: number;
  failed: number;
  unmarked: number;
}

export const tally = (history: readonly HistoryEntry[]): HistoryTally => ({
  cleared: history.filter((e) => e.outcome === 'cleared').length,
  failed: history.filter((e) => e.outcome === 'failed').length,
  unmarked: history.filter((e) => e.outcome === null).length,
});

/** Shape-checks one stored record; anything malformed is dropped rather than
 *  crashing the app on load. */
const isEntry = (v: unknown): v is HistoryEntry => {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Partial<HistoryEntry>;
  return (
    typeof e.id === 'string' &&
    typeof e.at === 'number' &&
    typeof e.boss === 'string' &&
    Array.isArray(e.gear) &&
    (e.outcome === null || e.outcome === 'cleared' || e.outcome === 'failed')
  );
};

export const parseHistory = (raw: string | null): HistoryEntry[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, HISTORY_LIMIT);
  } catch {
    // Corrupt storage loses the log, never the app.
    return [];
  }
};

export const loadHistory = (): HistoryEntry[] => {
  try {
    return parseHistory(localStorage.getItem(HISTORY_KEY));
  } catch {
    return [];
  }
};

export const saveHistory = (history: readonly HistoryEntry[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Quota or a private window — the log is not worth breaking a roll over.
  }
};
