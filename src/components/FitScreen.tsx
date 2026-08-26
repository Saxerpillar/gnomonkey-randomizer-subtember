import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './FitScreen.module.css';

/**
 * Shrinks its contents until they fit the window, so no page ever scrolls —
 * this runs on stream, where a scrollbar means the viewer simply never sees the
 * bottom of the layout.
 *
 * Scaling down rather than reflowing keeps every screen's proportions identical
 * at any window size, which matters when a raid's three setups are on screen at
 * once. Content is never scaled UP: at 1.0 it is already the intended size.
 *
 * Only ever wrap in-flow content. A `position: fixed` descendant of a
 * transformed element resolves against that element instead of the viewport,
 * which would quietly break the reveal cards, stingers and overlays — they stay
 * outside this wrapper.
 */
export const FitScreen = ({ children }: { children: ReactNode }) => {
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = box.current;
    const inner = content.current;
    if (!outer || !inner) return;

    // offsetWidth/Height and ResizeObserver's contentRect are both pre-transform
    // layout sizes, so measuring here cannot feed back into the scale we set.
    const fit = () => {
      const w = inner.offsetWidth;
      const h = inner.offsetHeight;
      if (!w || !h) return;
      setScale(Math.min(1, outer.clientWidth / w, outer.clientHeight / h));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(inner);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className={styles.box}>
      <div ref={content} className={styles.content} style={{ scale }}>
        {children}
      </div>
    </div>
  );
};
