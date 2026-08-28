import { asset } from '../asset';
import { SLOTS, type Item, type Loadout, type Slot } from '../engine/types';
import { GpValue } from '../theme/GpValue';
import { RsTooltip } from '../theme/RsTooltip';
import tipStyles from '../theme/RsTooltip.module.css';
import { SLOT_LABEL } from './copy';
import styles from './EquipmentPanel.module.css';

const slotTip = (slot: Slot, item: Item | null) =>
  item ? (
    <>
      <span className={tipStyles.tipTitle}>{item.name}</span>
      {item.price != null ? (
        <GpValue gp={item.price} />
      ) : (
        !item.tradeable && <span className={tipStyles.tipMuted}>Untradeable</span>
      )}
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
  pending,
  onContextMenu,
}: {
  slot: Slot;
  item: Item | null;
  pending?: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
}) => (
  <RsTooltip
    content={slotTip(slot, item)}
    dataSlot={slot}
    className={`${styles.slot} ${item ? styles[item.tier] : ""} ${pending ? styles.pending : ""}`}
    style={{
      gridArea: slot,
      // occupied: dim the slot sprite so the item reads on top of it
      backgroundImage: item
        ? `linear-gradient(rgba(8, 7, 5, 0.55), rgba(8, 7, 5, 0.55)), url(${asset(`img/slots/${slot}.png`)})`
        : `url(${asset(`img/slots/${slot}.png`)})`,
    }}
    onContextMenu={onContextMenu}
  >
    {item && <img className={styles.icon} src={asset(`img/items/${item.icon}`)} alt={item.name} />}
  </RsTooltip>
);

/** The in-game equipment tab, built from the authentic wiki slot sprites.
 *  `pendingSlots` marks slots whose title card is up (pulsing ghost); their
 *  item lands once the card minimizes into them. `visibleSlots` (ceremony
 *  only) limits which tiles render, so the skeleton builds from the helmet
 *  outward one tile at a time. */
export const EquipmentPanel = ({
  loadout,
  pendingSlots,
  visibleSlots,
  onSlotContextMenu,
  deactivated,
}: {
  loadout: Loadout;
  pendingSlots?: Slot[];
  visibleSlots?: Slot[];
  onSlotContextMenu: (slot: Slot, e: React.MouseEvent) => void;
  /** Gauntlet: no gear allowed, so the whole tab reads as powered down. */
  deactivated?: boolean;
}) => (
  <div className={`${styles.tab} ${deactivated ? styles.deactivated : ""}`}>
    {SLOTS.map((slot) => {
      if (visibleSlots && !visibleSlots.includes(slot)) {
        // not yet revealed — a faint ghost marks where the tile will land
        return <span key={slot} className={styles.ghost} style={{ gridArea: slot }} />;
      }
      return (
        <EquipSlot
          key={slot}
          slot={slot}
          item={loadout[slot]}
          pending={pendingSlots?.includes(slot)}
          onContextMenu={(e) => onSlotContextMenu(slot, e)}
        />
      );
    })}
  </div>
);
