import { SLOTS, type Item, type Loadout, type Slot } from '../engine/types';
import { GpValue } from '../theme/GpValue';
import { RsTooltip } from '../theme/RsTooltip';
import tipStyles from '../theme/RsTooltip.module.css';
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

const slotTip = (slot: Slot, item: Item | null, locked: boolean) =>
  item ? (
    <>
      <span className={tipStyles.tipTitle}>{item.name}</span>
      {item.price != null ? (
        <GpValue gp={item.price} />
      ) : (
        !item.tradeable && <span className={tipStyles.tipMuted}>Untradeable</span>
      )}
      <span className={tipStyles.tipMuted}>{locked ? 'Locked — 🔓 unlocks' : '🔓 locks it in'}</span>
    </>
  ) : (
    <>
      <span className={tipStyles.tipTitle}>{SLOT_LABEL[slot]}</span>
      <span className={tipStyles.tipMuted}>Empty — click to search this slot</span>
    </>
  );

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
}) => (
  <RsTooltip
    content={slotTip(slot, item, locked)}
    className={`${styles.slot} ${locked ? styles.locked : ''} ${selected ? styles.selected : ''}`}
    style={{ gridArea: slot, backgroundImage: `url(/img/slots/${slot}.png)` }}
    onClick={onSelect}
  >
    {item && <img className={styles.icon} src={`/img/items/${item.icon}`} alt={item.name} />}
    {item && (
      <button
        className={styles.lockBtn}
        aria-label={locked ? 'Unlock slot' : 'Lock this item in'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
      >
        {locked ? '🔒' : '🔓'}
      </button>
    )}
    {locked && <span className={styles.lockBadge}>🔒</span>}
  </RsTooltip>
);

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
