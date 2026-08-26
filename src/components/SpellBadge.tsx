import { asset } from '../asset';
import { isPoweredStaff, type Spell } from '../engine/spell';
import type { Item } from '../engine/types';
import { RsTooltip } from '../theme/RsTooltip';
import tipStyles from '../theme/RsTooltip.module.css';
import styles from './SpellBadge.module.css';

const BOOK_LABEL: Record<Spell['book'], string> = {
  standard: 'Standard spellbook',
  ancient: 'Ancient magicks',
  arceuus: 'Arceuus spellbook',
};

/** The spell that goes with the rolled weapon: castable staves show their
 *  rolled autocast spell; powered staves show their built-in attack. */
export const SpellBadge = ({ weapon, spell }: { weapon: Item | null; spell: Spell | null }) => {
  if (spell) {
    return (
      <div className={styles.badge}>
        <span className={styles.label}>Autocast</span>
        <RsTooltip
          content={
            <>
              <span className={tipStyles.tipTitle}>{spell.name}</span>
              <span className={tipStyles.tipMuted}>
                {BOOK_LABEL[spell.book]}
                {spell.maxHit > 0 ? ` · max hit ${spell.maxHit}` : ''}
              </span>
            </>
          }
          className={styles.spell}
        >
          <img src={asset(`img/spells/${spell.icon}`)} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <span>{spell.name}</span>
        </RsTooltip>
      </div>
    );
  }
  if (isPoweredStaff(weapon)) {
    return (
      <div className={styles.badge}>
        <span className={styles.label}>Autocast</span>
        <span className={styles.builtin}>built-in attack (powered staff)</span>
      </div>
    );
  }
  return null;
};
