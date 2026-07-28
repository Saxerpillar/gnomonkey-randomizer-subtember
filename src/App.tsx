import { useEffect, useReducer } from 'react';
import './App.css';
import { BossPanel, ChallengePanel } from './components/BossPanel';
import { DataProvider, useGameData, type Boss } from './components/DataProvider';
import { EquipmentPanel } from './components/EquipmentPanel';
import { ItemPicker } from './components/ItemPicker';
import { RollControls } from './components/RollControls';
import { SpellBadge } from './components/SpellBadge';
import { parseBudget } from './engine/parse';
import { mulberry32, pick, randomSeed } from './engine/rng';
import { loadoutValue, roll } from './engine/roll';
import { rollSpell, type Spell } from './engine/spell';
import { emptyLoadout, type Item, type Loadout, type Slot } from './engine/types';
import { RsPanel } from './theme/RsPanel';

interface State {
  loadout: Loadout;
  locks: Partial<Record<Slot, Item>>;
  budgetText: string;
  allowUntradeables: boolean;
  boss: Boss | null;
  selectedSlot: Slot | null;
  spell: Spell | null;
}

type Action =
  | { type: 'SET_LOADOUT'; loadout: Loadout; spell: Spell | null }
  | { type: 'SET_BOSS'; boss: Boss }
  | { type: 'TOGGLE_LOCK'; slot: Slot }
  | { type: 'PICK_ITEM'; item: Item; spell: Spell | null }
  | { type: 'SET_BUDGET_TEXT'; text: string }
  | { type: 'TOGGLE_UNTRADEABLES' }
  | { type: 'SELECT_SLOT'; slot: Slot | null };

const STORAGE_KEY = 'gnome-subtember-v1';

const initialState = (): State => {
  const base: State = {
    loadout: emptyLoadout(),
    locks: {},
    budgetText: '',
    allowUntradeables: false,
    boss: null,
    selectedSlot: null,
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
    case 'SELECT_SLOT':
      return { ...state, selectedSlot: action.slot };
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
    case 'PICK_ITEM': {
      // Hand-picking sets AND locks the item, resolving 2h/shield conflicts
      // immediately so the roller never sees a contradictory lock set.
      const { item } = action;
      const loadout = { ...state.loadout, [item.slot]: item };
      const locks = { ...state.locks, [item.slot]: item };
      if (item.slot === 'weapon' && item.twoHanded) {
        loadout.shield = null;
        delete locks.shield;
      }
      if (item.slot === 'shield' && loadout.weapon?.twoHanded) {
        loadout.weapon = null;
        delete locks.weapon;
      }
      return { ...state, loadout, locks, selectedSlot: null, spell: action.spell };
    }
  }
};

const Main = () => {
  const { items, bosses, spells } = useGameData();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    const { locks, budgetText, allowUntradeables } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ locks, budgetText, allowUntradeables }));
  }, [state]);

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

  const pickItem = (item: Item) => {
    // The spell follows the weapon: a picked staff rolls its spell; a picked
    // shield that will clear a locked 2h clears the spell with it.
    const spell =
      item.slot === 'weapon'
        ? rollSpell(item, spells, mulberry32(randomSeed()))
        : item.slot === 'shield' && state.loadout.weapon?.twoHanded
          ? null
          : state.spell;
    dispatch({ type: 'PICK_ITEM', item, spell });
  };

  const rollBoss = () => dispatch({ type: 'SET_BOSS', boss: pick(mulberry32(randomSeed()), bosses) });

  return (
    <div className="app">
      <h1 className="title">Gnome Subtember</h1>
      <main className="columns">
        <RsPanel title="Your gear">
          <div className="gearStack">
            <EquipmentPanel
              loadout={state.loadout}
              locks={state.locks}
              selectedSlot={state.selectedSlot}
              onSelectSlot={(slot) =>
                dispatch({ type: 'SELECT_SLOT', slot: state.selectedSlot === slot ? null : slot })
              }
              onToggleLock={(slot) => dispatch({ type: 'TOGGLE_LOCK', slot })}
            />
            <SpellBadge weapon={state.loadout.weapon} spell={state.spell} />
            <ItemPicker
              slotFilter={state.selectedSlot}
              onPick={pickItem}
              onClearSlotFilter={() => dispatch({ type: 'SELECT_SLOT', slot: null })}
            />
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
        <RsPanel title="Your fate">
          <div className="fate">
            <BossPanel boss={state.boss} onRoll={rollBoss} />
            <ChallengePanel />
          </div>
        </RsPanel>
      </main>
    </div>
  );
};

const App = () => (
  <DataProvider>
    <Main />
  </DataProvider>
);

export default App;
