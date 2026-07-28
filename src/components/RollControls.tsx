import { useState } from 'react';
import { formatGp, gpTier, parseBudget } from '../engine/parse';
import { GpValue } from '../theme/GpValue';
import { RsButton } from '../theme/RsButton';
import { RsTooltip } from '../theme/RsTooltip';
import styles from './RollControls.module.css';

export const RollControls = ({
  budgetText,
  allowUntradeables,
  totalValue,
  onBudgetChange,
  onToggleUntradeables,
  onRoll,
}: {
  budgetText: string;
  allowUntradeables: boolean;
  totalValue: number;
  onBudgetChange: (text: string) => void;
  onToggleUntradeables: () => void;
  onRoll: () => void;
}) => {
  const parsed = parseBudget(budgetText);
  // While the input is focused you edit the raw text; on blur it previews the
  // in-game formatted amount (100000 -> 100k). Focus again to see the raw value.
  const [editing, setEditing] = useState(false);
  const display =
    !editing && parsed.ok && parsed.gp != null ? formatGp(parsed.gp) : budgetText;

  return (
    <div className={styles.controls}>
      <label className={styles.field}>
        <span>Budget</span>
        <span className={styles.budgetWrap}>
          <img className={styles.coins} src="/img/coins.png" alt="" />
          <input
            className={`${styles.budget} ${parsed.ok ? (parsed.gp != null ? styles[gpTier(parsed.gp)] : '') : styles.invalid}`}
            value={display}
            placeholder="e.g. 10m — empty = no budget"
            onChange={(e) => onBudgetChange(e.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
          />
        </span>
      </label>
      <label className={styles.toggle}>
        <input type="checkbox" checked={allowUntradeables} onChange={onToggleUntradeables} />
        <span>Allow untradeables (cost 0)</span>
      </label>
      <RsTooltip content={parsed.ok ? null : 'Fix the budget first'} className={styles.rollWrap}>
        <RsButton variant="primary" disabled={!parsed.ok} onClick={onRoll}>
          Roll
        </RsButton>
      </RsTooltip>
      <div className={styles.value}>
        Loadout value: <GpValue gp={totalValue} />
      </div>
    </div>
  );
};
