import { useState } from 'react';
import { asset } from '../asset';
import { formatGp, gpTier, groupDigits, parseBudget } from '../engine/parse';
import { RsButton } from '../theme/RsButton';
import { RsPanel } from '../theme/RsPanel';
import {
  FORCE_BOSS_LABEL,
  FORCE_BOSS_OPTIONS,
  FORCE_CHALLENGE_LABEL,
  FORCE_CHALLENGE_OPTIONS,
  FORCE_TIER_OPTIONS,
  POOL_LABEL,
  POOL_TAGS,
  type ForceBoss,
  type ForceChallenge,
  type Settings,
} from './settings';
import type { Tier } from '../engine/types';
import styles from './SettingsPanel.module.css';

/** Sentinel for the "as fast as possible" end of the animation-speed scale. */
const SKIP = 'skip';

const BudgetField = ({
  label,
  value,
  onChange,
  placeholder = 'e.g. 10k/1m/100m/1b',
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}) => {
  const parsed = parseBudget(value);
  // While the input is focused you edit the raw text; on blur it previews the
  // in-game formatted amount (100000 -> 100k). Focus again to see the raw value.
  const [editing, setEditing] = useState(false);
  const display = !editing && parsed.ok && parsed.gp != null ? formatGp(parsed.gp) : value;
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.budgetWrap}>
        <img className={styles.coins} src={asset('img/coins.png')} alt="" />
        <input
          className={`${styles.budget} ${parsed.ok ? (parsed.gp != null ? styles[gpTier(parsed.gp)] : '') : styles.invalid}`}
          value={display}
          placeholder={placeholder}
          onChange={(e) => onChange(groupDigits(e.target.value))}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
        />
      </span>
    </label>
  );
};

const Choice = <T extends string>({
  label,
  value,
  options,
  labelOf,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labelOf?: (v: T) => string;
  onChange: (value: T) => void;
}) => (
  <label className={styles.field}>
    <span>{label}</span>
    <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {labelOf ? labelOf(o) : o}
        </option>
      ))}
    </select>
  </label>
);

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
    <RsPanel title="Settings" className={styles.panel} bodyClassName={styles.panelBody}>
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
          placeholder="default 1m"
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
          label="Slayer bosses"
          checked={settings.slayerBosses}
          onChange={(v) => onChange({ slayerBosses: v })}
        />
        <Toggle
          label="Sporadic bosses"
          checked={settings.sporadicBosses}
          onChange={(v) => onChange({ sporadicBosses: v })}
        />
        {POOL_TAGS.map((tag) => (
          <Toggle
            key={tag}
            label={POOL_LABEL[tag]}
            checked={!settings.excludedPools.includes(tag)}
            onChange={(v) => {
              const excluded = settings.excludedPools.filter((p) => p !== tag);
              if (!v) excluded.push(tag);
              onChange({ excludedPools: excluded });
            }}
          />
        ))}
        <Toggle
          label="Mute sounds"
          checked={settings.muteSounds}
          onChange={(v) => onChange({ muteSounds: v })}
        />
        <Toggle
          label="Remove flashbangs"
          checked={settings.removeFlashbangs}
          onChange={(v) => onChange({ removeFlashbangs: v })}
        />
        <Choice
          label="Animation speed"
          value={settings.skipAnimations ? SKIP : String(settings.ceremonySpeed)}
          options={['1', '2', '4', SKIP]}
          labelOf={(o) => (o === SKIP ? 'Skip animations' : `${o}x`)}
          onChange={(v) =>
            onChange(
              v === SKIP
                ? { skipAnimations: true }
                : // Leaving skip keeps whatever speed was picked alongside it.
                  { skipAnimations: false, ceremonySpeed: Number(v) },
            )
          }
        />
        <Toggle
          label="Debug mode"
          checked={settings.debugMode}
          onChange={(v) => onChange({ debugMode: v })}
        />
        {settings.debugMode && (
          <div className={styles.debug}>
            <span className={styles.debugTitle}>Debug</span>
            <Choice
              label="Force boss"
              value={settings.forceBoss}
              options={FORCE_BOSS_OPTIONS}
              labelOf={(o) => FORCE_BOSS_LABEL[o as ForceBoss]}
              onChange={(v) => onChange({ forceBoss: v })}
            />
            <Choice
              label="Force item tier"
              value={settings.forceTier}
              options={FORCE_TIER_OPTIONS}
              labelOf={(o) => o.charAt(0).toUpperCase() + o.slice(1)}
              onChange={(v) => onChange({ forceTier: v as Tier | 'off' })}
            />
            <Choice
              label="Force challenge"
              value={settings.forceChallenge}
              options={FORCE_CHALLENGE_OPTIONS}
              labelOf={(o) => FORCE_CHALLENGE_LABEL[o as ForceChallenge]}
              onChange={(v) => onChange({ forceChallenge: v as ForceChallenge })}
            />
            <Toggle
              label="Always hard mode"
              checked={settings.forceHardMode}
              onChange={(v) => onChange({ forceHardMode: v })}
            />
            <Toggle
              label="Ignore budget"
              checked={settings.ignoreBudget}
              onChange={(v) => onChange({ ignoreBudget: v })}
            />
            <Toggle
              label="Always flashbang (elite)"
              checked={settings.forceFlashbang}
              onChange={(v) => onChange({ forceFlashbang: v })}
            />
            <Toggle
              label="Always GAMBA"
              checked={settings.forceGamba}
              onChange={(v) => onChange({ forceGamba: v })}
            />
            <Toggle
              label="Always AHHHH emote"
              checked={settings.forceHardModeEmote}
              onChange={(v) => onChange({ forceHardModeEmote: v })}
            />
          </div>
        )}
        <RsButton variant="primary" onClick={onClose}>
          Done
        </RsButton>
      </div>
    </RsPanel>
  </div>
);
