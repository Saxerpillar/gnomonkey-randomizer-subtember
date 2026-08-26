import { useLayoutEffect, useState } from 'react';
import { GpValue } from '../theme/GpValue';
import { playIncrement } from './sound';
import { useCountUp } from './useCountUp';
import styles from './ValueCounter.module.css';

/** Clear air between the counter and the top of the gear skeleton. */
const GAP = 14;

/**
 * Tracks the top edge of the gear skeleton so the counter can ride just above
 * it. The skeleton is centred in a flex column, so it shifts as the ceremony
 * assembles and as the window changes shape — a static offset drifts away from
 * it. Returns null until measured, and whenever the skeleton is absent.
 */
const useGearAnchor = (): { top: number; centreX: number } | null => {
  const [spot, setSpot] = useState<{ top: number; centreX: number } | null>(null);

  useLayoutEffect(() => {
    let frame = 0;
    let observed: Element | null = null;

    const measure = () => {
      const el = document.querySelector('[data-gear-anchor]');
      if (!el) {
        setSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setSpot((prev) => {
        const next = { top: r.top, centreX: r.left + r.width / 2 };
        // Skip the state write when nothing moved, or the observer below sees
        // our own re-render and loops.
        return prev && Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.centreX - next.centreX) < 0.5
          ? prev
          : next;
      });
      if (el !== observed) {
        if (observed) ro.unobserve(observed);
        ro.observe(el);
        observed = el;
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const ro = new ResizeObserver(schedule);
    measure();
    // The skeleton grows a tile at a time as slots land, which moves its top
    // edge; watch the DOM rather than just the window.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return spot;
};

/** Persistent ceremony counter: the loadout value rolls up as items land,
 *  ticking upward with a rising pitch (muted-gated). Pinned just above the gear
 *  skeleton, and above the reveal overlay so it stays readable mid-roll. */
export const ValueCounter = ({ value, muted }: { value: number; muted: boolean }) => {
  const shown = useCountUp(value, 500, (progress) => {
    if (!muted) playIncrement(progress);
  });
  const anchor = useGearAnchor();

  return (
    <div
      className={styles.counter}
      // The -100% in the transform means `top` is the counter's BOTTOM edge, so
      // it can be placed off the skeleton without knowing its own height.
      style={anchor ? { top: anchor.top - GAP, left: anchor.centreX } : undefined}
    >
      <span className={styles.label}>Value</span>
      <GpValue gp={shown} />
    </div>
  );
};
