import { useEffect, useRef } from 'react';
import { asset } from '../asset';
import { EMOTES } from './emotes';
import { playVineBoom } from './sound';
import styles from './Stinger.module.css';

/**
 * `challenge` — the laser gnome slams in huge and fades away, fired whenever a
 * run draws an extra challenge.
 * `flashbang` — the shocked face, blown out by a white screen flash, fired on a
 * coin flip whenever an ELITE item lands.
 * `gamba` — the rarest: a 1-in-50 roll on any reveal at all, capped at one per
 * DECIDE so it stays a surprise.
 * `hardmode` — the deep-fried AHHHH gnome, on a coin flip when a hard-mode
 * fight also draws a challenge.
 *
 * All of them fill the screen at full opacity from the first frame, fade out
 * from there, and land on the vine boom. The flashing kinds additionally blow
 * the screen white.
 */
export type StingerKind = 'challenge' | 'flashbang' | 'gamba' | 'hardmode';

/** A stinger holds, then fades right out across 2.5s — long enough for chat to
 *  actually register it. Deliberately NOT scaled by the ceremony speed setting:
 *  this is a punchline, not part of the reel pacing. */
const STINGER_MS = 2500;

const ART: Record<StingerKind, keyof typeof EMOTES> = {
  challenge: 'lasers',
  flashbang: 'shocked',
  gamba: 'gamba',
  hardmode: 'hardmode',
};

/**
 * Kinds that blow the screen out white on arrival. Kept separate from the boom
 * below: the laser gnome wants the hit without the blowout, which reads as a
 * different, gentler beat than a flashbang.
 */
const FLASHES = new Set<StingerKind>(['flashbang', 'gamba', 'hardmode']);

/** Kinds that land on the vine boom — all of them. */
const BOOMS = new Set<StingerKind>(['challenge', 'flashbang', 'gamba', 'hardmode']);

/**
 * A one-shot full-screen overlay. Mount it with a fresh `key` to replay; it
 * calls `onDone` when its animation finishes so the parent can unmount it.
 *
 * Never interactive — `pointer-events: none` means it cannot block a click on
 * the reveal underneath even while it covers the screen.
 */
export const Stinger = ({
  kind,
  muted = false,
  noFlash = false,
  onDone,
}: {
  kind: StingerKind;
  muted?: boolean;
  /** Suppress the white blowout, keeping the art and the boom. */
  noFlash?: boolean;
  onDone: () => void;
}) => {
  const emote = ART[kind];
  const duration = STINGER_MS;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    const t = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(t);
  }, [duration, onDone]);

  // The screen-flash kinds land on a vine boom, stopped on unmount so the sound
  // can never outlive the visual it belongs to.
  //
  // No "already fired" guard here, deliberately. StrictMode double-invokes
  // effects in dev, and pairing a guard with the cleanup below silently killed
  // the sound outright: play → simulated unmount stops it → remount sees the
  // guard and never replays. Play/stop/play is self-correcting instead — one
  // audible boom in dev, one in production.
  useEffect(() => {
    if (!BOOMS.has(kind) || mutedRef.current) return;
    return playVineBoom();
  }, [kind]);

  return (
    <div
      className={`${styles.stinger} ${styles[kind] ?? ''}`}
      style={{ animationDuration: `${duration}ms` }}
      aria-hidden="true"
    >
      {FLASHES.has(kind) && !noFlash && (
        <div className={styles.flash} style={{ animationDuration: `${duration}ms` }} />
      )}
      <img
        className={styles.art}
        style={{ animationDuration: `${duration}ms` }}
        src={asset(`img/emotes/${EMOTES[emote].file}`)}
        alt=""
        draggable={false}
      />
    </div>
  );
};
