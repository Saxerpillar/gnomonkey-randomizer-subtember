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
  freeFloorSlots,
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) => {
  const parsed = parseBudget(value);
  // While the input is focused you edit the raw text; on blur it previews the
  // in-game formatted amount (100000 -> 100k). Focus again to see the raw value.
  const [editing, setEditing] = useState(false);
  const display = !editing && parsed.ok && parsed.gp != null ? formatGp(parsed.gp) : value;
  return (
    <label className={`${styles.field} ${disabled ? styles.dim : ''}`}>
      <span>{label}</span>
      <span className={styles.budgetWrap}>
        <img className={styles.coins} src={asset('img/coins.png')} alt="" />
        <input
          className={`${styles.budget} ${parsed.ok ? (parsed.gp != null ? styles[gpTier(parsed.gp)] : '') : styles.invalid}`}
          value={display}
          placeholder={placeholder}
          disabled={disabled}
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
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labelOf?: (v: T) => string;
  onChange: (value: T) => void;
  disabled?: boolean;
}) => (
  <label className={`${styles.field} ${disabled ? styles.dim : ''}`}>
    <span>{label}</span>
    <select
      className={styles.select}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
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
  disabled = false,
}: {
  floors: Partial<Record<Tier, number>>;
  onChange: (floors: Partial<Record<Tier, number>>) => void;
  disabled?: boolean;
}) => {
  // Collapsed by default: the panel is long, and the floors are an advanced
  // mitigation rather than something set on every run.
  const [open, setOpen] = useState(false);
  const free = freeFloorSlots(floors);
  const set = (tier: Tier, n: number) => onChange({ ...floors, [tier]: n });
  return (
    <div className={`${styles.floors} ${disabled ? styles.dim : ''}`}>
      <button
        type="button"
        className={styles.floorsHead}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.floorsTitle}>Gear quality</span>
        <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className={styles.floorsBody}>
          {[...TIERS].reverse().map((tier) => {
            const n = floors[tier] ?? 0;
            return (
              <div key={tier} className={styles.floorRow}>
                <span className={styles.floorLabel}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </span>
                <button
                  type="button"
                  className={styles.floorStep}
                  disabled={disabled || n === 0}
                  aria-label={`One fewer ${tier}`}
                  onClick={() => set(tier, n - 1)}
                >
                  −
                </button>
                {/* 0 reads as "Random" for the upper tiers; junk's default 0
                    stays a plain 0. */}
                <span
                  className={`${styles.floorCount} ${n === 0 && tier !== 'junk' ? styles.floorRandom : ''}`}
                >
                  {n === 0 && tier !== 'junk' ? 'Random' : n}
                </span>
                <button
                  type="button"
                  className={styles.floorStep}
                  disabled={disabled || free === 0}
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
      )}
    </div>
  );
};

/** 0..1 slider with a percentage readout. */
const Slider = ({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) => (
  <label className={`${styles.field} ${disabled ? styles.dim : ''}`}>
    <span>{label}</span>
    <input
      className={styles.slider}
      type="range"
      min={0}
      max={100}
      step={5}
      value={Math.round(value * 100)}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
    />
    <span className={styles.sliderValue}>{Math.round(value * 100)}%</span>
  </label>
);

const Toggle = ({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) => (
  <label className={`${styles.toggle} ${disabled ? styles.dim : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className={styles.checkbox} aria-hidden="true" />
    <span>{label}</span>
  </label>
);

/** Settings behind the pre-roll "Settings" button. Once a nuzlocke's first
 *  roll commits, every gameplay-affecting control locks while the Nuzlocke
 *  view is open (leaving the view pauses the run and unlocks these; abandoning
 *  ends it). */
export const SettingsPanel = ({
  settings,
  bosses,
  nuzlockeLocked,
  onChange,
  onAbandonNuzlocke,
  onClose,
}: {
  settings: Settings;
  bosses: readonly Boss[];
  nuzlockeLocked: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onAbandonNuzlocke: () => void;
  onClose: () => void;
}) => {
  // The pool manager opens over the top of Settings rather than replacing it,
  // so closing it puts you back exactly where you were.
  const [managingPool, setManagingPool] = useState(false);
  return (
  <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <RsPanel title="Settings" className={styles.panel} bodyClassName={styles.panelBody}>
      <div className={styles.body}>
        <div className={styles.viewRow}>
          <button
            type="button"
            className={styles.manage}
            disabled={nuzlockeLocked}
            onClick={() => setManagingPool(true)}
          >
            <img className={styles.manageIcon} src={asset('img/ui/skull.png')} alt="" />
            Manage boss pool
            {settings.excludedBosses.length > 0 && (
              <span className={styles.manageCount}>{settings.excludedBosses.length} off</span>
            )}
          </button>
        </div>
        {nuzlockeLocked && (
          <div className={styles.locked}>
            <span className={styles.lockedTitle}>Nuzlocke in progress</span>
            <p className={styles.lockedText}>
              Gameplay settings are locked for this run. Leave the Nuzlocke view to
              edit them while keeping the run, or abandon to end it.
            </p>
            <div className={styles.lockedActions}>
              <RsButton variant="danger" onClick={onAbandonNuzlocke}>
                Abandon nuzlocke
              </RsButton>
            </div>
          </div>
        )}
        <BudgetField
          label="Budget"
          value={settings.budgetText}
          onChange={(t) => onChange({ budgetText: t })}
          disabled={nuzlockeLocked}
        />
        <BudgetField
          label="Wildy budget"
          value={settings.wildyBudgetText}
          onChange={(t) => onChange({ wildyBudgetText: t })}
          placeholder="default 1m"
          disabled={nuzlockeLocked}
        />
        <TierFloors
          floors={settings.tierFloors}
          onChange={(f) => onChange({ tierFloors: f })}
          disabled={nuzlockeLocked}
        />
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
          disabled={nuzlockeLocked}
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
              disabled={nuzlockeLocked}
            />
            <Choice
              label="Force item tier"
              value={settings.forceTier}
              options={FORCE_TIER_OPTIONS}
              labelOf={(o) => o.charAt(0).toUpperCase() + o.slice(1)}
              onChange={(v) => onChange({ forceTier: v as Tier | 'off' })}
              disabled={nuzlockeLocked}
            />
            <Choice
              label="Force challenge"
              value={settings.forceChallenge}
              options={FORCE_CHALLENGE_OPTIONS}
              labelOf={(o) => FORCE_CHALLENGE_LABEL[o as ForceChallenge]}
              onChange={(v) => onChange({ forceChallenge: v as ForceChallenge })}
              disabled={nuzlockeLocked}
            />
            <Toggle
              label="Always hard mode"
              checked={settings.forceHardMode}
              onChange={(v) => onChange({ forceHardMode: v })}
              disabled={nuzlockeLocked}
            />
            <Toggle
              label="Ignore budget"
              checked={settings.ignoreBudget}
              onChange={(v) => onChange({ ignoreBudget: v })}
              disabled={nuzlockeLocked}
            />
            <Toggle
              label="Always flashbang (elite)"
              checked={settings.forceFlashbang}
              onChange={(v) => onChange({ forceFlashbang: v })}
              disabled={nuzlockeLocked}
            />
            <Toggle
              label="Always GAMBA"
              checked={settings.forceGamba}
              onChange={(v) => onChange({ forceGamba: v })}
              disabled={nuzlockeLocked}
            />
            <Toggle
              label="Show update prompt"
              checked={settings.forceUpdatePrompt}
              onChange={(v) => onChange({ forceUpdatePrompt: v })}
              disabled={nuzlockeLocked}
            />
            <Toggle
              label="Always AHHHH emote"
              checked={settings.forceHardModeEmote}
              onChange={(v) => onChange({ forceHardModeEmote: v })}
              disabled={nuzlockeLocked}
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
