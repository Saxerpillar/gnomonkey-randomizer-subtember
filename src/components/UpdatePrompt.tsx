import styles from './UpdatePrompt.module.css';

/**
 * "A newer build is live, reload to get it."
 *
 * Bottom-LEFT, because the watermark owns the bottom right. Only ever rendered
 * on the pre-roll screen: a refresh prompt appearing mid-reveal is exactly the
 * kind of thing that ruins a take, and between runs is when you would act on it
 * anyway.
 */
export const UpdatePrompt = () => (
  <button className={styles.prompt} type="button" onClick={() => window.location.reload()}>
    <span className={styles.dot} aria-hidden="true" />
    New version ready — click to reload
  </button>
);
