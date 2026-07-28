import { SLOTS, type Item, type Loadout, type Slot } from '../engine/types';
import { formatGp } from '../engine/parse';
import styles from './EquipmentPanel.module.css';

const SLOT_LABEL: Record<Slot, string> = {
  head: 'Head',
  cape: 'Cape',
  neck: 'Neck',
  ammo: 'Ammo',
  weapon: 'Weapon',
  body: 'Body',
  shield: 'Shield',
  legs: 'Legs',
  hands: 'Hands',
  feet: 'Feet',
  ring: 'Ring',
};

const EquipSlot = ({
  slot,
  item,
  locked,
  selected,
  onSelect,
  onToggleLock,
}: {
  slot: Slot;
  item: Item | null;
  locked: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleLock: () => void;
}) => {
  const title = item
    ? `${item.name}${item.price != null ? ` (${formatGp(item.price)})` : item.tradeable ? '' : ' (untradeable)'}`
    : `${SLOT_LABEL[slot]} — empty`;
  return (
    <div
      className={`${styles.slot} ${locked ? styles.locked : ''} ${selected ? styles.selected : ''}`}
      style={{ gridArea: slot, backgroundImage: `url(/img/slots/${slot}.png)` }}
      title={title}
      onClick={onSelect}
    >
      {item && <img className={styles.icon} src={`/img/items/${item.icon}`} alt={item.name} />}
      {item && (
        <button
          className={styles.lockBtn}
          title={locked ? 'Unlock slot' : 'Lock this item in'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
        >
          {locked ? '🔒' : '🔓'}
        </button>
      )}
      {locked && <span className={styles.lockBadge}>🔒</span>}
    </div>
  );
};

/** The in-game equipment tab, built from the authentic wiki slot sprites. */
export const EquipmentPanel = ({
  loadout,
  locks,
  selectedSlot,
  onSelectSlot,
  onToggleLock,
}: {
  loadout: Loadout;
  locks: Partial<Record<Slot, Item>>;
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
  onToggleLock: (slot: Slot) => void;
}) => (
  <div className={styles.tab}>
    {SLOTS.map((slot) => (
      <EquipSlot
        key={slot}
        slot={slot}
        item={loadout[slot]}
        locked={locks[slot] !== undefined}
        selected={selectedSlot === slot}
        onSelect={() => onSelectSlot(slot)}
        onToggleLock={() => onToggleLock(slot)}
      />
    ))}
  </div>
);
