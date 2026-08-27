import { useState } from 'react';
import { asset } from '../asset';
import styles from './Watermark.module.css';

/**
 * Permanent bottom-right credit, on every screen.
 *
 * Rendered from `App` rather than from a screen so it never remounts on a phase
 * change, and deliberately outside `FitScreen` — that wrapper transforms, which
 * would both scale the watermark with the layout and break its fixed position.
 *
 * The mark sits above the reveal overlay so it stays visible mid-roll, but
 * below the stingers, which are entitled to own the screen for their 2.5s.
 *
 * If the sprite is missing the text still stands on its own — a broken-image
 * icon in the corner of a stream would be worse than no sprite at all. The
 * asset credit is plain text for the same reason: it must survive whatever
 * happens to the artwork around it.
 */
export const Watermark = () => {
  const [spriteOk, setSpriteOk] = useState(true);
  return (
    <div className={styles.mark} aria-label="Made with love. Assets by chunkyatlas.">
      <span className={styles.text}>Made with love</span>
      {spriteOk && (
        <img
          className={styles.sprite}
          src={asset('img/ui/watermark.gif')}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setSpriteOk(false)}
        />
      )}
      <span className={styles.credit}>Assets by chunkyatlas</span>
    </div>
  );
};
