import { asset } from '../asset';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Item } from '../engine/types';
import type { Style } from '../engine/roll';
import { RsButton } from '../theme/RsButton';
import { RsPanel } from '../theme/RsPanel';

export interface Boss {
  name: string;
  image: string;
  tags: string[];
  /** Fights that only make sense with one combat style, e.g. the Leviathan's
   *  ranged-only phases. Forces the weapon roll when set. */
  style?: Style;
  /** Fights that never roll a melee weapon (Kraken). When `meleeExceptions` is
   *  present, only those melee weapons stay (Zulrah and Kree'arra keep the
   *  Noxious halberd). */
  noMeleeWeapons?: boolean;
  /** Melee weapons still eligible despite `noMeleeWeapons`. */
  meleeExceptions?: string[];
}

export interface GameData {
  items: Item[];
  bosses: Boss[];
}

const DataContext = createContext<GameData | null>(null);

export const useGameData = (): GameData => {
  const data = useContext(DataContext);
  if (!data) throw new Error('useGameData outside DataProvider');
  return data;
};

const loadAll = async (): Promise<GameData> => {
  const [itemsRaw, prices, bosses] = await Promise.all(
    ['equipment.json', 'prices.json', 'bosses.json'].map(async (f) => {
      const res = await fetch(asset(`data/${f}`));
      if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
      return res.json();
    }),
  );

  // Join the price snapshot onto items; index by slot once.
  const items: Item[] = (itemsRaw as Item[]).map((i) => ({
    ...i,
    price: (prices as Record<string, number>)[i.id],
  }));
  return { items, bosses: bosses as Boss[] };
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadAll().then(
      (d) => alive && setData(d),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (error) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <RsPanel title="Something broke">
          <p>Failed to load game data: {error}</p>
          <RsButton onClick={() => setAttempt((a) => a + 1)}>Retry</RsButton>
        </RsPanel>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <RsPanel>
          <p style={{ color: 'var(--gold)' }}>Loading the armoury…</p>
        </RsPanel>
      </div>
    );
  }
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
};
