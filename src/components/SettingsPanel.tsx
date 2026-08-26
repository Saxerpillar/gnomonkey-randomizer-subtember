import { useState } from 'react';
import { asset } from '../asset';
import { formatGp, gpTier, groupDigits, parseBudget } from '../engine/parse';
import { RsButton } from '../theme/RsButton';
import { RsPanel } from '../theme/RsPanel';
import { POOL_LABEL, POOL_TAGS, type Settings } from './settings';
import styles from './SettingsPanel.module.css';

const BudgetField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
}) => {
  const parsed = parseBudget(value);
  // While the input is focused you edit the raw text; on blur it previews the
  // in-game formatted amount (100000 -> 100k). Focus again to see the raw value.
  const [editing, setEditing] = useState(false);
  const display =
    !editing && parsed.ok && parsed.gp != null ? formatGp(parsed.gp) : value;
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.budgetWrap}>
        <img className={styles.coins} src={asset('img/coins.png')} alt="" />
        <input
          className={`${styles.budget} ${parsed.ok ? (parsed.gp != null ? styles[gpTier(parsed.gp)] : '') : styles.invalid}`}
          value={display}
          placeholder="e.g. 10m — empty = no budget"
          onChange={(e) => onChange(groupDigits(e.target.value))}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
        />
      </span>
    </label>
  );
};

const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <label className={styles.toggle}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className={styles.checkbox} aria-hidden="true" />
    <span>{label}</span>
  </label>
);

/** Settings behind the pre-roll "Settings" button: budget, wildy budget, and
 *  the challenge/presentation toggles. Persisted through App's reducer. */
export const SettingsPanel = ({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) => (
  <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <RsPanel title="Settings" className={styles.panel}>
      <div className={styles.body}>
        <BudgetField
          label="Budget"
          value={settings.budgetText}
          onChange={(t) => onChange({ budgetText: t })}
        />
        <BudgetField
          label="Wildy budget"
          value={settings.wildyBudgetText}
          onChange={(t) => onChange({ wildyBudgetText: t })}
        />
        <Toggle
          label="Allow untradeables (cost 0)"
          checked={settings.allowUntradeables}
          onChange={(v) => onChange({ allowUntradeables: v })}
        />
        <Toggle
          label="Exclude wilderness bosses"
          checked={settings.excludeWildy}
          onChange={(v) => onChange({ excludeWildy: v })}
        />
        <Toggle
          label="Slayer bosses (off by default)"
          checked={settings.slayerBosses}
          onChange={(v) => onChange({ slayerBosses: v })}
        />
        <Toggle
          label="Sporadic bosses (off by default)"
          checked={settings.sporadicBosses}
          onChange={(v) => onChange({ sporadicBosses: v })}
        />
        {POOL_TAGS.map((tag) => (
          <Toggle
            key={tag}
            label={`${POOL_LABEL[tag]} bosses`}
            checked={!settings.excludedPools.includes(tag)}
            onChange={(v) => {
              const excluded = settings.excludedPools.filter((p) => p !== tag);
              if (!v) excluded.push(tag);
              onChange({ excludedPools: excluded });
            }}
          />
        ))}
        <Toggle
          label="Skip animations"
          checked={settings.skipAnimations}
          onChange={(v) => onChange({ skipAnimations: v })}
        />
        <Toggle
          label="Mute sounds"
          checked={settings.muteSounds}
          onChange={(v) => onChange({ muteSounds: v })}
        />
        <RsButton variant="primary" onClick={onClose}>
          Done
        </RsButton>
      </div>
    </RsPanel>
  </div>
);
