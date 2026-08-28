import { useLayoutEffect, useRef, useState } from 'react';
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

/** Material "edit": a pencil for renaming the run. */
const PenIcon = () => (
  <svg className={styles.penIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
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
 * failed -> not rolled, so a missed or mistaken mark can be fixed live.
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
  onRenameNuzlocke,
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
  onRenameNuzlocke: (id: string, name: string) => void;
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
  // that this is the NEW NUZLOCKE screen.
  const runInProgress = nuzlocke.id != null;

  // Inline rename of the run's title (the pen next to it).
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(nuzlockeName ?? '');
  const commitRename = () => {
    const v = draft.trim();
    if (v && nuzlocke.id) onRenameNuzlocke(nuzlocke.id, v);
    setRenaming(false);
  };

  // Same card treatment as the boss pool's icon view: names wrap to different
  // line counts, so every tile is sized to the tallest. The pass is forced
  // whenever the pool (settings) changes — the largest tile may have left or
  // joined — and re-runs on genuine resizes via the observer. A shrinking pool
  // widens the cards, so the art (and name) scale with them, capped.
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
      // Card width drives the art size: 100px cards keep the base 46px icon,
      // growing toward the cap as the pool thins out. Scale FIRST so the
      // height pass below measures the content at its final size.
      const cardW = tiles.length > 0 ? tiles[0].offsetWidth : 0;
      const imgSize = cardW
        ? Math.min(92, Math.max(46, 46 + Math.round((cardW - 100) * 0.8)))
        : 46;
      const nameSize = cardW
        ? Math.min(17, Math.max(14, 14 + Math.round((cardW - 100) * 0.05)))
        : 14;
      for (const t of tiles) {
        t.style.height = '';
        const img = t.querySelector<HTMLImageElement>('img');
        if (img) {
          img.style.width = `${imgSize}px`;
          img.style.height = `${imgSize}px`;
        }
        const name = t.querySelector<HTMLElement>('[data-name]');
        if (name) name.style.fontSize = `${nameSize}px`;
      }
      let max = 0;
      for (const t of tiles) max = Math.max(max, t.offsetHeight);
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
        <button type="button" className={styles.reset} onClick={onReset}>
          Reset nuzlocke
        </button>
      </div>
      <div className={styles.head} data-solid="strict">
        {renaming ? (
          <input
            className={styles.renameInput}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitRename()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <span className={styles.tagRow}>
            <span className={`${styles.tag} ${cleared ? styles.tagDone : ''}`}>
              {cleared
                ? 'Nuzlocke completed!'
                : runInProgress
                  ? (nuzlockeName ?? 'Nuzlocke')
                  : 'NEW NUZLOCKE'}
            </span>
            {runInProgress && !cleared && (
              <button
                type="button"
                className={styles.pen}
                aria-label="Rename nuzlocke"
                onClick={() => {
                  setDraft(nuzlockeName ?? '');
                  setRenaming(true);
                }}
              >
                <PenIcon />
              </button>
            )}
          </span>
        )}
        <div className={styles.counter}>
          <span className={styles.counterNum}>{cleared ? clearedCount : available}</span>
          <span className={styles.counterDen}>/ {total}</span>
          <span className={styles.counterLabel}>
            {cleared ? 'bosses completed' : 'bosses left'}
          </span>
        </div>
      </div>
      <div className={styles.board} data-solid="strict" ref={boardRef}>
        {sortedPool.map((b) => {
          const state = states[b.name];
          return (
            <RsTooltip
              key={b.name}
              content={
                state == null ? b.name : `${b.name} (${state === 'completed' ? 'completed' : 'failed'})`
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
                {state === 'failed' && (
                  <span className={styles.mark} aria-hidden="true">✗</span>
                )}
                <span className={styles.cellName} data-name="">
                  {b.name}
                </span>
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
