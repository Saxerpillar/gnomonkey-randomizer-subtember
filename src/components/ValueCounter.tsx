import { GpValue } from '../theme/GpValue';
import { playIncrement } from './sound';
import { useCountUp } from './useCountUp';
import styles from './ValueCounter.module.css';

/** Persistent ceremony counter: the loadout value rolls up as items land,
 *  ticking upward with a rising pitch (muted-gated). */
export const ValueCounter = ({ value, muted }: { value: number; muted: boolean }) => {
  const shown = useCountUp(value, 500, (progress) => {
    if (!muted) playIncrement(progress);
  });
  return (
    <div className={styles.counter}>
      <span className={styles.label}>Value</span>
      <GpValue gp={shown} />
    </div>
  );
};
