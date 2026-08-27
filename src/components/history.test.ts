import { describe, expect, it } from 'vitest';
import {
  appendRun,
  HISTORY_LIMIT,
  markOutcome,
  parseHistory,
  tally,
  type HistoryEntry,
} from './history';

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'r1',
  at: 1_700_000_000_000,
  boss: 'Zulrah',
  bossImage: 'Zulrah.png',
  hardModeLabel: null,
  challenge: null,
  value: 1_000_000,
  gear: [{ slot: 'head', name: 'Rune full helm', icon: '1163.png' }],
  outcome: null,
  ...over,
});

describe('appendRun', () => {
  it('puts the newest run first', () => {
    const out = appendRun([entry({ id: 'old' })], entry({ id: 'new' }));
    expect(out.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('caps the log rather than growing forever', () => {
    let log: HistoryEntry[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) log = appendRun(log, entry({ id: `r${i}` }));
    expect(log).toHaveLength(HISTORY_LIMIT);
    // The oldest fell off the end, not the newest.
    expect(log[0].id).toBe(`r${HISTORY_LIMIT + 19}`);
  });
});

describe('markOutcome', () => {
  const log = [entry({ id: 'a' }), entry({ id: 'b' })];

  it('marks only the run asked for', () => {
    const out = markOutcome(log, 'a', 'cleared');
    expect(out.find((e) => e.id === 'a')!.outcome).toBe('cleared');
    expect(out.find((e) => e.id === 'b')!.outcome).toBeNull();
  });

  it('switches between outcomes', () => {
    const cleared = markOutcome(log, 'a', 'cleared');
    expect(markOutcome(cleared, 'a', 'failed').find((e) => e.id === 'a')!.outcome).toBe('failed');
  });

  it('unmarks when the same outcome is clicked again — a misclick is undoable', () => {
    const cleared = markOutcome(log, 'a', 'cleared');
    expect(markOutcome(cleared, 'a', 'cleared').find((e) => e.id === 'a')!.outcome).toBeNull();
  });

  it('ignores an id that is not there', () => {
    expect(markOutcome(log, 'nope', 'cleared')).toEqual(log);
  });
});

describe('tally', () => {
  it('counts each state', () => {
    expect(
      tally([
        entry({ id: '1', outcome: 'cleared' }),
        entry({ id: '2', outcome: 'cleared' }),
        entry({ id: '3', outcome: 'failed' }),
        entry({ id: '4' }),
      ]),
    ).toEqual({ cleared: 2, failed: 1, unmarked: 1 });
  });
});

describe('parseHistory', () => {
  it('reads back what was written', () => {
    const log = [entry({ id: 'a', outcome: 'cleared' })];
    expect(parseHistory(JSON.stringify(log))).toEqual(log);
  });

  it('survives junk rather than taking the app down with it', () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory('not json')).toEqual([]);
    expect(parseHistory('{"not":"an array"}')).toEqual([]);
  });

  it('drops malformed records but keeps the good ones', () => {
    const raw = JSON.stringify([entry({ id: 'good' }), { id: 'bad' }, null, 42]);
    expect(parseHistory(raw).map((e) => e.id)).toEqual(['good']);
  });

  it('rejects an unknown outcome value', () => {
    const raw = JSON.stringify([{ ...entry(), outcome: 'maybe' }]);
    expect(parseHistory(raw)).toEqual([]);
  });
});
