import styles from './TitleBanner.module.css';

/**
 * The wordmark. Marked `data-solid="strict"` so the emote scatter treats it as
 * a hard keep-out and never places a sprite behind the letters — unlike the
 * panels, which tolerate a sprite overlapping them a little.
 */
export const TitleBanner = ({ className }: { className?: string }) => (
  <div className={`${styles.banner} ${className ?? ''}`} data-solid="strict">
    <h1 className={`title ${styles.text}`}>Gnome Subtember</h1>
  </div>
);

