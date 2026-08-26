import { useMemo, useRef, type CSSProperties } from 'react';
import { asset } from '../asset';
import { CLUSTERS, EMOTES, SCATTER, type EmoteKey } from './emotes';
import { DRIFT_PX, rotatedBox, SPRITE_GAP, useScatterLayout, type Piece } from './useScatterLayout';
import styles from './EmoteScatter.module.css';

interface Sprite {
  emote: EmoteKey;
  scale: number;
  rot: number;
}

/**
 * Emote trim strewn across the page. Fixed to the viewport, layered behind the
 * UI, and laid out at runtime so no piece ends up buried under a panel or
 * stacked on another — see `useScatterLayout`.
 *
 * Entirely decorative: `pointer-events: none` throughout and `aria-hidden`, so
 * it is invisible to clicks and to screen readers alike.
 */
export const EmoteScatter = () => {
  // Every sprite is solved individually, cluster members included: a huddle
  // should read as a group standing together, not as one gnome drawn on top of
  // another. Seeding members at their cluster's spot keeps them grouped.
  const { sprites, pieces } = useMemo(() => {
    const sprites: Sprite[] = [];
    const pieces: Piece[] = [];

    const add = (s: Sprite, x: number, y: number) => {
      const e = EMOTES[s.emote];
      // Floor, never round: rounding 57 * 2.5 up to 143px would put the emote
      // at 2.509x and quietly breach the 250% ceiling.
      const box = rotatedBox(Math.floor(e.w * s.scale), Math.floor(e.h * s.scale), s.rot);
      sprites.push(s);
      // The footprint reserved for collisions is the sprite plus its bob travel
      // and a little clear air — the sprite itself still renders at `box`.
      pieces.push({
        w: box.w + SPRITE_GAP,
        h: box.h + DRIFT_PX * 2 + SPRITE_GAP,
        x,
        y,
        area: box.w * box.h,
      });
    };

    for (const p of SCATTER) {
      add({ emote: p.emote, scale: p.scale, rot: p.rot }, p.x / 100, p.y / 100);
    }
    for (const c of CLUSTERS) {
      for (const m of c.members) {
        // dx/dy are px offsets; divide by a nominal window so the huddle keeps
        // its shape before the solver takes over.
        add(
          { emote: 'closeup', scale: m.scale, rot: m.rot },
          c.x / 100 + m.dx / 1600,
          c.y / 100 + m.dy / 900,
        );
      }
    }
    return { sprites, pieces };
  }, []);

  // The hook needs the layer element so it can ignore its own DOM writes.
  const layer = useRef<HTMLDivElement>(null);
  const placed = useScatterLayout(pieces, layer);

  return (
    <div
      ref={layer}
      className={styles.layer}
      aria-hidden="true"
      style={{ '--emote-drift': `${DRIFT_PX}px` } as CSSProperties}
    >
      {placed &&
        sprites.map((s, i) => {
          // No legal spot on this screen: sit this one out rather than squat
          // under a panel.
          if (!placed[i]) return null;
          const e = EMOTES[s.emote];
          const w = Math.floor(e.w * s.scale);
          return (
            <img
              key={`${s.emote}-${i}`}
              className={styles.sprite}
              src={asset(`img/emotes/${e.file}`)}
              alt=""
              draggable={false}
              width={w}
              height={Math.floor(e.h * s.scale)}
              style={{
                // Width comes off the natural size, so "only ever upscale, never
                // past 250%" holds by construction rather than by eyeballed px.
                width: w,
                left: placed[i].x,
                top: placed[i].y,
                rotate: `${s.rot}deg`,
                // Staggered so a dozen emotes never bob in lockstep.
                animationDelay: `${-((i * 1.37) % 7)}s`,
                animationDuration: `${6 + (i % 5) * 0.9}s`,
              }}
            />
          );
        })}
    </div>
  );
};
