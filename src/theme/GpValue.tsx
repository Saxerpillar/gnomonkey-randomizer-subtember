import { asset } from '../asset';
import { formatGp, gpTier } from '../engine/parse';
import styles from './GpValue.module.css';

/**
 * A gp amount with the coins sprite — the one way we render money anywhere.
 * Text colour follows the in-game coin tiers: yellow < 100k, white < 10m,
 * green from 10m (display capped at 10b).
 */
export const GpValue = ({ gp, className }: { gp: number; className?: string }) => (
  <span className={`${styles.gp} ${styles[gpTier(gp)]} ${className ?? ''}`}>
    <img src={asset("img/coins.png")} alt="gp" />
    {formatGp(gp)}
  </span>
);
