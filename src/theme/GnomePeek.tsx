import { asset } from '../asset';
import styles from './GnomePeek.module.css';

/**
 * Where a gnome is stuck. Each spot is a hand-tuned offset rather than a
 * generic corner system: the charm is in him overlapping the frame by just the
 * right amount, and that amount differs per edge.
 */
export type PeekSpot = 'buttonTop' | 'panelTopLeft' | 'panelBottomRight';

/**
 * The mascot, peeking. Pure decoration: `pointer-events: none` so he can never
 * swallow a click on the CTA he is sitting on, and `aria-hidden` so screen
 * readers skip him entirely.
 *
 * For `buttonTop` he must render BEFORE the button in the DOM — he is layered
 * behind it so the button's own background clips his chin, which is what sells
 * the "popping up from behind" read.
 */
export const GnomePeek = ({ at, className }: { at: PeekSpot; className?: string }) => (
  <img
    className={`${styles.gnome} ${styles[at]} ${className ?? ''}`}
    src={asset('img/ui/gnome-peek.png')}
    alt=""
    aria-hidden="true"
    draggable={false}
  />
);
