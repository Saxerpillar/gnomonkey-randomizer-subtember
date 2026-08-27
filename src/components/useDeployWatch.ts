import { useEffect, useRef, useState } from 'react';

/** Vite hashes the bundle filename per build, so it doubles as a build id. */
const BUNDLE = /assets\/(index-[A-Za-z0-9_-]+\.js)/;

const runningBundle = (): string | null => {
  const src = document.querySelector<HTMLScriptElement>('script[type=module][src]')?.src ?? '';
  return src.match(BUNDLE)?.[1] ?? null;
};

/**
 * True once a newer build has been deployed than the one this page is running.
 *
 * Compares the hashed bundle name in the live `index.html` against the one that
 * booted this page. Nothing has to be published at build time — the hash Vite
 * already emits is the version.
 *
 * This is the app's ONE runtime network call, and it is deliberately narrow:
 * same-origin only, `no-store` so a cached copy cannot mask a deploy, and
 * silent on every failure. Offline, blocked, or mid-deploy all just mean "check
 * again next tick" rather than an error the viewer sees.
 *
 * Dormant on the dev server, which serves `/src/main.tsx` rather than a hashed
 * bundle — there is no build identity to compare, so it never polls.
 */
export const useDeployWatch = (intervalMs = 60_000): boolean => {
  const [stale, setStale] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const mine = runningBundle();
    if (!mine) return;

    const check = async () => {
      // Nothing to learn while the tab is hidden, and no reason to keep asking
      // once the answer is yes.
      if (done.current || document.hidden) return;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: 'no-store' });
        if (!res.ok) return;
        const live = (await res.text()).match(BUNDLE)?.[1];
        if (live && live !== mine) {
          done.current = true;
          setStale(true);
        }
      } catch {
        /* offline, blocked, or mid-deploy — try again next tick */
      }
    };

    void check();
    const id = window.setInterval(check, intervalMs);
    // Coming back to the tab is the most likely moment for this to have changed.
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [intervalMs]);

  return stale;
};
