import { useEffect, useReducer, useRef, useState } from 'react';
import { asset } from './asset';
import './App.css';
import { BossPanel, ChallengePanel } from './components/BossPanel';
import { EmoteScatter } from './components/EmoteScatter';
import { FitScreen } from './components/FitScreen';
import { TitleBanner } from './components/TitleBanner';
import { StingerProvider, useStinger } from './components/StingerHost';
import { usePreloadAssets } from './components/usePreloadAssets';
import { Watermark } from './components/Watermark';
import {
  difficultyOf,
  rollChallenge,
  rollGauntletChallenge,
  type Challenge,
} from './components/challenges';
import { DataProvider, useGameData, type Boss } from './components/DataProvider';
import { EquipmentPanel } from './components/EquipmentPanel';
import { bossObjective } from './components/objectives';
import { PreRollScreen } from './components/PreRollScreen';
import { ResultStage } from './components/ResultStage';
import { RevealCard, type LandingImpact } from './components/RevealCard';
import { SettingsPanel } from './components/SettingsPanel';
import {
  DEFAULT_SETTINGS,
  filterBossPool,
  mergeSettings,
  effectiveBudget,
  type Settings,
} from './components/settings';
import { unlockAudio } from './components/sound';
import { useCeremony, type RevealData } from './components/useCeremony';
import { ValueCounter } from './components/ValueCounter';
import { parseBudget } from './engine/parse';
import { mulberry32, pick, randomSeed } from './engine/rng';
import { loadoutValue, roll, rerollSlot, rollForStyle, type Style } from './engine/roll';
import { rollSpell, type Spell } from './engine/spell';
import { emptyLoadout, SLOTS, type Item, type Loadout, type Slot } from './engine/types';
import { GpValue } from './theme/GpValue';
import { RsButton } from './theme/RsButton';
import { RsContextMenu, type MenuEntry } from './theme/RsContextMenu';
import { RsPanel } from './theme/RsPanel';

interface State {
  loadout: Loadout;
  locks: Partial<Record<Slot, Item>>;
  boss: Boss | null;
  spell: Spell | null;
  challenge: Challenge | null;
  /** The rolled fight is the hard-mode variant. */
  hardMode: boolean;
  /** Raids only: one style-forced setup per team member. */
  squad: { style: Style; loadout: Loadout }[] | null;
  settings: Settings;
}

type Phase = 'pre-roll' | 'ceremony' | 'result';

type Action =
  | { type: 'SET_LOADOUT'; loadout: Loadout; spell: Spell | null }
  | { type: 'SET_BOSS'; boss: Boss; hardMode: boolean }
  | { type: 'SET_CHALLENGE'; challenge: Challenge | null }
  | { type: 'SET_SQUAD'; squad: { style: Style; loadout: Loadout }[] | null }
  | { type: 'TOGGLE_LOCK'; slot: Slot }
  | { type: 'REMOVE_ITEM'; slot: Slot }
  | { type: 'REROLL_SLOT'; slot: Slot; loadout: Loadout; spell: Spell | null }
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
    locks: {},
    boss: null,
    spell: null,
    challenge: null,
    hardMode: false,
    squad: null,
    settings: { ...DEFAULT_SETTINGS },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const locks = (saved.locks ?? {}) as State['locks'];
    const loadout = { ...base.loadout };
    for (const [slot, item] of Object.entries(locks)) loadout[slot as Slot] = item as Item;
    return {
      ...base,
      loadout,
      locks,
      settings: mergeSettings(saved.settings),
    };
  } catch {
    return base;
  }
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_LOADOUT':
      return { ...state, loadout: action.loadout, spell: action.spell };
    case 'SET_BOSS':
      return { ...state, boss: action.boss, hardMode: action.hardMode };
    case 'SET_CHALLENGE':
      return { ...state, challenge: action.challenge };
    case 'SET_SQUAD':
      return { ...state, squad: action.squad };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'TOGGLE_LOCK': {
      const { slot } = action;
      const locks = { ...state.locks };
      if (locks[slot]) {
        delete locks[slot];
      } else if (state.loadout[slot]) {
        locks[slot] = state.loadout[slot];
      }
      return { ...state, locks };
    }
    case 'REMOVE_ITEM': {
      const { slot } = action;
      const loadout = { ...state.loadout, [slot]: null };
      const locks = { ...state.locks };
      delete locks[slot];
      // Removing the weapon removes the spell that went with it.
      return {
        ...state,
        loadout,
        locks,
        spell: slot === 'weapon' ? null : state.spell,
      };
    }
    case 'REROLL_SLOT': {
      const { slot, loadout, spell } = action;
      const locks = { ...state.locks };
      // A locked slot stays locked — onto whatever it just rolled.
      if (locks[slot]) {
        const item = loadout[slot];
        if (item) locks[slot] = item;
        else delete locks[slot];
      }
      // A new 2h can clear the shield/ammo under an existing lock.
      if (!loadout.shield) delete locks.shield;
      if (!loadout.ammo) delete locks.ammo;
      return { ...state, loadout, locks, spell };
    }
  }
};

