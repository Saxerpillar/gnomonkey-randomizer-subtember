import { useEffect, useReducer, useRef, useState } from 'react';
import { asset } from './asset';
import './App.css';
import { BossPanel, ChallengePanel } from './components/BossPanel';
import { EmoteScatter } from './components/EmoteScatter';
import { FitScreen } from './components/FitScreen';
import { TitleBanner } from './components/TitleBanner';
import { StingerProvider, useStinger } from './components/StingerHost';
import { useDeployWatch } from './components/useDeployWatch';
import { HistoryPanel } from './components/HistoryPanel';
import {
  appendRun,
  loadHistory,
  markOutcome,
  removeRun,
  saveHistory,
  type HistoryEntry,
  type HistoryGear,
  type Outcome,
} from './components/history';
import { usePreloadAssets } from './components/usePreloadAssets';
import { Watermark } from './components/Watermark';
import {
  difficultyOf,
  rollChallenge,
  rollGauntletChallenge,
  TIER_BIAS,
  type Challenge,
} from './components/challenges';
import { DataProvider, useGameData, type Boss } from './components/DataProvider';
import { EquipmentPanel } from './components/EquipmentPanel';
import { bossObjective, hardModeLabel } from './components/objectives';
import {
  nuzlockeLabel,
  rollNuzlockeBoss,
  type BossStates,
  type NuzlockeRun,
} from './components/nuzlocke';
import { NuzlockeScreen } from './components/NuzlockeScreen';
import { PreRollScreen } from './components/PreRollScreen';
import { ResultStage } from './components/ResultStage';
import { RevealCard, type LandingImpact } from './components/RevealCard';
import { SettingsPanel } from './components/SettingsPanel';
import { slotMenuEntries } from './components/slotMenu';
import { UpdatePrompt } from './components/UpdatePrompt';
import {
  DEFAULT_SETTINGS,
  filterBossPool,
  mergeSettings,
  effectiveBudget,
  type Settings,
} from './components/settings';
import { setMasterVolume, unlockAudio } from './components/sound';
import { useCeremony, type RevealData } from './components/useCeremony';
import { ValueCounter } from './components/ValueCounter';
import { parseBudget } from './engine/parse';
import { mulberry32, pick, randomSeed } from './engine/rng';
import {
  filterWeaponsFor,
  loadoutValue,
  roll,
  rerollSlot,
  rollForStyle,
  styleOf,
  type Style,
} from './engine/roll';
import { sortSquadByStyle } from './engine/squadSort';
import { emptyLoadout, SLOTS, type Loadout, type Slot } from './engine/types';
import { GpValue } from './theme/GpValue';
import { RsButton } from './theme/RsButton';
import { RsContextMenu, type MenuEntry } from './theme/RsContextMenu';
import { RsPanel } from './theme/RsPanel';

interface State {
  loadout: Loadout;
  boss: Boss | null;
  challenge: Challenge | null;
  /** The rolled fight is the hard-mode variant. */
  hardMode: boolean;
  /** Raids only: one style-forced setup per team member. */
  squad: { style: Style; loadout: Loadout }[] | null;
  settings: Settings;
}

type Phase = 'pre-roll' | 'ceremony' | 'result';

type Action =
  | { type: 'SET_LOADOUT'; loadout: Loadout }
  | { type: 'SET_BOSS'; boss: Boss; hardMode: boolean }
  | { type: 'SET_CHALLENGE'; challenge: Challenge | null }
  | { type: 'SET_SQUAD'; squad: { style: Style; loadout: Loadout }[] | null }
  | { type: 'REMOVE_ITEM'; slot: Slot }
  | { type: 'REROLL_SLOT'; slot: Slot; loadout: Loadout }
  | { type: 'REROLL_SQUAD_SLOT'; lane: number; loadout: Loadout }
  | { type: 'REMOVE_SQUAD_ITEM'; lane: number; slot: Slot }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> };

const STORAGE_KEY = 'gnome-subtember-v2';

/** Panel headings for the raid squad's style-forced setups. */
const STYLE_LABEL: Record<Style, string> = {
  melee: 'Melee',
  ranged: 'Ranged',
  magic: 'Magic',
};

