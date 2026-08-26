import { useEffect, useMemo, useRef, useState } from 'react';
import { asset } from '../asset';
import { EMOTES } from './emotes';
import { buildTape, tapeTickDelays } from '../engine/reel';
import { mulberry32, randomSeed } from '../engine/rng';
import type { Tier } from '../engine/types';
import { GpValue } from '../theme/GpValue';
import tipStyles from '../theme/RsTooltip.module.css';
import { BOSS_SUSPENSE_LINE, CHALLENGER_SUBTITLE, SLOT_LABEL } from './copy';
import { playFanfare, playThud, playTick } from './sound';
import type { RevealData } from './useCeremony';
import styles from './RevealCard.module.css';

const ROW = 64;
/** The boss finale reels in ~5x the area a gear slot gets. */
const BOSS_ROW = 96;
const FILLERS = 26;
const DECOYS = 2;
/**
 * Length of `public/audio/tick.wav`, whose tail IS the concluding ding. The
 * tape has to finish settling exactly here or the ding lands before the item
 * does — at 3900 the reel kept moving for 65ms after the sound had stopped.
 */
const TICK_SOUND_MS = 3835;
const ROLL_MS = TICK_SOUND_MS; // the tape ticks for exactly the sound's length

/** Floors for the last two beats, so the bounce stays readable at any speed. */
const OVERSHOOT_MIN_MS = 200;
const SETTLE_MIN_MS = 260;
const TOOLTIP_MS = 900;
const MINIMIZE_MS = 600;
const BOSS_SUSPENSE_MS = 800;
/** Beat between the boss landing and the HARD MODE stamp. */
const HARD_MODE_MS = 1100;

export type LandingImpact = 'normal' | 'elite' | 'boss';

/**
 * A per-reveal card centered on screen. Phases: roll (a slot-machine tape of
 * eligible items ticking down, wobbling, and stopping on the winner) →
 * tooltip (large item icon + headline name + value) → minimize (shrink/fly
 * from centre into the slot). The boss variant skips the tape and announces
 * the challenger instead. `onLand` fires at each landing with the impact tier
 * so the host can shake the screen.
 */
