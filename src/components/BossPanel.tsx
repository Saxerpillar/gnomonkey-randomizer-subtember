import { asset } from '../asset';
import type { Challenge } from './challenges';
import { CountdownTimer } from './CountdownTimer';
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
          {hardMode && <div className={styles.hardMode}>HARD MODE</div>}
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
export const ChallengePanel = ({ challenge }: { challenge: Challenge | null }) => (
  <div className={styles.challenge}>
    <span className={styles.challengeTitle}>Extra challenge</span>
    {challenge ? (
      <>
        <span className={styles.challengeValue}>{challenge.text}</span>
        {challenge.timerSeconds != null && <CountdownTimer seconds={challenge.timerSeconds} />}
      </>
    ) : (
      <span className={styles.challengeSoon}>None this run</span>
    )}
  </div>
);