const initialState = (): State => {
  const base: State = {
    loadout: emptyLoadout(),
    boss: null,
    challenge: null,
    hardMode: false,
    squad: null,
    settings: { ...DEFAULT_SETTINGS },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      ...base,
      settings: mergeSettings(saved.settings),
    };
  } catch {
    return base;
  }
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_LOADOUT':
      return { ...state, loadout: action.loadout };
    case 'SET_BOSS':
      return { ...state, boss: action.boss, hardMode: action.hardMode };
    case 'SET_CHALLENGE':
      return { ...state, challenge: action.challenge };
    case 'SET_SQUAD':
      return { ...state, squad: action.squad };
    // Raid lanes are independent setups, so only the lane's own loadout changes.
    case 'REROLL_SQUAD_SLOT':
      return {
        ...state,
        squad:
          state.squad?.map((lane, i) =>
            i === action.lane ? { ...lane, loadout: action.loadout } : lane,
          ) ?? null,
      };
    case 'REMOVE_SQUAD_ITEM':
      return {
        ...state,
        squad:
          state.squad?.map((lane, i) =>
            i === action.lane
              ? { ...lane, loadout: { ...lane.loadout, [action.slot]: null } }
              : lane,
          ) ?? null,
      };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'REMOVE_ITEM': {
      const loadout = { ...state.loadout, [action.slot]: null };
      return { ...state, loadout };
    }
    case 'REROLL_SLOT': {
      return { ...state, loadout: action.loadout };
    }
  }
};

