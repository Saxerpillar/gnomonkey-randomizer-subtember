import { asset } from '../asset';
import { RsButton } from '../theme/RsButton';
import { RsTooltip } from '../theme/RsTooltip';
import { GnomePeek } from '../theme/GnomePeek';
import type { Boss } from './DataProvider';
import { availableBosses, type BossStates } from './nuzlocke';
import { filterBossPool, type Settings } from './settings';
import { UpdatePrompt } from './UpdatePrompt';
import styles from './NuzlockeScreen.module.css';

/**
 * The dedicated Nuzlocke run-start screen.
 *
 * Replaces the pre-roll hero while Nuzlocke mode is on. The board is the
 * centrepiece: every boss still in the pool, crossed off as it gets fought, so
 * the stream can watch the pool shrink. At 0% repeat every roll draws a boss
 * you haven't fought until the pool is cleared, then the cycle silently starts
 * over; the repeat slider trades that away when a thin pool would otherwise
 * force the same handful of fights.
 *
 * The board is editable: clicking a boss cycles it not rolled -> completed ->
 * uncompleted -> not rolled, so a missed or mistaken mark can be fixed live,
 * and the whole pool can be reset in one click.
 */
export const NuzlockeScreen = ({
  bosses,
  settings,
  bossStates,
  decideReady,
  updateReady = false,
  onChange,
  onCycleBoss,
  onReset,
  onDecide,
  onOpenSettings,
  onOpenHistory,
}: {
  bosses: readonly Boss[];
  settings: Settings;
  bossStates: BossStates;
  decideReady: boolean;
  updateReady?: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onCycleBoss: (name: string) => void;
  onReset: () => void;
  onDecide: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}) => {
  const pool = filterBossPool(bosses, settings);
  // Alphabetical by the boss's CURRENT name — a rename (Great Olm ->
  // Chambers of Xeric) must move the tile with it, not leave it in its old
  // data-file position.
  const sortedPool = [...pool].sort((a, b) => a.name.localeCompare(b.name));
  const total = pool.length;
  const available = availableBosses(pool, bossStates).length;
  const cleared = available === 0;
  const pct = Math.round(settings.nuzlockeRepeat * 100);
  return (
    <div className={styles.screen}>
      {/* Pinned top-right so it never moves the board, and always rendered —
          the only condition for it being here is the Nuzlocke screen itself. */}
      <button type="button" className={styles.reset} data-solid="" onClick={onReset}>
        Reset nuzlocke
      </button>
      <header className={styles.header} data-solid="strict">
        <span className={styles.tag}>Nuzlocke</span>
        <div className={styles.counter}>
          <span className={styles.counterNum}>{available}</span>
          <span className={styles.counterDen}>/ {cleared ? 0 : total}</span>
          <span className={styles.counterLabel}>bosses left</span>
        </div>
      </header>
      <div className={styles.board} data-solid="strict">
        {sortedPool.map((b) => {
          const state = bossStates[b.name];
          return (
            <RsTooltip
              key={b.name}
              content={
                state == null
                  ? b.name
                  : `${b.name} — ${state === 'completed' ? 'completed' : 'uncompleted'}`
              }
              className={styles.cellWrap}
            >
              <div
                className={`${styles.cell} ${state != null ? styles[state] : ''}`}
                role="button"
                aria-label={`${b.name} — ${state ?? 'not rolled'}`}
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
              </div>
            </RsTooltip>
          );
        })}
      </div>
      {cleared && (
        <p className={styles.cleared}>The whole pool is cleared — the next roll starts it over.</p>
      )}
      <div className={styles.controls}>
        <label className={styles.sliderField}>
          <span className={styles.sliderLabel}>Repeat a boss</span>
          <input
            className={styles.slider}
            type="range"
            min={0}
            max={100}
            step={5}
            value={pct}
            onChange={(e) => onChange({ nuzlockeRepeat: Number(e.target.value) / 100 })}
          />
          <span className={styles.sliderValue}>{pct}%</span>
        </label>
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
      {updateReady && <UpdatePrompt />}
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
