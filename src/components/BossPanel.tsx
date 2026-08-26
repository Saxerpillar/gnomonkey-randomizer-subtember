import { asset } from '../asset';
import type { Boss } from './DataProvider';
import styles from './BossPanel.module.css';

export const BossPanel = ({ boss, revealing }: { boss: Boss | null; revealing?: boolean }) => (
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
        </>
      ) : revealing ? (
        <div className={styles.question}>?</div>
      ) : (
        <div className={styles.hint}>Roll a boss to slay…</div>
      )}
    </div>
  </div>
);

/** The rolled extra challenge, or the v1 placeholder. */
export const ChallengePanel = ({ challenge }: { challenge: string | null }) => (
  <div className={styles.challenge}>
    <span className={styles.challengeTitle}>Extra challenge</span>
    {challenge ? (
      <span className={styles.challengeValue}>{challenge}</span>
    ) : (
      <span className={styles.challengeSoon}>coming soon…</span>
    )}
  </div>
);