const Main = () => {
  const { items, bosses } = useGameData();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [phase, setPhase] = useState<Phase>('pre-roll');
  /** Which run-start screen the pre-roll phase shows: the freeplay hero or the
   *  Nuzlocke run screen. */
  const [screen, setScreen] = useState<'main' | 'nuzlocke'>('main');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  // Warm every reel asset while the pre-roll screen is idle, so nothing pops
  // in mid-reveal.
  usePreloadAssets(items, bosses);
  const updateReady = useDeployWatch();

  // The audio layer keeps the master level in a module, so it applies to sounds
  // fired from timers and effects that never see the settings object.
  useEffect(() => {
    setMasterVolume(state.settings.volume);
  }, [state.settings.volume]);

  /** GAMBA is capped at one per DECIDE; reset when a new run is rolled. */
  const gambaFired = useRef(false);

  // The run log. Kept out of the settings blob so a corrupt log cannot take
  // the settings down with it, and vice versa.
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** The run now on screen, so the result view can mark it without a lookup. */
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const runSeq = useRef(0);

  useEffect(() => saveHistory(history), [history]);

  const markRun = (id: string, outcome: Outcome) => {
    setHistory((h) => markOutcome(h, id, outcome));
    // Reflect the fight's outcome on the Nuzlocke board: cleared -> ✓, failed -> ✗.
    const run = history.find((r) => r.id === id);
    if (run?.boss && run.nuzlockeId) {
      setNuzlocke((n) => ({
        ...n,
        states: {
          ...n.states,
          [run.boss]: outcome === 'cleared' ? 'completed' : 'uncompleted',
        },
      }));
    }
  };
  const deleteRun = (id: string) => setHistory((h) => removeRun(h, id));
  // Clicking a boss on the Nuzlocke board cycles it: not rolled -> completed ->
  // uncompleted -> not rolled, so a missed or mistaken mark can be fixed live.
  const cycleBoss = (name: string) => {
    setNuzlocke((n) => {
      const s = n.states;
      if (!(name in s)) return { ...n, states: { ...s, [name]: 'completed' } };
      if (s[name] === 'completed') return { ...n, states: { ...s, [name]: 'uncompleted' } };
      const next = { ...s };
      delete next[name];
      return { ...n, states: next };
    });
  };
  // Abandon the current run: clear the board and start over (names of past
  // nuzlockes are kept, since history still groups by them).
  const abandonNuzlocke = () => setNuzlocke({ states: {}, id: null, paused: false });
  const togglePauseNuzlocke = () => setNuzlocke((n) => ({ ...n, paused: !n.paused }));
  const renameNuzlocke = (id: string, name: string) =>
    setNuzlockeNames((m) => ({ ...m, [id]: name }));
  // Marking a run's outcome is the way home too: clicking the button you
  // already marked (the one now showing its check/x) returns to pre-roll.
  const settleRun = (id: string, outcome: Outcome) => {
    if (history.find((r) => r.id === id)?.outcome === outcome) {
      setPhase('pre-roll');
      return;
    }
    markRun(id, outcome);
  };
  // Queued on the host above every screen, so a stinger is never cut short by
  // the ceremony handing over to the result view.
  const queueStinger = useStinger();
  const pushStinger = (kind: Parameters<typeof queueStinger>[0]) =>
    queueStinger(kind, {
      muted: state.settings.muteSounds,
      noFlash: state.settings.removeFlashbangs,
    });
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    entries: MenuEntry[];
  } | null>(null);
  /** A single-slot reroll that is currently rolling on screen. */
  const [rerolling, setRerolling] = useState<{
    reveal: RevealData;
    loadout: Loadout;
    slot: Slot;
    /** Set when the reroll belongs to a raid lane rather than the main loadout. */
    lane?: number;
  } | null>(null);
  const { view, reveal, start: startCeremony, onRevealDone } = useCeremony(items);

  /** Nuzlocke progress: per-boss fight outcome for the current pool cycle,
   *  the run's stable id, and whether it is paused (settings unlocked). The
   *  states blob is kept out of the history log so a corrupt run log cannot
   *  take the pool down with it, and vice versa. */
  const [nuzlocke, setNuzlocke] = useState<NuzlockeRun>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      const raw = saved.nuzlocke;
      if (raw == null) return { states: {}, id: null, paused: false };
      // v1 stored a bare list of fought names; v2 a states map. Both promote
      // to a run with no id, which is assigned on the next committed roll.
      if (Array.isArray(raw))
        return {
          states: Object.fromEntries(raw.map((n: string) => [n, 'completed'])),
          id: null,
          paused: false,
        };
      if (typeof raw === 'object' && 'states' in (raw as object)) return raw as NuzlockeRun;
      return { states: raw as BossStates, id: null, paused: false };
    } catch {
      return { states: {}, id: null, paused: false };
    }
  });
  /** User-renamed nuzlocke labels, keyed by run id. */
  const [nuzlockeNames, setNuzlockeNames] = useState<Record<string, string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      return typeof saved.nuzlockeNames === 'object' && saved.nuzlockeNames != null
        ? (saved.nuzlockeNames as Record<string, string>)
        : {};
    } catch {
      return {};
    }
  });
  /** Next nuzlocke sequence number, so default names count up. */
  const [nuzlockeSeq, setNuzlockeSeq] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      return typeof saved.nuzlockeSeq === 'number' ? saved.nuzlockeSeq : 0;
    } catch {
      return 0;
    }
  });

  // Once a nuzlocke's first roll commits, the gameplay settings are locked in
  // until the run is paused or abandoned.
  const nuzlockeLocked = nuzlocke.id != null && !nuzlocke.paused;

  // A locked nuzlocke is no place for debug rigging: rather than sitting
  // disabled-but-on, debug mode switches itself off (pause to re-enable).
  useEffect(() => {
    if (nuzlockeLocked && state.settings.debugMode) {
      dispatch({ type: 'SET_SETTINGS', patch: { debugMode: false } });
    }
  }, [nuzlockeLocked, state.settings.debugMode]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: state.settings,
        nuzlocke,
        nuzlockeNames,
        nuzlockeSeq,
      }),
    );
  }, [state.settings, nuzlocke, nuzlockeNames, nuzlockeSeq]);

  // The browser context menu never shows anywhere in the app: any right-click
  // a component didn't claim opens the bare OSRS menu (Choose Option + Cancel).
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (!e.defaultPrevented) {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY, entries: [] });
      }
    };
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  /**
   * The gp ceiling for a fight. A wilderness boss uses the wildy budget (1m
   * when the field is blank), or the normal budget if that is HIGHER — the
   * wildy field acts as a floor so wilderness runs are never starved.
   */
  const budgetFor = (isWildy: boolean): { ok: boolean; gp: number | null } => {
    const normal = parseBudget(state.settings.budgetText);
    if (!normal.ok) return { ok: false, gp: null };
    if (!isWildy) return { ok: true, gp: normal.gp };
    const wildy = parseBudget(state.settings.wildyBudgetText);
    if (!wildy.ok) return { ok: false, gp: null };
    return { ok: true, gp: effectiveBudget(normal.gp, wildy.gp, true) };
  };

  /**
   * The weapon-pool restriction for a fight, or null when it takes any weapon.
   * `filterWeaponsFor` drops every melee weapon, keeping only the named
   * exceptions — Kraken takes none at all, Zulrah and Kree'arra keep only the
   * Noxious halberd.
   */
  const bossWeaponRule = (b: Boss | null) =>
    b?.noMeleeWeapons ? { noMelee: true, meleeExceptions: b.meleeExceptions ?? [] } : null;

  /** Reroll a single slot, leaving the rest of the loadout alone. */
  const rerollOneSlot = (slot: Slot) => {
    const { settings } = state;
    // Same budget/untradeable rules the full roll used, including the wildy override.
    const isWildy = state.boss?.tags.includes('wildy') ?? false;
    const parsed = budgetFor(isWildy);
    if (!parsed.ok) return;
    const allowUntradeables = isWildy ? false : settings.allowUntradeables;
    const pool = filterWeaponsFor(items, bossWeaponRule(state.boss));
    const rng = mulberry32(randomSeed());
    const loadout = rerollSlot(
      pool,
      state.loadout,
      slot,
      { budget: parsed.gp, allowUntradeables },
      rng,
    );
    const rolled = loadout[slot];
    if (!rolled) {
      // Nothing affordable/valid — nothing to show, just apply the (unchanged) result.
      dispatch({ type: 'REROLL_SLOT', slot, loadout });
      return;
    }
    new Image().src = asset(`img/items/${rolled.icon}`);

    if (settings.skipAnimations) {
      dispatch({ type: 'REROLL_SLOT', slot, loadout });
      return;
    }
    unlockAudio();
    setRerolling({
      slot,
      loadout,
      reveal: {
        key: `reroll-${slot}-${rolled.id}-${Date.now()}`,
        kind: 'slot',
        slot,
        item: rolled,
        tier: rolled.tier,
        candidates: items.filter((i) => i.slot === slot),
        target: `[data-slot="${slot}"]`,
      },
    });
  };

  /**
   * Reroll one slot of one raid lane. Mirrors `rerollOneSlot`, with two
   * differences: the weapon pool is filtered to the lane's style (the same
   * filter `rollForStyle` uses, so a Magic setup cannot reroll into a scimitar),
   * and the reveal targets that lane specifically — all three lanes carry the
   * same `data-slot` names, so an unscoped selector would fly the card into the
   * leftmost panel every time.
   */
  const rerollSquadSlot = (lane: number, slot: Slot) => {
    const entry = state.squad?.[lane];
    if (!entry) return;
    const { settings } = state;
    const isWildy = state.boss?.tags.includes('wildy') ?? false;
    const parsed = budgetFor(isWildy);
    if (!parsed.ok) return;
    const allowUntradeables = isWildy ? false : settings.allowUntradeables;
    const rng = mulberry32(randomSeed());
    const styled = filterWeaponsFor(
      items.filter((i) => i.slot !== 'weapon' || styleOf(i) === entry.style),
      bossWeaponRule(state.boss),
    );
    const loadout = rerollSlot(
      styled,
      entry.loadout,
      slot,
      { budget: parsed.gp, allowUntradeables },
      rng,
    );
    const rolled = loadout[slot];
    if (!rolled || settings.skipAnimations) {
      dispatch({ type: 'REROLL_SQUAD_SLOT', lane, loadout });
      return;
    }
    new Image().src = asset(`img/items/${rolled.icon}`);
    unlockAudio();
    setRerolling({
      lane,
      slot,
      loadout,
      reveal: {
        key: `reroll-${lane}-${slot}-${rolled.id}-${Date.now()}`,
        kind: 'slot',
        slot,
        item: rolled,
        tier: rolled.tier,
        candidates: styled.filter((i) => i.slot === slot),
        target: `[data-lane="${lane}"] [data-slot="${slot}"]`,
      },
    });
  };

  const openSquadSlotMenu = (lane: number, slot: Slot, e: React.MouseEvent) => {
    e.preventDefault();
    const laneLoadout = state.squad?.[lane]?.loadout;
    if (!laneLoadout) return;
    const entries = slotMenuEntries(laneLoadout, slot, {
      reroll: () => rerollSquadSlot(lane, slot),
      remove: () => dispatch({ type: 'REMOVE_SQUAD_ITEM', lane, slot }),
    });
    setMenu({ x: e.clientX, y: e.clientY, entries });
  };

  const openSlotMenu = (slot: Slot, e: React.MouseEvent) => {
    e.preventDefault();
    const entries = slotMenuEntries(state.loadout, slot, {
      reroll: () => rerollOneSlot(slot),
      remove: () => dispatch({ type: 'REMOVE_ITEM', slot }),
    });
    setMenu({ x: e.clientX, y: e.clientY, entries });
  };

  const decide = () => {
    const { settings } = state;
    // The DECIDE button on the Nuzlocke screen rolls a nuzlocke; the hero's
    // rolls freeplay.
    const isNuzlocke = screen === 'nuzlocke';
    const pool = filterBossPool(bosses, settings);
    if (pool.length === 0) return;
    gambaFired.current = false;
    // Nuzlocke: the boss comes from the pool of unfought bosses (or a repeat,
    // at the configured %), and is recorded as fought when the run commits.
    // An exhausted pool auto-resets — `rollNuzlockeBoss` starts a fresh cycle.
    const bossRng = mulberry32(randomSeed());
    let boss: Boss;
    let statesNext: BossStates;
    if (isNuzlocke) {
      const r = rollNuzlockeBoss(pool, nuzlocke.states, 0, bossRng);
      boss = r.boss;
      statesNext = r.states;
    } else {
      boss = pick(bossRng, pool);
      statesNext = nuzlocke.states;
    }
    // Gauntlet runs take no gear in at all: no gear roll, and a guaranteed
    // challenge drawn from that boss's own pool.
    const isGauntlet = boss.tags.includes('gauntlet');
    const forceChallenge = settings.debugMode ? settings.forceChallenge : 'off';
    // Raids are a team's whole run, not a single timed fight: they never draw
    // the countdown challenge.
    const challenge = isGauntlet
      ? rollGauntletChallenge(mulberry32(randomSeed()), boss.name)
      : rollChallenge(
          mulberry32(randomSeed()),
          difficultyOf(boss.tags),
          forceChallenge,
          !boss.tags.includes('raid'),
        );
    const isWildy = boss.tags.includes('wildy');
    const parsed = budgetFor(isWildy);
    if (!parsed.ok) return;
    // A wildy boss invisibly disables untradeables and uses the wildy budget.
    const allowUntradeables = isWildy ? false : settings.allowUntradeables;
    // Debug: an ignored budget and a tier-locked pool make any combination
    // reachable without fishing for it.
    const debugIgnoreBudget = settings.debugMode && settings.ignoreBudget;
    const rollSettings = {
      budget: debugIgnoreBudget ? null : parsed.gp,
      allowUntradeables,
      // rollForStyle calls roll() once per lane, so a raid satisfies the floors
      // per skeleton rather than pooling them across the team.
      tierFloors: settings.tierFloors,
      // Harder fights roll better gear.
      tierBias: TIER_BIAS[difficultyOf(boss.tags)],
    };
    const rollPool =
      settings.debugMode && settings.forceTier !== 'off'
        ? items.filter((i) => i.tier === settings.forceTier)
        : items;
    // A fight that refuses melee weapons gets its pool filtered before the roll.
    const bossPool = filterWeaponsFor(rollPool, bossWeaponRule(boss));
    const rng = mulberry32(randomSeed());
    // Some fights only make sense with one style — the Leviathan is ranged,
    // the Whisperer magic — so their weapon roll is forced the same way a
    // raid lane's is.
    const loadout = isGauntlet
      ? emptyLoadout()
      : boss.style
        ? rollForStyle(bossPool, boss.style, rollSettings, rng)
        : roll(bossPool, rollSettings, rng);

    // A boss with a hard-mode variant is upgraded on a coin flip; the ceremony
    // reveals the normal fight first, then stamps HARD MODE after a beat.
    const debug = settings.debugMode;
    // Cosmetic coin flip, so plain Math.random rather than the seeded roller
    // the actual outcomes use.
    const challengeEmote =
      challenge != null && (debug && settings.forceHardModeEmote ? true : Math.random() < 0.5);
    const hardMode =
      boss.tags.includes('hard mode') &&
      !settings.normalOnlyBosses.includes(boss.name) &&
      (debug && settings.forceHardMode ? true : mulberry32(randomSeed())() < 0.5);

    // Raids send a team: one style-forced setup each for melee, ranged, magic.
    const isRaid = boss.tags.includes('raid');
    // Each lane rolls independently, then the team's gear is dealt back out so
    // the pieces land on the setup they suit — before anything is revealed.
    const squad =
      isRaid && !isGauntlet
        ? sortSquadByStyle(
            (['melee', 'ranged', 'magic'] as const).map((style) => ({
              style,
              loadout: rollForStyle(bossPool, style, rollSettings, mulberry32(randomSeed())),
            })),
          )
        : null;

    // Preload the winners so the reveal isn't gated on image load latency.
    const preload = (l: Loadout) => {
      for (const s of SLOTS) {
        const it = l[s];
        if (it) new Image().src = asset(`img/items/${it.icon}`);
      }
    };
    preload(loadout);
    squad?.forEach((s) => preload(s.loadout));

    const commit = () => {
      // The boss counts as fought the moment the run commits, not when it was
      // rolled, so an aborted ceremony never consumes it.
      // A nuzlocke's first commit assigns its id, which groups the history.
      let runNuzlockeId: string | null = null;
      if (isNuzlocke) {
        runNuzlockeId = nuzlocke.id ?? String(nuzlockeSeq + 1);
        if (nuzlocke.id == null) {
          setNuzlockeSeq((s) => s + 1);
          setNuzlockeNames((m) => ({ ...m, [runNuzlockeId!]: nuzlockeLabel(runNuzlockeId!) }));
        }
      }
      setNuzlocke((n) => ({ ...n, states: statesNext, id: runNuzlockeId ?? n.id }));
      // Recorded from what was actually rolled, denormalised, so a later data
      // refresh cannot rewrite what happened.
      const gearOf = (l: Loadout): HistoryGear[] =>
        SLOTS.flatMap((s) => {
          const i = l[s];
          return i ? [{ slot: s, name: i.name, icon: i.icon }] : [];
        });
      const runId = `${Date.now()}-${++runSeq.current}`;
      setHistory((h) =>
        appendRun(h, {
          id: runId,
          at: Date.now(),
          boss: boss.name,
          bossImage: boss.image,
          hardModeLabel: hardMode ? hardModeLabel(boss) : null,
          challenge: challenge?.text ?? null,
          nuzlockeId: runNuzlockeId,
          // A raid's roll is all three setups, so the log carries all three.
          value: squad
            ? squad.reduce((sum, lane) => sum + loadoutValue(lane.loadout), 0)
            : loadoutValue(loadout),
          gear: squad ? squad.flatMap((lane) => gearOf(lane.loadout)) : gearOf(loadout),
          outcome: null,
        }),
      );
      setCurrentRunId(runId);

      dispatch({ type: 'SET_LOADOUT', loadout });
      dispatch({ type: 'SET_BOSS', boss, hardMode });
      dispatch({ type: 'SET_CHALLENGE', challenge });
      dispatch({ type: 'SET_SQUAD', squad });
      setPhase('result');
      if (!settings.skipAnimations) {
        if (challenge) pushStinger('challenge');
        // The AHHHH gnome only applies to a hard-mode fight that drew a
        // challenge, and only on the winning side of its coin flip.
        if (challenge && hardMode && challengeEmote) pushStinger('hardmode');
      }
    };

    if (settings.skipAnimations) {
      commit();
      return;
    }
    unlockAudio();
    setPhase('ceremony');
    startCeremony(
      loadout,
      boss,
      commit,
      undefined,
      pool,
      hardMode,
      isGauntlet,
      squad
        ? squad.map((s) => ({
            label: STYLE_LABEL[s.style],
            loadout: s.loadout,
          }))
        : null,
    );
  };

  const normalOk = parseBudget(state.settings.budgetText).ok;
  const wildyOk = parseBudget(state.settings.wildyBudgetText).ok;
  const poolOk = filterBossPool(bosses, state.settings).length > 0;
  const decideReady = normalOk && (state.settings.excludeWildy || wildyOk) && poolOk;
  // The new-build prompt is in-flow under the CTA on the plain hero, but the
  // Nuzlocke screen is too tall to leave it in the column, so there it is
  // pinned outside FitScreen instead (see the render below).
  const updatePrompt =
    updateReady || (state.settings.debugMode && state.settings.forceUpdatePrompt);

  if (phase === 'pre-roll') {
    return (
      <>
        <EmoteScatter />
        <FitScreen>
          <div className="app">
            <div className="hero">
              <TitleBanner />
              {/* The Nuzlocke screen is entered from the hero's "Nuzlocke mode"
                  button; it shows a fresh board until the first roll commits. */}
              {screen === 'nuzlocke' ? (
                <NuzlockeScreen
                  bosses={bosses}
                  settings={state.settings}
                  nuzlocke={nuzlocke}
                  nuzlockeName={
                    nuzlocke.id ? (nuzlockeNames[nuzlocke.id] ?? nuzlockeLabel(nuzlocke.id)) : null
                  }
                  decideReady={decideReady}
                  onCycleBoss={cycleBoss}
                  onReset={abandonNuzlocke}
                  onTogglePause={togglePauseNuzlocke}
                  onExit={() => setScreen('main')}
                  onDecide={decide}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onOpenHistory={() => setHistoryOpen(true)}
                />
              ) : (
                <PreRollScreen
                  decideReady={decideReady}
                  updateReady={updatePrompt}
                  onDecide={decide}
                  onOpenNuzlocke={() => setScreen('nuzlocke')}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onOpenHistory={() => setHistoryOpen(true)}
                />
              )}
            </div>
          </div>
        </FitScreen>
        {/* Fixed overlays live outside FitScreen: inside a scaled element they
            would anchor to it rather than to the viewport. */}
        {screen === 'nuzlocke' && updatePrompt && (
          <div className="updatePin" data-solid="">
            <UpdatePrompt />
          </div>
        )}
        {/* Fixed overlays live outside FitScreen: inside a scaled element they
            would anchor to it rather than to the viewport. */}
        {historyOpen && (
          <HistoryPanel
            history={history}
            nuzlockeNames={nuzlockeNames}
            onMark={markRun}
            onDelete={deleteRun}
            onRenameNuzlocke={renameNuzlocke}
            onClose={() => setHistoryOpen(false)}
          />
        )}
        {settingsOpen && (
          <SettingsPanel
            settings={state.settings}
            bosses={bosses}
            nuzlockeLocked={nuzlockeLocked}
            onChange={(patch) => dispatch({ type: 'SET_SETTINGS', patch })}
            onPauseNuzlocke={togglePauseNuzlocke}
            onAbandonNuzlocke={abandonNuzlocke}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </>
    );
  }

  const inCeremony = phase === 'ceremony';
  /** Gauntlet fights take no gear in, so the skeleton stays powered down. */
  const isGauntletRun = state.boss?.tags.includes('gauntlet') ?? false;

  // Screen shake on elite/boss landings (T6/T8).
  const triggerShake = () => {
    if (shaking) return;
    setShaking(true);
    window.setTimeout(() => setShaking(false), 230);
  };
  const triggerLand: (impact: LandingImpact) => void = (impact) => {
    if (impact === 'elite' || impact === 'boss') triggerShake();
    const debug = state.settings.debugMode;

    // GAMBA rides any reveal at all, but only once per DECIDE — a jackpot that
    // can fire twice in a run stops feeling like one.
    if (!gambaFired.current) {
      if ((debug && state.settings.forceGamba) || Math.random() < 0.02) {
        gambaFired.current = true;
        pushStinger('gamba');
      }
    }

    // The flashbang now belongs to elite items rather than the boss: it is the
    // loudest thing on screen, so it marks the loudest thing in the loadout.
    if (impact === 'elite') {
      if ((debug && state.settings.forceFlashbang) || Math.random() < 0.5) {
        pushStinger('flashbang');
      }
    }
  };

  // Ceremony: a bare screen that assembles the gear skeleton tile-by-tile
  // (helmet first), each item rolling at centre before flying into its slot,
  // then the boss stage + boss roll as the finale. No panel frames yet.
  // One reroll overlay for both layouts; the lane decides which state it lands in.
  const rerollOverlay = rerolling ? (
    <RevealCard
      key={rerolling.reveal.key}
      data={rerolling.reveal}
      muted={state.settings.muteSounds}
      speed={state.settings.ceremonySpeed}
      onLand={triggerLand}
      onDone={() => {
        if (rerolling.lane != null) {
          dispatch({
            type: 'REROLL_SQUAD_SLOT',
            lane: rerolling.lane,
            loadout: rerolling.loadout,
          });
        } else {
          dispatch({
            type: 'REROLL_SLOT',
            slot: rerolling.slot,
            loadout: rerolling.loadout,
          });
        }
        setRerolling(null);
      }}
    />
  ) : null;

  if (inCeremony) {
    const displayLoadout: Loadout = (() => {
      const d = emptyLoadout();
      for (const s of SLOTS) d[s] = view?.settled?.[s] ?? null;
      return d;
    })();
    const visibleSlots: Slot[] = [
      ...(Object.keys(view?.settled ?? {}) as Slot[]),
      ...(view?.pending ?? []),
    ];
    return (
      <>
        <FitScreen>
          <div className={shaking ? 'app shake' : 'app'}>
            <TitleBanner className="reveal" />
            {/* Once the gear is assembled the ceremony BECOMES the final
                layout, so the boss card has a Challenger panel to fly into and
                the handover to the committed view is invisible. The squad
                ceremony keeps its own stage — its result view is a different
                shape. */}
            {view?.bossStage && !view?.squad ? (
              <ResultStage
                loadout={displayLoadout}
                boss={view?.boss ?? null}
                revealing={view?.boss == null}
                showChallenge={false}
                deactivated={view?.gearless}
                style={{ width: '100%' }}
              />
            ) : (
              <main className="ceremony">
                {view?.squad ? (
                  // Raids: the three style-forced skeletons assemble side by side.
                  <div className="squadStage" data-gear-anchor="">
                    {view.squad.map((lane) => {
                      const laneLoadout = emptyLoadout();
                      for (const s of SLOTS) laneLoadout[s] = lane.settled[s] ?? null;
                      const laneVisible = [
                        ...(Object.keys(lane.settled) as Slot[]),
                        ...(view.pending ?? []),
                      ];
                      return (
                        <div key={lane.label} className="squadStageLane">
                          <span className="squadStageLabel">{lane.label}</span>
                          <EquipmentPanel
                            loadout={laneLoadout}
                            pendingSlots={view.pending}
                            visibleSlots={laneVisible}
                            onSlotContextMenu={() => {}}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div data-gear-anchor="">
                    <EquipmentPanel
                      loadout={displayLoadout}
                      pendingSlots={view?.pending}
                      visibleSlots={view?.gearless ? undefined : visibleSlots}
                      onSlotContextMenu={() => {}}
                      deactivated={view?.gearless}
                    />
                  </div>
                )}
                {view?.bossStage && (
                  <BossPanel boss={view?.boss ?? null} revealing={view?.boss == null} />
                )}
              </main>
            )}
          </div>
        </FitScreen>
        {/* The panel carries the value from here on, so the floating counter
            would just be a second copy of it. */}
        {!(view?.bossStage && !view?.squad) && (
          <ValueCounter
            value={
              view?.squad
                ? view.squad.reduce((sum, lane) => {
                    const l = emptyLoadout();
                    for (const s of SLOTS) l[s] = lane.settled[s] ?? null;
                    return sum + loadoutValue(l);
                  }, 0)
                : loadoutValue(displayLoadout)
            }
            muted={state.settings.muteSounds}
          />
        )}
        {reveal && (
          <RevealCard
            key={reveal.key}
            data={reveal}
            muted={state.settings.muteSounds}
            speed={state.settings.ceremonySpeed}
            onDone={onRevealDone}
            onLand={triggerLand}
          />
        )}
      </>
    );
  }

  // Raids: the team gets one style-forced setup each, side by side.
  if (state.squad) {
    return (
      <>
        <EmoteScatter />
        <FitScreen>
          <div className="app resultIn">
            <TitleBanner />
            <RsPanel title="Your Challenger" icon={asset('img/ui/skull.png')} className="raidBoss">
              <div className="fate">
                <BossPanel
                  boss={state.boss}
                  hardMode={state.hardMode}
                  objective={
                    state.boss ? bossObjective(state.boss.name, loadoutValue(state.loadout)) : null
                  }
                />
                <ChallengePanel challenge={state.challenge} />
              </div>
            </RsPanel>
            <div className="squad">
              {state.squad.map(({ style, loadout }, lane) => (
                <RsPanel key={style} title={STYLE_LABEL[style]} className="squadPanel">
                  <div className="gearStack">
                    {/* data-lane scopes the reroll card's flight target to this
                        panel; the three lanes share every data-slot name. */}
                    <div data-lane={lane}>
                      <EquipmentPanel
                        loadout={loadout}
                        onSlotContextMenu={(slot, e) => openSquadSlotMenu(lane, slot, e)}
                      />
                    </div>
                    <div className="value">
                      <GpValue gp={loadoutValue(loadout)} />
                    </div>
                  </div>
                </RsPanel>
              ))}
            </div>
            <div className="actions" data-solid="">
              {currentRunId && (
                <>
                  <RsButton
                    variant="success"
                    onClick={() => settleRun(currentRunId, 'cleared')}
                  >
                    {history.find((r) => r.id === currentRunId)?.outcome === 'cleared'
                      ? '✓ CLEARED'
                      : 'CLEARED'}
                  </RsButton>
                  <RsButton
                    variant="danger"
                    onClick={() => settleRun(currentRunId, 'failed')}
                  >
                    {history.find((r) => r.id === currentRunId)?.outcome === 'failed'
                      ? '✗ FAILED'
                      : 'FAILED'}
                  </RsButton>
                </>
              )}
            </div>
          </div>
        </FitScreen>
        {menu && (
          <RsContextMenu
            x={menu.x}
            y={menu.y}
            entries={menu.entries}
            onClose={() => setMenu(null)}
          />
        )}
        {rerollOverlay}
      </>
    );
  }

  return (
    <>
      <EmoteScatter />
      <FitScreen>
        <div className="app resultIn">
          <TitleBanner />
          <ResultStage
            loadout={state.loadout}
            boss={state.boss}
            hardMode={state.hardMode}
            challenge={state.challenge}
            deactivated={isGauntletRun}
            onSlotContextMenu={(slot, e) => openSlotMenu(slot, e)}
          />
          <div className="actions" data-solid="">
            {currentRunId && (
              <>
                <RsButton
                  variant="success"
                  onClick={() => settleRun(currentRunId, 'cleared')}
                >
                  {history.find((r) => r.id === currentRunId)?.outcome === 'cleared'
                    ? '✓ CLEARED'
                    : 'CLEARED'}
                </RsButton>
                <RsButton
                  variant="danger"
                  onClick={() => settleRun(currentRunId, 'failed')}
                >
                  {history.find((r) => r.id === currentRunId)?.outcome === 'failed'
                    ? '✗ FAILED'
                    : 'FAILED'}
                </RsButton>
              </>
            )}
          </div>
        </div>
      </FitScreen>
      {menu && (
        <RsContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />
      )}
      {rerollOverlay}
    </>
  );
};

const App = () => (
  <DataProvider>
    <StingerProvider>
      <Main />
    </StingerProvider>
    {/* Outside every screen and outside FitScreen, so it is pinned to the
        window on all pages and never scales with the layout. */}
    <Watermark />
  </DataProvider>
);

export default App;
