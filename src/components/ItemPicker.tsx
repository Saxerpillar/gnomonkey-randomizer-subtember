import { useMemo, useState } from 'react';
import { useGameData } from './DataProvider';
import { formatGp } from '../engine/parse';
import type { Item, Slot } from '../engine/types';
import styles from './ItemPicker.module.css';

const MAX_RESULTS = 40;

/** Global equipment search (dps-calc pattern): pick an item anywhere, it
 *  auto-slots and locks. A selected slot narrows the search to that slot. */
export const ItemPicker = ({
  slotFilter,
  onPick,
  onClearSlotFilter,
}: {
  slotFilter: Slot | null;
  onPick: (item: Item) => void;
  onClearSlotFilter: () => void;
}) => {
  const { items, bySlot } = useGameData();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const source = slotFilter ? bySlot[slotFilter] : items;
    return source.filter((i) => i.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  }, [query, slotFilter, items, bySlot]);

  const pick = (item: Item) => {
    onPick(item);
    setQuery('');
  };

  return (
    <div className={styles.picker}>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={query}
          placeholder={slotFilter ? `Search ${slotFilter} items…` : 'Search all equipment…'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) pick(results[0]);
            if (e.key === 'Escape') {
              setQuery('');
              onClearSlotFilter();
            }
          }}
        />
        {slotFilter && (
          <button className={styles.chip} onClick={onClearSlotFilter} title="Search all slots">
            {slotFilter} ✕
          </button>
        )}
      </div>
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((item) => (
            <li key={item.id}>
              <button className={styles.result} onClick={() => pick(item)}>
                <img src={`/img/items/${item.icon}`} alt="" />
                <span className={styles.name}>{item.name}</span>
                <span className={styles.price}>
                  {item.price != null ? formatGp(item.price) : item.tradeable ? '' : 'untradeable'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
