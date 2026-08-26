import { RsButton } from '../theme/RsButton';
import { RsTooltip } from '../theme/RsTooltip';
import styles from './PreRollScreen.module.css';

/** The pre-roll hero: one big dramatic CTA, with a small Settings link below. */
export const PreRollScreen = ({
  decideReady,
  onDecide,
  onOpenSettings,
}: {
  decideReady: boolean;
  onDecide: () => void;
  onOpenSettings: () => void;
}) => (
  <div className={styles.screen}>
    <RsTooltip content={decideReady ? null : 'Fix your Settings first'} className={styles.fateWrap}>
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
    <button className={styles.settings} onClick={onOpenSettings}>
      Settings
    </button>
  </div>
);
