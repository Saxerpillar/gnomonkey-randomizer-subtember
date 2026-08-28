import { useLayoutEffect, useRef } from 'react';
import { asset } from '../asset';
import { RsButton } from '../theme/RsButton';
import { RsTooltip } from '../theme/RsTooltip';
import { GnomePeek } from '../theme/GnomePeek';
import type { Boss } from './DataProvider';
import { availableBosses, type NuzlockeRun } from './nuzlocke';
import { filterBossPool, type Settings } from './settings';
import styles from './NuzlockeScreen.module.css';

const BackIcon = () => (
  <svg className={styles.backIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
);

/**
 * The dedicated Nuzlocke run-start screen.
 *
 * Replaces the pre-roll hero while Nuzlocke mode is on. The board is the
 * centrepiece: every boss still in the pool, crossed off as it gets fought, so
 * the stream can watch the pool shrink. Every roll draws a boss you haven't
 * fought until the pool is cleared, then the cycle silently starts over.
 *
 * The board is editable: clicking a boss cycles it not rolled -> completed ->
 * uncompleted -> not rolled, so a missed or mistaken mark can be fixed live.
 * Once the run is underway the gameplay settings lock; Pause opens them without
 * losing the board, and Reset nuzlocke abandons the run.
 */
export const NuzlockeScreen = ({
  bosses,
  settings,
  nuzlocke,
  nuzlockeName,
  decideReady,
  onCycleBoss,
  onReset,
  onTogglePause,
  onExit,
  onDecide,
  onOpenSettings,
  onOpenHistory,
}: {
  bosses: readonly Boss[];
  settings: Settings;
  nuzlocke: NuzlockeRun;
  /** The run's user-facing name, or null before the first roll commits. */
  nuzlockeName: string | null;
  decideReady: boolean;
  onCycleBoss: (name: string) => void;
  onReset: () => void;
  onTogglePause: () => void;
  onExit: () => void;
  onDecide: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}) => {
  const pool = filterBossPool(bosses, settings);
  // Alphabetical by the boss's CURRENT name (a rename, e.g. Great Olm to
  // Chambers of Xeric, must move the tile with it, not leave it in its old
  // data-file position).
  const sortedPool = [...pool].sort((a, b) => a.name.localeCompare(b.name));
  const { states } = nuzlocke;
  const total = pool.length;
  const available = availableBosses(pool, states).length;
  const cleared = available === 0;
  const clearedCount = pool.filter((b) => states[b.name] === 'completed').length;
  // A run exists once its first roll committed (its id was assigned); before
  // that this is the NEW RUN screen.
  const runInProgress = nuzlocke.id != null;

  // Same card treatment as the boss pool's icon view: names wrap to different
  // line counts, so every tile is sized to the tallest. The pass is forced
  // whenever the pool (settings) changes — the largest tile may have left or
  // joined — and re-runs on genuine resizes via the observer.
  const boardRef = useRef<HTMLDivElement | null>(null);
  const lastWidth = useRef(0);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    lastWidth.current = 0; // force a full pass on mount and on pool changes
    const equalize = () => {
      const w = el.offsetWidth;
      if (w === lastWidth.current) return;
      lastWidth.current = w;
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
  }, [settings, bosses]);

  return (
    <div className={styles.screen}>
      {/* Corner-pinned, so they can never sit on the centered two-row title. */}
      <button
        type="button"
        className={styles.back}
        aria-label="Back to free play"
        data-solid=""
        onClick={onExit}
      >
        <BackIcon />
      </button>
      <div className={styles.corner} data-solid="">
        {runInProgress && (
          <button type="button" className={styles.cornerBtn} onClick={onTogglePause}>
            {nuzlocke.paused ? 'Resume nuzlocke' : 'Pause nuzlocke'}
          </button>
        )}
        <button type="button" className={styles.reset} onClick={onReset}>
          Reset nuzlocke
        </button>
      </div>
      <div className={styles.head} data-solid="strict">
        <span className={`${styles.tag} ${cleared ? styles.tagDone : ''}`}>
          {cleared ? 'Nuzlocke completed!' : runInProgress ? 'Nuzlocke' : 'NEW RUN'}
        </span>
        <div className={styles.counter}>
          <span className={styles.counterNum}>{cleared ? clearedCount : available}</span>
          <span className={styles.counterDen}>/ {total}</span>
          <span className={styles.counterLabel}>
            {cleared ? 'bosses cleared' : 'bosses left'}
          </span>
        </div>
        {(nuzlockeName || nuzlocke.paused) && (
          <span className={styles.runName}>
            {nuzlocke.paused && nuzlockeName ? `${nuzlockeName} (paused)` : nuzlocke.paused ? 'Paused' : nuzlockeName}
          </span>
        )}
      </div>
      <div className={styles.board} data-solid="strict" ref={boardRef}>
        {sortedPool.map((b) => {
          const state = states[b.name];
          return (
            <RsTooltip
              key={b.name}
              content={
                state == null ? b.name : `${b.name} (${state === 'completed' ? 'completed' : 'uncompleted'})`
              }
              className={styles.cellWrap}
            >
              <div
                className={`${styles.cell} ${state != null ? styles[state] : ''}`}
                role="button"
                aria-label={`${b.name} (${state ?? 'not rolled'})`}
                data-tile=""
                onClick={() => onCycleBoss(b.name)}
              >
                <img src={asset(`img/bosses/${b.image}`)} alt="" draggable={false} />
                {state != null && <span className={styles.tint} aria-hidden="true" />}
                {state === 'completed' && (
                  <span className={styles.mark} aria-hidden="true">✓</span>
                )}
                {state === 'uncompleted' && (
                  <span className={styles.mark} aria-hidden="true">✗</span>
                )}
                <span className={styles.cellName}>{b.name}</span>
              </div>
            </RsTooltip>
          );
        })}
      </div>
      <div className={styles.controls}>
        {/* The repeat-chance slider was removed: a nuzlocke always rolls at 0%
            (unique bosses until the pool is exhausted). */}
        <RsTooltip
          content={decideReady ? null : 'Fix your Settings first'}
          className={styles.fateWrap}
          dataSolid
        >
          <GnomePeek at="buttonTop" />
          <RsButton
            variant="primary"
            className={styles.fate}
            style={{ fontSize: 44, padding: '20px 56px', letterSpacing: 2 }}
            disabled={!decideReady}
            onClick={onDecide}
          >
            DECIDE YOUR FATE
          </RsButton>
        </RsTooltip>
      </div>
      <div className={styles.links}>
        <button className={styles.settings} onClick={onOpenSettings}>
          Settings
        </button>
        <button className={styles.settings} onClick={onOpenHistory}>
          History
        </button>
      </div>
    </div>
  );
};
