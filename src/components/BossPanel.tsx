import type { Boss } from './DataProvider';
import { RsButton } from '../theme/RsButton';
import styles from './BossPanel.module.css';

export const BossPanel = ({ boss, onRoll }: { boss: Boss | null; onRoll: () => void }) => (
  <div className={styles.panel}>
    <div className={styles.stage}>
      {boss ? (
        <>
          <img
            key={boss.name /* retrigger fade on reroll */}
            className={styles.render}
            src={`/img/bosses/${encodeURIComponent(boss.image)}`}
            alt={boss.name}
          />
          <div className={styles.name}>{boss.name}</div>
        </>
      ) : (
        <div className={styles.hint}>Roll a boss to slay…</div>
      )}
    </div>
    <RsButton variant="primary" onClick={onRoll}>
      Roll boss
    </RsButton>
  </div>
);

/** Placeholder per design — the challenge system is a later stage. */
export const ChallengePanel = () => (
  <div className={styles.challenge}>
    <span className={styles.challengeTitle}>Extra challenge</span>
    <span className={styles.challengeSoon}>coming soon…</span>
  </div>
);
