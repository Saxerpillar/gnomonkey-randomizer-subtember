import { asset } from '../asset';
import type { Challenge } from './challenges';
import { CountdownTimer } from './CountdownTimer';
import { hardModeLabel } from './objectives';
import type { Boss } from './DataProvider';
import styles from './BossPanel.module.css';

export const BossPanel = ({
  boss,
  revealing,
  hardMode,
  objective,
}: {
  boss: Boss | null;
  revealing?: boolean;
  /** The rolled fight is this boss's hard-mode variant. */
  hardMode?: boolean;
  /** Scaled depth objective (delve/wave bosses) instead of a plain kill. */
  objective?: string | null;
}) => (
  <div className={styles.panel}>
    <div className={styles.stage} data-boss="true">
      {boss ? (
        <>
          <img
            key={boss.name /* retrigger fade on reroll */}
            className={styles.render}
            src={asset(`img/bosses/${encodeURIComponent(boss.image)}`)}
            alt={boss.name}
          />
          <div className={styles.name}>{boss.name}</div>
          {hardMode && <div className={styles.hardMode}>{hardModeLabel(boss)}</div>}
          {objective && <div className={styles.objective}>{objective}</div>}
        </>
      ) : revealing ? (
        <div className={styles.question}>?</div>
      ) : (
        <div className={styles.hint}>Roll a boss to slay…</div>
      )}
    </div>
  </div>
);

/** The rolled extra challenge — a line, plus a live countdown when it's timed. */
/** The rolled extra challenge, or a note that this run drew none. The AHHHH
 *  gnome that used to sit beside the text is a full-screen stinger now. */
/**
 * The rolled extra challenge. Renders nothing at all when a run draws none —
 * an empty dashed box saying "None this run" is a reminder of something that
 * did not happen, and most runs do not draw one.
 */
export const ChallengePanel = ({ challenge }: { challenge: Challenge | null }) =>
  challenge ? (
    <div className={styles.challenge}>
      <span className={styles.challengeTitle}>Extra challenge</span>
      <span className={styles.challengeValue}>{challenge.text}</span>
      {challenge.timerSeconds != null && <CountdownTimer seconds={challenge.timerSeconds} />}
    </div>
  ) : null;
