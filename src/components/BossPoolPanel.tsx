import { useLayoutEffect, useRef, useState } from 'react';
import { asset } from '../asset';
import { RsButton } from '../theme/RsButton';
import { RsPanel } from '../theme/RsPanel';
import { RsTooltip } from '../theme/RsTooltip';
import { difficultyOf, type Difficulty } from './challenges';
import type { Boss } from './DataProvider';
import {
  blockedByGroupRule,
  isBossAvailable,
  POOL_TAGS,
  type PoolTag,
  type Settings,
} from './settings';
import { alphaKey } from './copy';
import styles from './BossPoolPanel.module.css';

const GROUPS: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'mid', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
];

type GroupKey = 'wildy' | 'slayer' | 'sporadic' | PoolTag | 'other';

/** The group-level toggles that shape the pool, shown above the bosses.
 *  "Other" covers every boss not in any of the tagged categories. */
const GROUP_TOGGLES: { key: GroupKey; label: string }[] = [
  { key: 'wildy', label: 'Wilderness' },
  { key: 'slayer', label: 'Slayer' },
  { key: 'sporadic', label: 'Sporadic' },
  { key: 'gwd', label: 'GWD' },
  { key: 'dt2', label: 'DT2' },
  { key: 'raid', label: 'Raids' },
  { key: 'wave-based', label: 'Wave-based' },
  { key: 'quest', label: 'Quest' },
  { key: 'other', label: 'Other' },
];

/** The tags the named categories cover; "other" is the complement. */
const GROUP_TAGS = ['wildy', 'slayer', 'sporadic', ...POOL_TAGS];

const inCategory = (key: GroupKey, boss: Boss): boolean =>
  key === 'other'
    ? !GROUP_TAGS.some((t) => boss.tags.includes(t))
    : boss.tags.includes(key);

/** Whether a boss can roll its hard-mode variant (its "Hard mode" button). */
const hardModeEligible = (boss: Boss, settings: Settings): boolean =>
  !settings.normalOnlyBosses.includes(boss.name);

