import { asset } from '../asset';
import { RsButton } from '../theme/RsButton';
import { RsTooltip } from '../theme/RsTooltip';
import { GnomePeek } from '../theme/GnomePeek';
import type { Boss } from './DataProvider';
import { unusedBosses } from './nuzlocke';
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
 */
export const NuzlockeScreen = ({
  bosses,
  settings,
  usedBosses,
  decideReady,
  updateReady = false,
  onChange,
  onDecide,
  onOpenSettings,
  onOpenHistory,
}: {
  bosses: readonly Boss[];
  settings: Settings;
  usedBosses: readonly string[];
  decideReady: boolean;
  updateReady?: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onDecide: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}) => {
  const pool = filterBossPool(bosses, settings);
  const total = pool.length;
  const available = unusedBosses(pool, usedBosses).length;
  const cleared = available === 0;
  const pct = Math.round(settings.nuzlockeRepeat * 100);
  return (
    <div className={styles.screen}>
      <header className={styles.header} data-solid="strict">
        <span className={styles.tag}>Nuzlocke</span>
        <div className={styles.counter}>
          <span className={styles.counterNum}>{available}</span>
          <span className={styles.counterDen}>/ {cleared ? 0 : total}</span>
          <span className={styles.counterLabel}>bosses left</span>
        </div>
      </header>
      <div className={styles.board}>
        {pool.map((b) => {
          const fought = usedBosses.includes(b.name);
          return (
            <RsTooltip
              key={b.name}
              content={fought ? `${b.name} — fought` : b.name}
              className={styles.cellWrap}
            >
              <div className={`${styles.cell} ${fought ? styles.fought : ''}`}>
                <img src={asset(`img/bosses/${b.image}`)} alt="" draggable={false} />
                {fought && <span className={styles.foughtX} aria-hidden="true">✗</span>}
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
