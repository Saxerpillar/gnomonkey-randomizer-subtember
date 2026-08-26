import { useEffect, useState } from 'react';
import { formatClock } from './challenges';
import styles from './BossPanel.module.css';

/**
 * Live mm:ss countdown for the timed challenge. Starts the moment it mounts
 * (i.e. as soon as the challenge is on screen) and stops at 00:00.
 */
export const CountdownTimer = ({ seconds }: { seconds: number }) => {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
    const started = Date.now();
    const id = window.setInterval(() => {
      const remaining = seconds - Math.floor((Date.now() - started) / 1000);
      setLeft(remaining > 0 ? remaining : 0);
      if (remaining <= 0) window.clearInterval(id);
    }, 250); // sub-second poll so the clock never visibly skips a number
    return () => window.clearInterval(id);
  }, [seconds]);

  return (
    <span className={`${styles.timer} ${left === 0 ? styles.timerDone : ''}`}>{formatClock(left)}</span>
  );
};
