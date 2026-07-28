import { formatGp } from '../engine/parse';
import styles from './GpValue.module.css';

/** A gp amount with the coins sprite — the one way we render money anywhere. */
export const GpValue = ({ gp, className }: { gp: number; className?: string }) => (
  <span className={`${styles.gp} ${className ?? ''}`}>
    <img src="/img/coins.png" alt="gp" />
    {formatGp(gp)}
  </span>
);
