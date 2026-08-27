import { asset } from '../asset';
import { GpValue } from '../theme/GpValue';
import { RsButton } from '../theme/RsButton';
import { RsPanel } from '../theme/RsPanel';
import { tally, type HistoryEntry, type Outcome } from './history';
import styles from './HistoryPanel.module.css';

const when = (at: number): string => {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * The run log: every roll, newest first, with whether it was cleared.
 *
 * Entries render from what was stored at the time rather than re-resolving
 * anything against current data — a run that happened is a fact, and a later
 * refresh that retiers an item or renames a fight must not quietly rewrite it.
 */
export const HistoryPanel = ({
  history,
  onMark,
  onClose,
}: {
  history: readonly HistoryEntry[];
  onMark: (id: string, outcome: Outcome) => void;
  onClose: () => void;
}) => {
  const counts = tally(history);
  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <RsPanel title="Run history" className={styles.panel} bodyClassName={styles.panelBody}>
        <div className={styles.summary}>
          <span className={styles.cleared}>{counts.cleared} cleared</span>
          <span className={styles.failed}>{counts.failed} failed</span>
          <span className={styles.unmarked}>{counts.unmarked} unmarked</span>
        </div>

        <div className={styles.body}>
          {history.length === 0 && (
            <span className={styles.empty}>No runs yet. Roll one and it will show up here.</span>
          )}
          {history.map((run) => (
            <div key={run.id} className={`${styles.run} ${run.outcome ? styles[run.outcome] : ''}`}>
              <img
                className={styles.bossIcon}
                src={asset(`img/bosses/${encodeURIComponent(run.bossImage)}`)}
                alt=""
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
              />
              <div className={styles.detail}>
                <span className={styles.bossName}>
                  {run.boss}
                  {run.hardModeLabel && <span className={styles.hard}>{run.hardModeLabel}</span>}
                </span>
                {run.challenge && <span className={styles.challenge}>{run.challenge}</span>}
                <span className={styles.meta}>
                  <GpValue gp={run.value} />
                  <span className={styles.at}>{when(run.at)}</span>
                </span>
                <span className={styles.gear}>
                  {run.gear.map((g, i) => (
                    <img
                      key={`${g.slot}-${i}`}
                      src={asset(`img/items/${g.icon}`)}
                      alt={g.name}
                      title={g.name}
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  ))}
                </span>
              </div>
              <div className={styles.marks}>
                <button
                  type="button"
                  className={`${styles.mark} ${run.outcome === 'cleared' ? styles.markOn : ''}`}
                  onClick={() => onMark(run.id, 'cleared')}
                  aria-pressed={run.outcome === 'cleared'}
                >
                  ✓
                </button>
                <button
                  type="button"
                  className={`${styles.mark} ${run.outcome === 'failed' ? styles.markOff : ''}`}
                  onClick={() => onMark(run.id, 'failed')}
                  aria-pressed={run.outcome === 'failed'}
                >
                  ✗
                </button>
              </div>
            </div>
          ))}
        </div>

        <RsButton variant="primary" onClick={onClose}>
          Done
        </RsButton>
      </RsPanel>
    </div>
  );
};
