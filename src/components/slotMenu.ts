import type { Loadout, Slot } from '../engine/types';
import type { MenuEntry } from '../theme/RsContextMenu';

/**
 * The right-click options for one equipment slot.
 *
 * Shared by the single loadout and the raid lanes so the two cannot drift: a
 * lane's menu should offer exactly what the main panel's does, just aimed at
 * that lane. The caller supplies the actions, so this stays free of state.
 */
export const slotMenuEntries = (
  loadout: Loadout,
  slot: Slot,
  actions: { reroll: () => void; remove: () => void },
): MenuEntry[] => {
  const entries: MenuEntry[] = [];
  // The shield slot is genuinely unusable under a two-handed weapon, so
  // offering to roll it would be offering a no-op.
  const shieldBlocked = slot === 'shield' && (loadout.weapon?.twoHanded ?? false);
  if (!shieldBlocked) {
    entries.push({ label: `Reroll ${slot}`, onSelect: actions.reroll });
  }
  if (loadout[slot]) {
    entries.push({ label: 'Remove item from slot', onSelect: actions.remove });
  }
  return entries;
};
