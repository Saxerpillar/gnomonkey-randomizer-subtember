import { useEffect, useReducer, useState } from 'react';
import './App.css';
import { BonusesPanel } from './components/BonusesPanel';
import { BossPanel, ChallengePanel } from './components/BossPanel';
import { DataProvider, useGameData, type Boss } from './components/DataProvider';
import { EquipmentPanel } from './components/EquipmentPanel';
import { RollControls } from './components/RollControls';
import { SpellBadge } from './components/SpellBadge';
import { parseBudget } from './engine/parse';
import { mulberry32, pick, randomSeed } from './engine/rng';
import { loadoutValue, roll } from './engine/roll';
import { rollSpell, type Spell } from './engine/spell';
import { emptyLoadout, type Item, type Loadout, type Slot } from './engine/types';
import { RsContextMenu, type MenuEntry } from './theme/RsContextMenu';
import { RsPanel } from './theme/RsPanel';

interface State {
  loadout: Loadout;
  locks: Partial<Record<Slot, Item>>;
  budgetText: string;
  allowUntradeables: boolean;
  boss: Boss | null;
  spell: Spell | null;
}

type Action =
  | { type: 'SET_LOADOUT'; loadout: Loadout; spell: Spell | null }
  | { type: 'SET_BOSS'; boss: Boss }
  | { type: 'TOGGLE_LOCK'; slot: Slot }
  | { type: 'REMOVE_ITEM'; slot: Slot }
  | { type: 'SET_BUDGET_TEXT'; text: string }
  | { type: 'TOGGLE_UNTRADEABLES' };

const STORAGE_KEY = 'gnome-subtember-v1';

const initialState = (): State => {
  const base: State = {
    loadout: emptyLoadout(),
    locks: {},
    budgetText: '',
    allowUntradeables: false,
    boss: null,
    spell: null,
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
      budgetText: typeof saved.budgetText === 'string' ? saved.budgetText : '',
      allowUntradeables: !!saved.allowUntradeables,
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
    case 'SET_BUDGET_TEXT':
      return { ...state, budgetText: action.text };
    case 'TOGGLE_UNTRADEABLES':
      return { ...state, allowUntradeables: !state.allowUntradeables };
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
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);

  useEffect(() => {
    const { locks, budgetText, allowUntradeables } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ locks, budgetText, allowUntradeables }));
  }, [state]);

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

  const rollGear = () => {
    const parsed = parseBudget(state.budgetText);
    if (!parsed.ok) return;
    const rng = mulberry32(randomSeed());
    const loadout = roll(
      items,
      { budget: parsed.gp, allowUntradeables: state.allowUntradeables, locks: state.locks },
      rng,
    );
    dispatch({ type: 'SET_LOADOUT', loadout, spell: rollSpell(loadout.weapon, spells, rng) });
  };

  const rollBoss = () => dispatch({ type: 'SET_BOSS', boss: pick(mulberry32(randomSeed()), bosses) });

  return (
    <div className="app">
      <h1 className="title">Gnome Subtember</h1>
      <main className="columns">
        <RsPanel title="Your gear" icon="/img/ui/multicombat.png">
          <div className="gearStack">
            <div className="gearRow">
              <EquipmentPanel
                loadout={state.loadout}
                locks={state.locks}
                onToggleLock={(slot) => dispatch({ type: 'TOGGLE_LOCK', slot })}
                onSlotContextMenu={openSlotMenu}
              />
              <BonusesPanel loadout={state.loadout} />
            </div>
            <SpellBadge weapon={state.loadout.weapon} spell={state.spell} />
            <RollControls
              budgetText={state.budgetText}
              allowUntradeables={state.allowUntradeables}
              totalValue={loadoutValue(state.loadout)}
              onBudgetChange={(text) => dispatch({ type: 'SET_BUDGET_TEXT', text })}
              onToggleUntradeables={() => dispatch({ type: 'TOGGLE_UNTRADEABLES' })}
              onRoll={rollGear}
            />
          </div>
        </RsPanel>
        <RsPanel title="Your fate" icon="/img/ui/skull.png">
          <div className="fate">
            <BossPanel boss={state.boss} onRoll={rollBoss} />
            <ChallengePanel />
          </div>
        </RsPanel>
      </main>
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