export const RevealCard = ({
  data,
  muted,
  speed = 1,
  onDone,
  onLand,
}: {
  data: RevealData;
  muted: boolean;
  /** Debug ceremony speed multiplier: 2 = twice as fast. */
  speed?: number;
  onDone: () => void;
  onLand?: (impact: LandingImpact) => void;
}) => {
  const [phase, setPhase] = useState<'roll' | 'tooltip' | 'reveal' | 'minimize'>('roll');
  const [row, setRow] = useState(0);
  const [motion, setMotion] = useState({ ms: 0, ease: 'linear' });
  const [minimize, setMinimize] = useState<string>();
  const [landed, setLanded] = useState(false);
  const [landedTier, setLandedTier] = useState<Tier | null>(null);
  const [stamped, setStamped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  const onLandRef = useRef(onLand);
  onDoneRef.current = onDone;
  onLandRef.current = onLand;
  // Progressive skip: the running phase's own timers, plus the two jumps a
  // click can take (land the reel now / drop the card into its slot now).
  const timersRef = useRef<number[]>([]);
  const skipToLandRef = useRef<(() => void) | null>(null);
  const skipToMinimizeRef = useRef<(() => void) | null>(null);
  const finishRef = useRef<(() => void) | null>(null);

  // Both slots and the boss reel on a tape — the boss is just a tape of faces.
  const tape = useMemo(() => {
    if (data.kind === 'slot') {
      if (data.candidates.length === 0) return null;
      return buildTape(data.candidates, data.item, mulberry32(randomSeed()), FILLERS, DECOYS);
    }
    if (data.kind === 'squad') {
      const first = data.reels[0];
      if (!first || first.candidates.length === 0) return null;
      return buildTape(first.candidates, first.item, mulberry32(randomSeed()), FILLERS, DECOYS);
    }
    if (data.candidates.length < 2) return null;
    return buildTape(data.candidates, data.boss, mulberry32(randomSeed()), FILLERS, DECOYS);
  }, [data]);

  /**
   * Raid lanes: one tape each, all built with the SAME filler count so every
   * winner sits at the same index — that lets all three share one row offset
   * and land on the same beat.
   */
  const squadTapes = useMemo(() => {
    if (data.kind !== 'squad') return null;
    return data.reels.map((r) =>
      r.candidates.length === 0
        ? { items: [r.item], winnerIndex: 0 }
        : buildTape(r.candidates, r.item, mulberry32(randomSeed()), FILLERS, DECOYS),
    );
  }, [data]);

  useEffect(() => {
    if (!muted) playTick();
  }, [muted]);

  // Landing: tier burst, thud, fanfare (elite/boss), host shake.
  useEffect(() => {
    if (!landed) return;
    const tier = data.kind === 'slot' ? data.tier : null;
    const squadBest =
      data.kind === 'squad' ? (data.reels.some((r) => r.tier === 'elite') ? 'elite' : null) : null;
    if (tier) setLandedTier(tier);
    if (!muted) playThud();
    if ((tier === 'elite' || data.kind === 'boss') && !muted) playFanfare();
    onLandRef.current?.(
      data.kind === 'boss'
        ? 'boss'
        : tier === 'elite' || squadBest === 'elite'
          ? 'elite'
          : 'normal',
    );
  }, [landed, data, muted]);

  useEffect(() => {
    const s = Math.max(1, speed);
    const ROLL = ROLL_MS / s;
    const TOOLTIP = TOOLTIP_MS / s;
    const MINIMIZE = MINIMIZE_MS / s;
    const HARD_MODE = HARD_MODE_MS / s;
    const BOSS_SUSPENSE = BOSS_SUSPENSE_MS / s;
    const target = data.target;
    const minimize = () => {
      if (data.kind === 'boss') setLanded(true);
      if (data.kind === 'squad') {
        // Three destinations — fade in place instead of flying to one slot.
        setPhase('minimize');
        return;
      }
      const el = document.querySelector(target);
      const card = cardRef.current;
      if (el && card) {
        const tr = el.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        const scale = Math.max(0.05, tr.width / cr.width);
        const dx = tr.left + tr.width / 2 - (cr.left + cr.width / 2);
        const dy = tr.top + tr.height / 2 - (cr.top + cr.height / 2);
        setMinimize(`translate(${dx}px, ${dy}px) scale(${scale})`);
      }
      setPhase('minimize');
    };
    const finish = () => onDoneRef.current();

    // Boss with too small a pool to reel: fall back to suspense "?" → name.
    if (data.kind === 'boss' && !tape) {
      const t1 = setTimeout(() => setPhase('reveal'), BOSS_SUSPENSE);
      const t2 = setTimeout(minimize, ROLL);
      const t3 = setTimeout(finish, ROLL + MINIMIZE);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }

    if (!tape) {
      const t1 = setTimeout(minimize, 400);
      const t2 = setTimeout(finish, 400 + MINIMIZE_MS);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    // Tape: discrete ticking (one row per tick), decelerating, with a wobble
    // (overshoot one row, then settle back onto the winner).
    const targetRow = tape.winnerIndex - 1;
    if (targetRow < 0) {
      const t1 = setTimeout(minimize, 400);
      const t2 = setTimeout(finish, 400 + MINIMIZE_MS);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    const deltas: number[] = [...Array(targetRow).fill(1), 1, -1];
    const delays = tapeTickDelays(deltas.length, ROLL);
    const timers = timersRef.current;
    let i = 0;
    let r = 0;

    // Land now, but keep the bounce: a fast overshoot then a springy settle.
    const land = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      i = deltas.length;
      setMotion({ ms: 90, ease: 'linear' });
      setRow(targetRow + 1);
      timers.push(
        window.setTimeout(() => {
          setMotion({ ms: 200, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
          setRow(targetRow);
          timers.push(window.setTimeout(settle, 200));
        }, 90),
      );
    };
    const settle = () => {
      setLanded(true);
      setPhase(data.kind === 'boss' || data.kind === 'squad' ? 'reveal' : 'tooltip');
      // A hard-mode fight shows the normal boss first, then stamps HARD MODE
      // after a beat — so the card lingers long enough to read both.
      const stampWait = data.kind === 'boss' && data.hardMode ? HARD_MODE : 0;
      if (stampWait) timers.push(window.setTimeout(() => setStamped(true), stampWait));
      timers.push(window.setTimeout(minimize, TOOLTIP + stampWait));
      timers.push(window.setTimeout(finish, TOOLTIP + stampWait + MINIMIZE));
    };
    skipToLandRef.current = land;
    skipToMinimizeRef.current = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      minimize();
      timers.push(window.setTimeout(finish, MINIMIZE));
    };
    finishRef.current = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      finish();
    };
    const tick = () => {
      if (i < deltas.length) {
        r += deltas[i];
        // Glide to the next row over that tick's whole duration instead of
        // teleporting: linear while the reel is spinning, then a springy
        // overshoot + settle for the final two beats (the bounce-back).
        const dur = delays[i] ?? 0;
        const isSettle = i === deltas.length - 1;
        const isOvershoot = i === deltas.length - 2;
        // The floors can outrun a beat's slot in the schedule once the speed
        // multiplier shrinks the slots: at 4x the settle slot is ~83ms while the
        // motion still takes 260ms. Wait on the motion, not the slot, or the
        // landing thud fires while the reel is visibly still moving.
        const ms = isSettle
          ? Math.max(SETTLE_MIN_MS, dur)
          : isOvershoot
            ? Math.max(OVERSHOOT_MIN_MS, dur)
            : dur;
        setMotion({
          ms,
          ease: isSettle
            ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            : isOvershoot
              ? 'cubic-bezier(0.22, 0.61, 0.36, 1)'
              : 'linear',
        });
        setRow(r);
        i += 1;
        // Mid-reel the cadence is the next beat's slot; on the last beat there
        // is no next slot, so it is the settle motion we are waiting out.
        const wait = i < deltas.length ? (delays[i] ?? 0) : ms;
        timers.push(window.setTimeout(tick, wait));
        return;
      }
      // The boss gets its full-size announcement; slots get the tooltip card.
      settle();
    };
    timers.push(window.setTimeout(tick, delays[0] ?? 0));
    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      skipToLandRef.current = null;
      skipToMinimizeRef.current = null;
      finishRef.current = null;
    };
  }, [data, tape, speed]);

  const isSlot = data.kind === 'slot';
  const isSquad = data.kind === 'squad';
  const isBoss = data.kind === 'boss';
  const title = isSlot ? data.item.name : isBoss ? data.boss.name : SLOT_LABEL[data.slot];
  const icon = isBoss ? asset(`img/bosses/${encodeURIComponent(data.boss.image)}`) : '';
  const burstClass = isBoss
    ? landed
      ? styles.burstBoss
      : null
    : landedTier
      ? styles[`burst${capitalize(landedTier)}`]
      : null;

  const revealContent = isSlot ? (
    <span className={styles.reveal}>
      <img className={styles.revealIcon} src={asset(`img/items/${data.item.icon}`)} alt="" />
      <span className={styles.revealName}>{title}</span>
      {data.item.price != null ? (
        <GpValue gp={data.item.price} />
      ) : (
        !data.item.tradeable && <span className={tipStyles.tipMuted}>Untradeable</span>
      )}
    </span>
  ) : null;

  /**
   * Progressive skip: first click lands the reel (keeping the bounce), the
   * next drops the card into its slot, the next ends the beat outright.
   */
  const skip = () => {
    if (phase === 'roll') skipToLandRef.current?.();
    else if (phase === 'minimize') finishRef.current?.();
    else skipToMinimizeRef.current?.();
  };

  return (
    <div className={styles.overlay} onClick={skip}>
      <div className={styles.backdrop} />
      <div
        ref={cardRef}
        className={`${styles.card} ${landedTier ? styles[`card${capitalize(landedTier)}`] : ''} ${phase === 'minimize' ? styles.minimize : ''}`}
        style={phase === 'minimize' && minimize ? { transform: minimize } : undefined}
      >
        {/* Perched on top of the roulette for the length of an item roll. */}
        {isSlot && phase === 'roll' && (
          <img
            className={styles.roulettePet}
            src={asset(`img/emotes/${EMOTES.roulette.file}`)}
            alt=""
            aria-hidden="true"
          />
        )}
        {burstClass && <span className={`${styles.burst} ${burstClass}`} />}
        {isSquad && phase === 'roll' && squadTapes && (
          <div className={styles.squadWrap}>
            <span className={styles.slotLabel}>{SLOT_LABEL[data.slot]}</span>
            <div className={styles.squadRow}>
              {data.reels.map((reel, i) => (
                <div key={reel.lane} className={styles.squadLane}>
                  <span className={styles.laneLabel}>{reel.label}</span>
                  <div className={styles.tapeWindow}>
                    <span className={styles.tapeHighlight} />
                    <span
                      className={styles.tapeColumn}
                      style={{
                        transform: `translateY(${-row * ROW}px)`,
                        transition: `transform ${motion.ms}ms ${motion.ease}`,
                      }}
                    >
                      {squadTapes[i].items.map((it, j) => (
                        <img
                          key={`${it.id}-${j}`}
                          className={styles.tapeRow}
                          src={asset(`img/items/${it.icon}`)}
                          alt=""
                        />
                      ))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isSquad && phase !== 'roll' && (
          <div className={styles.squadWrap}>
            <span className={styles.slotLabel}>{SLOT_LABEL[data.slot]}</span>
            <div className={styles.squadRow}>
              {data.reels.map((reel) => (
                <div
                  key={reel.lane}
                  className={`${styles.squadResult} ${styles[`card${capitalize(reel.tier)}`]}`}
                >
                  <span className={styles.laneLabel}>{reel.label}</span>
                  <img
                    className={styles.squadIcon}
                    src={asset(`img/items/${reel.item.icon}`)}
                    alt=""
                  />
                  <span className={styles.squadName}>{reel.item.name}</span>
                  {reel.item.price != null && <GpValue gp={reel.item.price} />}
                </div>
              ))}
            </div>
          </div>
        )}
        {!isSquad && phase === 'roll' && tape && (
          <div className={styles.tapeWrap}>
            <span className={styles.slotLabel}>{isSlot ? SLOT_LABEL[data.slot] : 'Your fate'}</span>
            <div className={`${styles.tapeWindow} ${isSlot ? '' : styles.tapeWindowBoss}`}>
              <span className={styles.tapeHighlight} />
              <span
                className={styles.tapeColumn}
                style={{
                  transform: `translateY(${-row * (isSlot ? ROW : BOSS_ROW)}px)`,
                  transition: `transform ${motion.ms}ms ${motion.ease}`,
                }}
              >
                {tape.items.map((it, i) => (
                  <img
                    key={`${'id' in it ? it.id : it.name}-${i}`}
                    className={`${styles.tapeRow} ${isSlot ? '' : styles.tapeRowBoss}`}
                    src={
                      'id' in it
                        ? asset(`img/items/${it.icon}`)
                        : asset(`img/bosses/${encodeURIComponent(it.image)}`)
                    }
                    alt=""
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        {isSlot && (phase !== 'roll' || !tape) && revealContent}
        {isBoss && phase === 'roll' && !tape && (
          <>
            <span className={styles.bossSuspense}>?</span>
            <span className={styles.bossSubtitle}>{BOSS_SUSPENSE_LINE}</span>
          </>
        )}
        {isBoss && phase !== 'roll' && (
          <>
            <img className={styles.bossIcon} src={icon} alt="" />
            <span className={styles.bossTitle}>{title}</span>
            <span className={styles.bossSubtitle}>{CHALLENGER_SUBTITLE}</span>
            {!isSlot && data.hardMode && stamped && (
              <span className={styles.hardModeStamp}>HARD MODE</span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
