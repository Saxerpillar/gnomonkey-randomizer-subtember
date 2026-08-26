import { useEffect, useRef, useState } from 'react';

/**
 * Animates a displayed value toward `target` with an ease-out roll-up,
 * firing `onTick(progress)` on each visual step (throttled to ~every other
 * frame) so callers can play rising-pitch ticks. Returns the eased value.
 */
export const useCountUp = (
  target: number,
  duration = 500,
  onTick?: (progress: number) => void,
): number => {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    const diff = to - from;
    if (diff === 0) {
      prevRef.current = to;
      setValue(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + diff * eased));
      frame += 1;
      if (frame % 2 === 0) onTickRef.current?.(t);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevRef.current = to;
        onTickRef.current?.(1);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
};
