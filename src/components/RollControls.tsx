import { parseBudget, formatGp } from '../engine/parse';
import { RsButton } from '../theme/RsButton';
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

  return (
    <div className={styles.controls}>
      <label className={styles.field}>
        <span>Budget</span>
        <input
          className={`${styles.budget} ${parsed.ok ? '' : styles.invalid}`}
          value={budgetText}
          placeholder="e.g. 10m — empty = no budget"
          onChange={(e) => onBudgetChange(e.target.value)}
        />
      </label>
      <label className={styles.toggle}>
        <input type="checkbox" checked={allowUntradeables} onChange={onToggleUntradeables} />
        <span>Allow untradeables (cost 0)</span>
      </label>
      <RsButton variant="primary" disabled={!parsed.ok} onClick={onRoll} title={parsed.ok ? 'Roll a loadout' : 'Fix the budget first'}>
        Roll
      </RsButton>
      <div className={styles.value}>
        Loadout value: <strong>{formatGp(totalValue)}</strong>
      </div>
    </div>
  );
};
