import { loadoutBonuses, speedSeconds } from '../engine/bonuses';
import type { Loadout } from '../engine/types';
import styles from './BonusesPanel.module.css';

const sign = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

/** In-game "Equip Your Character" style stats summary for the current loadout. */
export const BonusesPanel = ({ loadout }: { loadout: Loadout }) => {
  const b = loadoutBonuses(loadout);
  return (
    <div className={styles.panel}>
      <h3 className={styles.header}>Attack bonus</h3>
      <div className={styles.grid}>
        <span>Stab: {sign(b.attack.stab)}</span>
        <span>Magic: {sign(b.attack.magic)}</span>
        <span>Slash: {sign(b.attack.slash)}</span>
        <span>Range: {sign(b.attack.ranged)}</span>
        <span>Crush: {sign(b.attack.crush)}</span>
      </div>
      <h3 className={styles.header}>Defence bonus</h3>
      <div className={styles.grid}>
        <span>Stab: {sign(b.defence.stab)}</span>
        <span>Magic: {sign(b.defence.magic)}</span>
        <span>Slash: {sign(b.defence.slash)}</span>
        <span>Range: {sign(b.defence.ranged)}</span>
        <span>Crush: {sign(b.defence.crush)}</span>
      </div>
      <h3 className={styles.header}>Other bonuses</h3>
      <div className={styles.list}>
        <span>Melee STR: {sign(b.meleeStr)}</span>
        <span>Ranged STR: {sign(b.rangedStr)}</span>
        <span>Magic DMG: {b.magicDmgPercent >= 0 ? '+' : ''}{b.magicDmgPercent.toFixed(1)}%</span>
        <span>Prayer: {sign(b.prayer)}</span>
      </div>
      {b.speedTicks != null && (
        <>
          <h3 className={styles.header}>Weapon speed</h3>
          <div className={styles.list}>
            <span>
              Base: {speedSeconds(b.speedTicks)} ({b.speedTicks} ticks)
            </span>
          </div>
        </>
      )}
    </div>
  );
};
