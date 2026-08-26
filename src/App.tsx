import { useEffect, useReducer, useState } from 'react';
import { asset } from './asset';
import './App.css';
import { BonusesPanel } from './components/BonusesPanel';
import { BossPanel, ChallengePanel } from './components/BossPanel';
import { CHALLENGES } from './components/challenges';
import { DataProvider, useGameData, type Boss } from './components/DataProvider';
import { EquipmentPanel } from './components/EquipmentPanel';
import { summaryLine } from './components/copy';
import { PreRollScreen } from './components/PreRollScreen';
import { RevealCard, type LandingImpact } from './components/RevealCard';
import { SettingsPanel } from './components/SettingsPanel';
import { SpellBadge } from './components/SpellBadge';
import { DEFAULT_SETTINGS, filterBossPool, type Settings } from './components/settings';
import { unlockAudio } from './components/sound';
import { useCeremony } from './components/useCeremony';
import { ValueCounter } from './components/ValueCounter';
import { parseBudget } from './engine/parse';
import { mulberry32, pick, randomSeed } from './engine/rng';
import { loadoutValue, roll } from './engine/roll';
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
  challenge: string | null;
  settings: Settings;
}

type Phase = 'pre-roll' | 'ceremony' | 'result';

type Action =
  | { type: 'SET_LOADOUT'; loadout: Loadout; spell: Spell | null }
  | { type: 'SET_BOSS'; boss: Boss }
  | { type: 'SET_CHALLENGE'; challenge: string }
  | { type: 'TOGGLE_LOCK'; slot: Slot }
  | { type: 'REMOVE_ITEM'; slot: Slot }
  | { type: 'SET_SETTINGS'; patch: Partial<Settings> };

const STORAGE_KEY = 'gnome-subtember-v2';

const initialState = (): State => {
  const base: State = {
    loadout: emptyLoadout(),
    locks: {},
    boss: null,
    spell: null,
    challenge: null,
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
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
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
      return { ...state, boss: action.boss };
    case 'SET_CHALLENGE':
      return { ...state, challenge: action.challenge };
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
      return { ...state, loadout, locks, spell: slot === 'weapon' ? null : state.spell };
    }
  }
};

const Main = () => {
  const { items, bosses, spells } = useGameData();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [phase, setPhase] = useState<Phase>('pre-roll');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);
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

  const openSlotMenu = (slot: Slot, e: React.MouseEvent) => {
    e.preventDefault();
    const entries: MenuEntry[] = state.loadout[slot]
      ? [{ label: 'Remove item from slot', onSelect: () => dispatch({ type: 'REMOVE_ITEM', slot }) }]
      : [];
    setMenu({ x: e.clientX, y: e.clientY, entries });
  };

  const decide = () => {
    const { settings } = state;
    const pool = filterBossPool(bosses, settings);
    if (pool.length === 0) return;
    const boss = pick(mulberry32(randomSeed()), pool);
    const challenge = pick(mulberry32(randomSeed()), CHALLENGES);
    const isWildy = boss.tags.includes('wildy');
    const parsed = parseBudget(isWildy ? settings.wildyBudgetText : settings.budgetText);
    if (!parsed.ok) return;
    // A wildy boss invisibly disables untradeables and uses the wildy budget.
    const allowUntradeables = isWildy ? false : settings.allowUntradeables;
    const rng = mulberry32(randomSeed());
    const loadout = roll(
      items,
      { budget: parsed.gp, allowUntradeables, locks: state.locks },
      rng,
    );
    const spell = rollSpell(loadout.weapon, spells, rng);

    // Preload the winners so the reveal isn't gated on image load latency.
    for (const s of SLOTS) {
      const it = loadout[s];
      if (it) new Image().src = asset(`img/items/${it.icon}`);
    }

    const commit = () => {
      dispatch({ type: 'SET_LOADOUT', loadout, spell });
      dispatch({ type: 'SET_BOSS', boss });
      dispatch({ type: 'SET_CHALLENGE', challenge });
      setPhase('result');
    };

    if (settings.skipAnimations) {
      commit();
      return;
    }
    unlockAudio();
    setPhase('ceremony');
    startCeremony(loadout, boss, state.locks, commit);
  };

  const normalOk = parseBudget(state.settings.budgetText).ok;
  const wildyOk = parseBudget(state.settings.wildyBudgetText).ok;
  const poolOk = filterBossPool(bosses, state.settings).length > 0;
  const decideReady = normalOk && (state.settings.excludeWildy || wildyOk) && poolOk;

  if (phase === 'pre-roll') {
    return (
      <div className="app">
        <div className="hero">
          <h1 className="title">Gnome Subtember</h1>
          <PreRollScreen
            decideReady={decideReady}
            onDecide={decide}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
        {settingsOpen && (
          <SettingsPanel
            settings={state.settings}
            onChange={(patch) => dispatch({ type: 'SET_SETTINGS', patch })}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    );
  }

  const inCeremony = phase === 'ceremony';

  // Screen shake on elite/boss landings (T6/T8).
  const triggerShake = () => {
    if (shaking) return;
    setShaking(true);
    window.setTimeout(() => setShaking(false), 230);
  };
  const triggerLand: (impact: LandingImpact) => void = (impact) => {
    if (impact === 'elite' || impact === 'boss') triggerShake();
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
      <div className={shaking ? 'app shake' : 'app'}>
        <h1 className="title reveal">Gnome Subtember</h1>
        <main className="ceremony">
          <ValueCounter value={loadoutValue(displayLoadout)} muted={state.settings.muteSounds} />
          <EquipmentPanel
            loadout={displayLoadout}
            locks={state.locks}
            pendingSlots={view?.pending}
            visibleSlots={visibleSlots}
            onToggleLock={() => {}}
            onSlotContextMenu={() => {}}
          />
          {view?.bossStage && <BossPanel boss={view?.boss ?? null} revealing={view?.boss == null} />}
        </main>
        {reveal && (
          <RevealCard
            key={reveal.key}
            data={reveal}
            muted={state.settings.muteSounds}
            onDone={onRevealDone}
            onLand={triggerLand}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app resultIn">
      <h1 className="title">Gnome Subtember</h1>
      <main className="columns">
        <RsPanel title="Your gear" icon={asset("img/ui/multicombat.png")}>
          <div className="gearStack">
            <div className="gearRow">
              <EquipmentPanel
                loadout={state.loadout}
                locks={state.locks}
                onToggleLock={(slot) => dispatch({ type: 'TOGGLE_LOCK', slot })}
                onSlotContextMenu={(slot, e) => openSlotMenu(slot, e)}
              />
              <BonusesPanel loadout={state.loadout} />
            </div>
            <SpellBadge weapon={state.loadout.weapon} spell={state.spell} />
            <div className="value">
              Loadout value: <GpValue gp={loadoutValue(state.loadout)} />
            </div>
            {state.boss && <div className="summary">{summaryLine(state.boss.name)}</div>}
          </div>
        </RsPanel>
        <RsPanel title="Your Challenger" icon={asset("img/ui/skull.png")}>
          <div className="fate">
            <BossPanel boss={state.boss} />
            <ChallengePanel challenge={state.challenge} />
          </div>
        </RsPanel>
      </main>
      <div className="actions">
        <RsButton variant="primary" onClick={() => setPhase('pre-roll')}>
          NEW CHALLENGE
        </RsButton>
      </div>
      {menu && <RsContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />}
    </div>
  );
};

const App = () => (
  <DataProvider>
    <Main />
  </DataProvider>
);

export default App;
