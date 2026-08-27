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
  freeFloorSlots,
  POOL_TAGS,
  type ForceBoss,
  type ForceChallenge,
  type Settings,
} from './settings';
import { CORE_SLOTS, TIERS, type Tier } from '../engine/types';
import { BossPoolPanel } from './BossPoolPanel';
import type { Boss } from './DataProvider';
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

/**
 * Bad-RNG mitigation: a floor on how many of the nine core slots must land on
 * each tier.
 *
 * Floors rather than min/max ranges, because the failure being mitigated is
 * one-sided — an all-junk loadout — and a max would add a whole class of
 * unsatisfiable combinations to solve a problem nobody has. The counters share
 * one pool of nine, and `+` disables once it is spent, so over-allocation is
 * unreachable rather than merely rejected.
 */
const TierFloors = ({
  floors,
  onChange,
}: {
  floors: Partial<Record<Tier, number>>;
  onChange: (floors: Partial<Record<Tier, number>>) => void;
}) => {
  const free = freeFloorSlots(floors);
  const set = (tier: Tier, n: number) => onChange({ ...floors, [tier]: n });
  return (
    <div className={styles.floors}>
      <span className={styles.floorsTitle}>Minimum gear quality</span>
      {[...TIERS].reverse().map((tier) => {
        const n = floors[tier] ?? 0;
        return (
          <div key={tier} className={styles.floorRow}>
            <span className={styles.floorLabel}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
            <button
              type="button"
              className={styles.floorStep}
              disabled={n === 0}
              aria-label={`One fewer ${tier}`}
              onClick={() => set(tier, n - 1)}
            >
              −
            </button>
            <span className={styles.floorCount}>{n}</span>
            <button
              type="button"
              className={styles.floorStep}
              disabled={free === 0}
              aria-label={`One more ${tier}`}
              onClick={() => set(tier, n + 1)}
            >
              +
            </button>
          </div>
        );
      })}
      <span className={styles.floorsFree}>
        {free} of {CORE_SLOTS.length} slots left to chance
      </span>
    </div>
  );
};

/** 0..1 slider with a percentage readout. */
const Slider = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <label className={styles.field}>
    <span>{label}</span>
    <input
      className={styles.slider}
      type="range"
      min={0}
      max={100}
      step={5}
      value={Math.round(value * 100)}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
    />
    <span className={styles.sliderValue}>{Math.round(value * 100)}%</span>
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
  bosses,
  onChange,
  onClose,
}: {
  settings: Settings;
  bosses: readonly Boss[];
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) => {
  // The pool manager opens over the top of Settings rather than replacing it,
  // so closing it puts you back exactly where you were.
  const [managingPool, setManagingPool] = useState(false);
  return (
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
        <TierFloors floors={settings.tierFloors} onChange={(f) => onChange({ tierFloors: f })} />
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
        <button
          type="button"
          className={styles.manage}
          onClick={() => setManagingPool(true)}
        >
          Manage boss pool
          {settings.excludedBosses.length > 0 && (
            <span className={styles.manageCount}>{settings.excludedBosses.length} off</span>
          )}
        </button>
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
        <Slider
          label="Volume"
          value={settings.volume}
          onChange={(v) => onChange({ volume: v })}
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
              label="Show update prompt"
              checked={settings.forceUpdatePrompt}
              onChange={(v) => onChange({ forceUpdatePrompt: v })}
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
    {managingPool && (
      <BossPoolPanel
        bosses={bosses}
        settings={settings}
        onChange={onChange}
        onClose={() => setManagingPool(false)}
      />
    )}
  </div>
  );
};



