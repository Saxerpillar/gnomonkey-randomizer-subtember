import { RsButton } from '../theme/RsButton';
import { RsPanel } from '../theme/RsPanel';
import { difficultyOf, type Difficulty } from './challenges';
import type { Boss } from './DataProvider';
import { blockedByGroupRule, type Settings } from './settings';
import styles from './BossPoolPanel.module.css';

const GROUPS: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'mid', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
];

/**
 * Per-boss on/off, grouped by the difficulty tag every boss carries.
 *
 * Sits on top of Settings rather than inside it: 55 bosses is far more than the
 * settings list can hold without burying everything below it.
 *
 * A boss can be ticked here and still not roll, because the group toggles
 * (slayer, sporadic, wilderness, pool tags) apply on top. Rather than hide that
 * or silently untick the box, each affected row says which setting is holding
 * it out — the reason comes from the same helper `filterBossPool` uses, so the
 * two cannot disagree.
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
  const excluded = new Set(settings.excludedBosses);

  const setExcluded = (next: Set<string>) => onChange({ excludedBosses: [...next] });

  const toggle = (name: string) => {
    const next = new Set(excluded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExcluded(next);
  };

  const setGroup = (group: Boss[], on: boolean) => {
    const next = new Set(excluded);
    for (const b of group) {
      if (on) next.delete(b.name);
      else next.add(b.name);
    }
    setExcluded(next);
  };

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <RsPanel title="Boss pool" className={styles.panel} bodyClassName={styles.panelBody}>
        <div className={styles.body}>
          {GROUPS.map(({ key, label }) => {
            const group = bosses
              .filter((b) => difficultyOf(b.tags) === key)
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name));
            const on = group.filter((b) => !excluded.has(b.name)).length;
            return (
              <div key={key} className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.groupTitle}>{label}</span>
                  <span className={styles.groupCount}>
                    {on}/{group.length}
                  </span>
                  <button
                    type="button"
                    className={styles.bulk}
                    onClick={() => setGroup(group, true)}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={styles.bulk}
                    onClick={() => setGroup(group, false)}
                  >
                    None
                  </button>
                </div>
                {group.map((b) => {
                  const blocked = blockedByGroupRule(b, settings);
                  return (
                    <label key={b.name} className={styles.boss}>
                      <input
                        type="checkbox"
                        checked={!excluded.has(b.name)}
                        onChange={() => toggle(b.name)}
                      />
                      <span className={styles.checkbox} aria-hidden="true" />
                      <span className={styles.bossName}>{b.name}</span>
                      {blocked && <span className={styles.blocked}>{blocked}</span>}
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
        <RsButton variant="primary" onClick={onClose}>
          Done
        </RsButton>
      </RsPanel>
    </div>
  );
};