const Main = () => {
  const { items, bosses, spells } = useGameData();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [phase, setPhase] = useState<Phase>('pre-roll');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  // Warm every reel asset while the pre-roll screen is idle, so nothing pops
  // in mid-reveal.
  usePreloadAssets(items, bosses);

  /** GAMBA is capped at one per DECIDE; reset when a new run is rolled. */
  const gambaFired = useRef(false);
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
    spell: Spell | null;
    slot: Slot;
  } | null>(null);
  const { view, reveal, start: startCeremony, onRevealDone } = useCeremony(items);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ locks: state.locks, settings: state.settings }),
    );
  }, [state.locks, state.settings]);

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

  /** Reroll a single slot, leaving the rest of the loadout alone. */
  const rerollOneSlot = (slot: Slot) => {
    const { settings } = state;
    // Same budget/untradeable rules the full roll used, including the wildy override.
    const isWildy = state.boss?.tags.includes('wildy') ?? false;
    const parsed = budgetFor(isWildy);
    if (!parsed.ok) return;
    const allowUntradeables = isWildy ? false : settings.allowUntradeables;
    const rng = mulberry32(randomSeed());
    const loadout = rerollSlot(
      items,
      state.loadout,
      slot,
      { budget: parsed.gp, allowUntradeables, locks: state.locks },
      rng,
    );
    const spell = slot === 'weapon' ? rollSpell(loadout.weapon, spells, rng) : state.spell;
    const rolled = loadout[slot];
    if (!rolled) {
      // Nothing affordable/valid — nothing to show, just apply the (unchanged) result.
      dispatch({ type: 'REROLL_SLOT', slot, loadout, spell });
      return;
    }
    new Image().src = asset(`img/items/${rolled.icon}`);

    if (settings.skipAnimations) {
      dispatch({ type: 'REROLL_SLOT', slot, loadout, spell });
      return;
    }
    unlockAudio();
    setRerolling({
      slot,
      loadout,
      spell,
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

  const openSlotMenu = (slot: Slot, e: React.MouseEvent) => {
    e.preventDefault();
    const entries: MenuEntry[] = [];
    // The shield slot is genuinely unusable under a two-handed weapon.
    const shieldBlocked = slot === 'shield' && (state.loadout.weapon?.twoHanded ?? false);
    if (!shieldBlocked) {
      entries.push({
        label: `Reroll ${slot}`,
        onSelect: () => rerollOneSlot(slot),
      });
    }
    if (state.loadout[slot]) {
      entries.push({
        label: 'Remove item from slot',
        onSelect: () => dispatch({ type: 'REMOVE_ITEM', slot }),
      });
    }
    setMenu({ x: e.clientX, y: e.clientY, entries });
  };

  const decide = () => {
    const { settings } = state;
    const pool = filterBossPool(bosses, settings);
    if (pool.length === 0) return;
    gambaFired.current = false;
    const boss = pick(mulberry32(randomSeed()), pool);
    // Gauntlet runs take no gear in at all: no gear roll, and a guaranteed
    // challenge drawn from that boss's own pool.
    const isGauntlet = boss.tags.includes('gauntlet');
    const forceChallenge = settings.debugMode ? settings.forceChallenge : 'off';
    const challenge = isGauntlet
      ? rollGauntletChallenge(mulberry32(randomSeed()), boss.name)
      : rollChallenge(mulberry32(randomSeed()), difficultyOf(boss.tags), forceChallenge);
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
      locks: state.locks,
    };
    const rollPool =
      settings.debugMode && settings.forceTier !== 'off'
        ? items.filter((i) => i.tier === settings.forceTier)
        : items;
    const rng = mulberry32(randomSeed());
    const loadout = isGauntlet ? emptyLoadout() : roll(rollPool, rollSettings, rng);
    const spell = isGauntlet ? null : rollSpell(loadout.weapon, spells, rng);

    // A boss with a hard-mode variant is upgraded on a coin flip; the ceremony
    // reveals the normal fight first, then stamps HARD MODE after a beat.
    const debug = settings.debugMode;
    // Cosmetic coin flip, so plain Math.random rather than the seeded roller
    // the actual outcomes use.
    const challengeEmote =
      challenge != null && (debug && settings.forceHardModeEmote ? true : Math.random() < 0.5);
    const hardMode =
      boss.tags.includes('hard mode') &&
      (debug && settings.forceHardMode ? true : mulberry32(randomSeed())() < 0.5);

    // Raids send a team: one style-forced setup each for melee, ranged, magic.
    const isRaid = boss.tags.includes('raid');
    const squad =
      isRaid && !isGauntlet
        ? (['melee', 'ranged', 'magic'] as const).map((style) => ({
            style,
            loadout: rollForStyle(rollPool, style, rollSettings, mulberry32(randomSeed())),
          }))
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
      dispatch({ type: 'SET_LOADOUT', loadout, spell });
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
      isGauntlet ? {} : state.locks,
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

  if (phase === 'pre-roll') {
    return (
      <>
        <EmoteScatter />
        <FitScreen>
          <div className="app">
            <div className="hero">
              <TitleBanner />
              <PreRollScreen
                decideReady={decideReady}
                onDecide={decide}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </div>
          </div>
        </FitScreen>
        {/* Fixed overlays live outside FitScreen: inside a scaled element they
            would anchor to it rather than to the viewport. */}
        {settingsOpen && (
          <SettingsPanel
            settings={state.settings}
            onChange={(patch) => dispatch({ type: 'SET_SETTINGS', patch })}
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
                locks={state.locks}
                spell={null}
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
                            locks={{}}
                            pendingSlots={view.pending}
                            visibleSlots={laneVisible}
                            onToggleLock={() => {}}
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
                      locks={state.locks}
                      pendingSlots={view?.pending}
                      visibleSlots={view?.gearless ? undefined : visibleSlots}
                      onToggleLock={() => {}}
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
              {state.squad.map(({ style, loadout }) => (
                <RsPanel key={style} title={STYLE_LABEL[style]} className="squadPanel">
                  <div className="gearStack">
                    <EquipmentPanel
                      loadout={loadout}
                      locks={{}}
                      onToggleLock={() => {}}
                      onSlotContextMenu={() => {}}
                    />
                    <div className="value">
                      <GpValue gp={loadoutValue(loadout)} />
                    </div>
                  </div>
                </RsPanel>
              ))}
            </div>
            <div className="actions" data-solid="">
              <RsButton variant="primary" onClick={() => setPhase('pre-roll')}>
                NEW CHALLENGE
              </RsButton>
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
            locks={state.locks}
            spell={state.spell}
            boss={state.boss}
            hardMode={state.hardMode}
            challenge={state.challenge}
            deactivated={isGauntletRun}
            onToggleLock={(slot) => dispatch({ type: 'TOGGLE_LOCK', slot })}
            onSlotContextMenu={(slot, e) => openSlotMenu(slot, e)}
          />
          <div className="actions" data-solid="">
            <RsButton variant="primary" onClick={() => setPhase('pre-roll')}>
              NEW CHALLENGE
            </RsButton>
          </div>
        </div>
      </FitScreen>
      {menu && (
        <RsContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />
      )}
      {rerolling && (
        <RevealCard
          key={rerolling.reveal.key}
          data={rerolling.reveal}
          muted={state.settings.muteSounds}
          speed={state.settings.ceremonySpeed}
          onLand={triggerLand}
          onDone={() => {
            dispatch({
              type: 'REROLL_SLOT',
              slot: rerolling.slot,
              loadout: rerolling.loadout,
              spell: rerolling.spell,
            });
            setRerolling(null);
          }}
        />
      )}
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