/** Material "view list": three stacked rows. */
const ListIcon = () => (
  <svg className={styles.viewIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 14h4v-4H3v4zm0 5h4v-4H3v4zM3 9h4V5H3v4zm5 5h13v-4H8v4zm0 5h13v-4H8v4zM8 5v4h13V5H8z" />
  </svg>
);

/** Material "grid view": four panes. */
const GridIcon = () => (
  <svg className={styles.viewIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z" />
  </svg>
);

/**
 * The per-boss pool manager: which fights are in, which stay out, and whether
 * a fight's hard-mode variant may roll.
 *
 * Everything that shapes the pool lives here — the group toggles (wilderness,
 * slayer, sporadic, and the tagged pools) plus per-boss on/off. Two views: the
 * list, grouped by difficulty with a reason for anything a group toggle is
 * holding out, and an icon grid that reads like the Nuzlocke board.
 */
export const BossPoolPanel = ({
  bosses,
  settings,
  onChange,
  onClose,
}: {
  bosses: readonly Boss[];
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) => {
  const [view, setView] = useState<'list' | 'icons'>('list');
  /** Collapsed difficulty groups in list view. */
  const [collapsed, setCollapsed] = useState<Partial<Record<Difficulty, boolean>>>({});
  const excluded = new Set(settings.excludedBosses);

  // Icon view: names wrap to different line counts, which would give cards
  // ragged heights. Measure once per layout and size every tile to the
  // tallest, so the grid reads as a uniform board. Guarded by the grid's
  // width: toggling a boss re-renders but must not touch heights (or the
  // scroll position) — only a real resize does.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const lastGridWidth = useRef(0);
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    lastGridWidth.current = 0; // full pass when the view changes
    const equalize = () => {
      const w = el.offsetWidth;
      if (w === lastGridWidth.current) return;
      lastGridWidth.current = w;
      const tiles = Array.from(el.querySelectorAll<HTMLElement>('[data-tile]'));
      let max = 0;
      for (const t of tiles) {
        t.style.height = '';
        max = Math.max(max, t.offsetHeight);
      }
      for (const t of tiles) t.style.height = `${max}px`;
    };
    equalize();
    const ro = new ResizeObserver(equalize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, bosses]);

  /** Toggle one boss's effective availability: individual choice wins over the
   *  group rules, so turning a held-out boss ON forces it in (includedBosses),
   *  and turning one OFF records the exclusion. */
  const toggle = (name: string) => {
    const boss = bosses.find((b) => b.name === name);
    const on = boss ? isBossAvailable(boss, settings) : !excluded.has(name);
    const nextExcluded = new Set(excluded);
    const nextIncluded = new Set(settings.includedBosses ?? []);
    if (on) {
      nextExcluded.add(name);
      nextIncluded.delete(name);
    } else {
      nextExcluded.delete(name);
      nextIncluded.add(name);
    }
    onChange({
      excludedBosses: [...nextExcluded],
      includedBosses: [...nextIncluded],
    });
  };

  const setGroup = (group: Boss[], on: boolean) => {
    const nextExcluded = new Set(excluded);
    const nextIncluded = new Set(settings.includedBosses ?? []);
    for (const b of group) {
      if (on) {
        nextExcluded.delete(b.name);
        nextIncluded.add(b.name);
      } else {
        nextExcluded.add(b.name);
        nextIncluded.delete(b.name);
      }
    }
    onChange({
      excludedBosses: [...nextExcluded],
      includedBosses: [...nextIncluded],
    });
  };

  /**
   * The category chip's live state, derived from its bosses' actual
   * availability (individual choices override group rules): all on (green),
   * some on (yellow) or none on (red).
   */
  const categoryState = (key: GroupKey): { on: number; total: number } => {
    const group = bosses.filter((b) => inCategory(key, b));
    const on = group.filter((b) => isBossAvailable(b, settings)).length;
    return { on, total: group.length };
  };

  const toggleGroup = (key: GroupKey, on: boolean) => {
    // The category chip does BOTH: it flips the group setting AND sets every
    // boss in that category on/off individually, so the click actually moves
    // the bosses rather than just red-listing them. "Other" has no group
    // setting of its own — only the individual toggles.
    const nextExcluded = new Set(settings.excludedBosses);
    const nextIncluded = new Set(settings.includedBosses ?? []);
    for (const b of bosses) {
      if (!inCategory(key, b)) continue;
      if (on) {
        nextExcluded.delete(b.name);
        nextIncluded.delete(b.name);
      } else {
        nextExcluded.add(b.name);
        nextIncluded.delete(b.name);
      }
    }
    const patch: Partial<Settings> = {
      excludedBosses: [...nextExcluded],
      includedBosses: [...nextIncluded],
    };
    if (key === 'wildy') patch.excludeWildy = !on;
    else if (key === 'slayer') patch.slayerBosses = on;
    else if (key === 'sporadic') patch.sporadicBosses = on;
    else if (key !== 'other') {
      const excludedPools = settings.excludedPools.filter((p) => p !== key);
      if (!on) excludedPools.push(key as PoolTag);
      patch.excludedPools = excludedPools;
    }
    onChange(patch);
  };

  const toggleHardMode = (name: string) => {
    const on = !settings.normalOnlyBosses.includes(name);
    onChange({
      normalOnlyBosses: on
        ? [...settings.normalOnlyBosses, name]
        : settings.normalOnlyBosses.filter((n) => n !== name),
    });
  };

  const sorted = [...bosses].sort((a, b) => a.name.localeCompare(b.name));

  /** Hard-mode toggle for a list row. Always occupies its fixed-width slot so
   *  rows line up; the slot renders empty for bosses without a hard mode. */
  const HardModeSlot = ({ boss }: { boss: Boss }) => {
    if (!boss.tags.includes('hard mode')) return <span className={styles.hmSlot} />;
    const on = hardModeEligible(boss, settings);
    return (
      <RsTooltip
        content={on ? 'Hard mode eligible' : 'Normal mode only'}
        className={styles.hmWrap}
      >
        <button
          type="button"
          className={`${styles.hm} ${on ? styles.hmOn : ''}`}
          onClick={(e) => {
            // Nested in the row's <label>, which would otherwise treat the
            // click as a boss on/off toggle.
            e.preventDefault();
            toggleHardMode(boss.name);
          }}
          aria-pressed={on}
        >
          {on ? 'Hard' : 'Normal'}
        </button>
      </RsTooltip>
    );
  };

  /** Hard-mode chip overlaid on a tile's corner in icon view, so tiles stay a
   *  uniform size and the grid rows never gap. */
  const HardModeChip = ({ boss }: { boss: Boss }) => {
    if (!boss.tags.includes('hard mode')) return null;
    const on = hardModeEligible(boss, settings);
    return (
      <RsTooltip
        content={on ? 'Hard mode eligible' : 'Normal mode only'}
        className={styles.hmChipWrap}
      >
        <button
          type="button"
          className={`${styles.hmChip} ${on ? styles.hmChipOn : ''}`}
          onClick={() => toggleHardMode(boss.name)}
          aria-pressed={on}
        >
          {on ? 'Hard' : 'Normal'}
        </button>
      </RsTooltip>
    );
  };

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <RsPanel title="Boss pool" className={styles.panel} bodyClassName={styles.panelBody}>
        <div className={styles.body}>
          <div className={styles.toolbar}>
            <div className={styles.viewSwitch}>
              <button
                type="button"
                className={`${styles.viewBtn} ${view === 'list' ? styles.viewOn : ''}`}
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
              >
                <ListIcon />
                List
              </button>
              <button
                type="button"
                className={`${styles.viewBtn} ${view === 'icons' ? styles.viewOn : ''}`}
                onClick={() => setView('icons')}
                aria-pressed={view === 'icons'}
              >
                <GridIcon />
                Icons
              </button>
            </div>
            <div className={styles.groupToggles}>
              {GROUP_TOGGLES.map((g) => {
                const { on, total } = categoryState(g.key);
                const allOn = total > 0 && on === total;
                const noneOn = on === 0;
                const stateCls = allOn
                  ? styles.groupOn
                  : noneOn
                    ? styles.groupOff
                    : styles.groupPartial;
                return (
                  <button
                    key={g.key}
                    type="button"
                    className={`${styles.groupToggle} ${stateCls}`}
                    // All on toggles everything off; anything else turns the
                    // whole category on.
                    onClick={() => toggleGroup(g.key, !allOn)}
                    aria-pressed={allOn}
                  >
                    {g.label}
                    {!allOn && !noneOn && (
                      <span className={styles.groupCount}>{on}/{total}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {view === 'list' ? (
            GROUPS.map(({ key, label }) => {
              const group = bosses
                .filter((b) => difficultyOf(b.tags) === key)
                .slice()
                .sort((a, b) => alphaKey(a.name).localeCompare(alphaKey(b.name)));
              const on = group.filter((b) => isBossAvailable(b, settings)).length;
              const open = !collapsed[key];
              return (
                <div key={key} className={styles.group}>
                  <div className={styles.groupHead}>
                    <button
                      type="button"
                      className={styles.groupTitleBtn}
                      onClick={() => setCollapsed((c) => ({ ...c, [key]: open }))}
                      aria-expanded={open}
                    >
                      <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
                      <span className={styles.groupTitle}>{label}</span>
                      <span className={styles.groupCount}>
                        {on}/{group.length}
                      </span>
                    </button>
                    <button type="button" className={styles.bulk} onClick={() => setGroup(group, true)}>
                      All
                    </button>
                    <button type="button" className={styles.bulk} onClick={() => setGroup(group, false)}>
                      None
                    </button>
                  </div>
                  {open &&
                    group.map((b) => {
                      const heldOut = blockedByGroupRule(b, settings);
                      // Held out by a group rule UNLESS the player forced it in.
                      const blocked = heldOut != null && !settings.includedBosses.includes(b.name);
                      return (
                        <label
                          key={b.name}
                          className={`${styles.boss} ${blocked ? styles.bossBlocked : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isBossAvailable(b, settings)}
                            onChange={() => toggle(b.name)}
                          />
                          <span className={styles.checkbox} aria-hidden="true" />
                          <span className={styles.bossName}>{b.name}</span>
                          <HardModeSlot boss={b} />
                          {blocked && <span className={styles.blocked}>{heldOut}</span>}
                        </label>
                      );
                    })}
                </div>
              );
            })
          ) : (
            <div className={styles.grid} ref={gridRef}>
              {sorted.map((b) => {
                const off = !isBossAvailable(b, settings);
                const heldOut = blockedByGroupRule(b, settings);
                const blocked = heldOut != null && !settings.includedBosses.includes(b.name);
                return (
                  <div key={b.name} className={styles.tileWrap}>
                    <RsTooltip
                      content={
                        blocked
                          ? `${b.name} (${heldOut})`
                          : off
                            ? `${b.name} (off)`
                            : b.name
                      }
                      className={styles.tile}
                    >
                      <button
                        type="button"
                        className={`${styles.tileBtn} ${off ? styles.tileOff : ''}`}
                        onClick={() => toggle(b.name)}
                        aria-pressed={!off}
                        data-tile=""
                      >
                        <img src={asset(`img/bosses/${encodeURIComponent(b.image)}`)} alt="" draggable={false} />
                        <span className={styles.tileName}>{b.name}</span>
                      </button>
                    </RsTooltip>
                    <HardModeChip boss={b} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <RsButton variant="primary" onClick={onClose}>
          Done
        </RsButton>
      </RsPanel>
    </div>
  );
};
