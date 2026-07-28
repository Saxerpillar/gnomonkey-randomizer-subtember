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
      <span className={tipStyles.tipMuted}>
        {locked ? 'Locked — click to unlock' : 'Click to lock it in'}
      </span>
    </>
  ) : (
    <>
      <span className={tipStyles.tipTitle}>{SLOT_LABEL[slot]}</span>
      <span className={tipStyles.tipMuted}>Empty</span>
    </>
  );

const EquipSlot = ({
  slot,
  item,
  locked,
  onToggleLock,
}: {
  slot: Slot;
  item: Item | null;
  locked: boolean;
  onToggleLock: () => void;
}) => (
  <RsTooltip
    content={slotTip(slot, item, locked)}
    className={`${styles.slot} ${locked ? styles.locked : ''} ${item ? styles.lockable : ''}`}
    style={{
      gridArea: slot,
      // occupied: dim the slot sprite so the item reads on top of it
      backgroundImage: item
        ? `linear-gradient(rgba(8, 7, 5, 0.55), rgba(8, 7, 5, 0.55)), url(/img/slots/${slot}.png)`
        : `url(/img/slots/${slot}.png)`,
    }}
    onClick={item || locked ? onToggleLock : undefined}
  >
    {item && <img className={styles.icon} src={`/img/items/${item.icon}`} alt={item.name} />}
    {locked && <span className={styles.lockBadge}>🔒</span>}
  </RsTooltip>
);

/** The in-game equipment tab, built from the authentic wiki slot sprites.
 *  Clicking a filled slot toggles its lock — locked gear survives rerolls. */
export const EquipmentPanel = ({
  loadout,
  locks,
  onToggleLock,
}: {
  loadout: Loadout;
  locks: Partial<Record<Slot, Item>>;
  onToggleLock: (slot: Slot) => void;
}) => (
  <div className={styles.tab}>
    {SLOTS.map((slot) => (
      <EquipSlot
        key={slot}
        slot={slot}
        item={loadout[slot]}
        locked={locks[slot] !== undefined}
        onToggleLock={() => onToggleLock(slot)}
      />
    ))}
  </div>
);
