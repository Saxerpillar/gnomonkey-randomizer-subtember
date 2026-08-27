import { GnomePeek } from '../theme/GnomePeek';
import { UpdatePrompt } from './UpdatePrompt';
import { RsButton } from '../theme/RsButton';
import { RsTooltip } from '../theme/RsTooltip';
import styles from './PreRollScreen.module.css';

/** The pre-roll hero: one big dramatic CTA, with a small Settings link below. */
export const PreRollScreen = ({
  decideReady,
  updateReady = false,
  onDecide,
  onOpenSettings,
}: {
  decideReady: boolean;
  /** A newer build is deployed — offer a reload, under the CTA. */
  updateReady?: boolean;
  onDecide: () => void;
  onOpenSettings: () => void;
}) => (
  <div className={styles.screen}>
    <RsTooltip
      content={decideReady ? null : 'Fix your Settings first'}
      className={styles.fateWrap}
      dataSolid
    >
      {/* Before the button in the DOM on purpose: he layers behind it. */}
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
    {updateReady && <UpdatePrompt />}
    <button className={styles.settings} onClick={onOpenSettings}>
      Settings
    </button>
  </div>
);
