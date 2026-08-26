import { useEffect, useMemo, useRef, useState } from 'react';
import { asset } from '../asset';
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
const FILLERS = 26;
const DECOYS = 2;
const ROLL_MS = 3900; // the tape ticks for the full sound
const TOOLTIP_MS = 900;
const MINIMIZE_MS = 600;
const BOSS_SUSPENSE_MS = 800;

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
  onDone,
  onLand,
}: {
  data: RevealData;
  muted: boolean;
  onDone: () => void;
  onLand?: (impact: LandingImpact) => void;
}) => {
  const [phase, setPhase] = useState<'roll' | 'tooltip' | 'reveal' | 'minimize'>('roll');
  const [row, setRow] = useState(0);
  const [minimize, setMinimize] = useState<string>();
  const [landed, setLanded] = useState(false);
  const [landedTier, setLandedTier] = useState<Tier | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  const onLandRef = useRef(onLand);
  onDoneRef.current = onDone;
  onLandRef.current = onLand;

  const tape = useMemo(() => {
    if (data.kind !== 'slot' || data.candidates.length === 0) return null;
    return buildTape(data.candidates, data.item, mulberry32(randomSeed()), FILLERS, DECOYS);
  }, [data]);

  useEffect(() => {
    if (!muted) playTick();
  }, [muted]);

  // Landing: tier burst, thud, fanfare (elite/boss), host shake.
  useEffect(() => {
    if (!landed) return;
    const tier = data.kind === 'slot' ? data.tier : null;
    if (tier) setLandedTier(tier);
    if (!muted) playThud();
    if ((tier === 'elite' || data.kind === 'boss') && !muted) playFanfare();
    onLandRef.current?.(data.kind === 'boss' ? 'boss' : tier === 'elite' ? 'elite' : 'normal');
  }, [landed, data, muted]);

  useEffect(() => {
    const target = data.target;
    const minimize = () => {
      if (data.kind === 'boss') setLanded(true);
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

    if (data.kind === 'boss') {
      // suspense "?" → reveal name → minimize
      const t1 = setTimeout(() => setPhase('reveal'), BOSS_SUSPENSE_MS);
      const t2 = setTimeout(minimize, ROLL_MS);
      const t3 = setTimeout(finish, ROLL_MS + MINIMIZE_MS);
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
    const delays = tapeTickDelays(deltas.length, ROLL_MS);
    const timers: number[] = [];
    let i = 0;
    let r = 0;
    const tick = () => {
      if (i < deltas.length) {
        r += deltas[i];
        setRow(r);
        i += 1;
        timers.push(window.setTimeout(tick, delays[Math.min(i, delays.length - 1)] ?? 0));
        return;
      }
      setLanded(true);
      setPhase('tooltip');
      timers.push(window.setTimeout(minimize, TOOLTIP_MS));
      timers.push(window.setTimeout(finish, TOOLTIP_MS + MINIMIZE_MS));
    };
    timers.push(window.setTimeout(tick, delays[0] ?? 0));
    return () => timers.forEach(clearTimeout);
  }, [data, tape]);

  const isSlot = data.kind === 'slot';
  const title = isSlot ? data.item.name : data.boss.name;
  const icon = isSlot ? asset(`img/items/${data.item.icon}`) : asset(`img/bosses/${encodeURIComponent(data.boss.image)}`);
  const burstClass =
    data.kind === 'boss'
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

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} />
      <div
        ref={cardRef}
        className={`${styles.card} ${phase === 'minimize' ? styles.minimize : ''}`}
        style={phase === 'minimize' && minimize ? { transform: minimize } : undefined}
      >
        {burstClass && <span className={`${styles.burst} ${burstClass}`} />}
        {isSlot && phase === 'roll' && tape && (
          <div className={styles.tapeWrap}>
            <span className={styles.slotLabel}>{SLOT_LABEL[data.slot]}</span>
            <div className={styles.tapeWindow}>
              <span className={styles.tapeHighlight} />
              <span className={styles.tapeColumn} style={{ transform: `translateY(${-row * ROW}px)` }}>
                {tape.items.map((it, i) => (
                  <img key={`${it.id}-${i}`} className={styles.tapeRow} src={asset(`img/items/${it.icon}`)} alt="" />
                ))}
              </span>
            </div>
          </div>
        )}
        {isSlot && (phase !== 'roll' || !tape) && revealContent}
        {!isSlot && phase === 'roll' && (
          <>
            <span className={styles.bossSuspense}>?</span>
            <span className={styles.bossSubtitle}>{BOSS_SUSPENSE_LINE}</span>
          </>
        )}
        {!isSlot && phase !== 'roll' && (
          <>
            <img className={styles.bossIcon} src={icon} alt="" />
            <span className={styles.bossTitle}>{title}</span>
            <span className={styles.bossSubtitle}>{CHALLENGER_SUBTITLE}</span>
          </>
        )}
      </div>
    </div>
  );
};

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
