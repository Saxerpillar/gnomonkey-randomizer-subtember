import { useEffect, useRef } from 'react';
import { asset } from '../asset';
import type { Boss } from './DataProvider';
import { EMOTES } from './emotes';
import type { Item } from '../engine/types';

/** How many warm-up requests are allowed in flight at once. */
const CONCURRENCY = 8;

/**
 * Warms an image into the browser cache. Resolves on failure too — a missing
 * icon should slow the queue down, not stall it.
 */
const warmImage = (url: string): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });

/** Runs `jobs` with a fixed number in flight, in order, until `stop` says stop. */
const drain = async (urls: string[], stop: () => boolean) => {
  let next = 0;
  const worker = async () => {
    while (next < urls.length && !stop()) {
      const url = urls[next++];
      await warmImage(url);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
};

/**
 * Pulls every asset the ceremony will need into cache while the pre-roll screen
 * sits idle, so nothing pops in mid-reveal.
 *
 * The reels are the reason this matters: a slot's tape is built from random
 * same-slot items and the boss finale from random boss faces, so a roll can
 * touch almost any of the ~3800 icons and 59 boss renders — far more than the
 * handful the roll itself lands on (those are already preloaded at DECIDE).
 *
 * Ordered by when it would be missed: emote trim is on screen immediately, boss
 * renders are large and few, item icons are small and many. A concurrency cap
 * keeps it from opening thousands of sockets at once, and it stops the moment
 * the component unmounts — i.e. as soon as the roll starts.
 */
export const usePreloadAssets = (items: Item[], bosses: Boss[]) => {
  // Once per page load, not once per return to the pre-roll screen.
  const started = useRef(false);

  useEffect(() => {
    if (started.current || items.length === 0) return;
    started.current = true;
    let cancelled = false;

    const urls = [
      ...Object.values(EMOTES).map((e) => asset(`img/emotes/${e.file}`)),
      asset('img/ui/watermark.gif'),
      asset('img/coins.png'),
      ...bosses.map((b) => asset(`img/bosses/${encodeURIComponent(b.image)}`)),
      ...items.map((i) => asset(`img/items/${i.icon}`)),
    ];

    void drain(urls, () => cancelled);
    // The boom is fetched here so only the decode is left for the DECIDE click,
    // where the user gesture makes the AudioContext available.
    void fetch(asset('audio/vine-boom.mp3')).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [items, bosses]);
};
