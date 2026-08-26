import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { EDGE_KEEPOUT } from './emotes';

export interface Piece {
  /** Collision footprint: the rotated sprite plus its bob travel and gap. */
  w: number;
  h: number;
  /** Desired centre, as a fraction of the viewport. */
  x: number;
  y: number;
  /** The sprite's true on-screen area. The obscured ratio divides by this
   *  rather than by the padded footprint, so the 25% ceiling is measured
   *  against what a viewer actually sees. Defaults to `w * h`. */
  area?: number;
}

export interface Placed {
  x: number;
  y: number;
}

/** No emote may be more than this much covered by the UI underneath it. */
export const MAX_OBSCURED = 0.25;

/** Amplitude of the idle bob, in px. The solver has to reserve room for it:
 *  place two sprites flush and the animation walks them straight into each
 *  other. Fed to the CSS as a custom property so there is one source of truth. */
export const DRIFT_PX = 9;

/** Clear air kept between neighbouring sprites, so they never quite touch. */
export const SPRITE_GAP = 6;

/** Axis-aligned footprint of a `w`x`h` sprite turned `rot` degrees. */
export const rotatedBox = (w: number, h: number, rot: number) => {
  const a = (Math.abs(rot) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { w: w * c + h * s, h: w * s + h * c };
};

const overlap = (a: DOMRect | Box, b: Box): number => {
  const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return dx > 0 && dy > 0 ? dx * dy : 0;
};

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** A strict obstacle tolerates no overlap at all, rather than the usual
   *  `MAX_OBSCURED` share. The wordmark is one: an emote peeking out from
   *  behind a panel reads as decoration, but one behind the title just reads
   *  as clutter over the logo. */
  strict?: boolean;
}

const boxOf = (x: number, y: number, w: number, h: number): Box => ({
  left: x - w / 2,
  top: y - h / 2,
  right: x + w / 2,
  bottom: y + h / 2,
});

/**
 * Places each emote at the nearest spot to its intended position where two
 * things hold: it is no more than `MAX_OBSCURED` covered by the UI, and it does
 * not touch an emote already placed.
 *
 * Greedy nearest-valid-spot rather than a relaxation loop. Relaxation stalls
 * badly here — a piece pushed out from under one panel lands under the next and
 * oscillates between them — whereas a ring search around the intended point
 * finds the closest genuinely free spot in one go, which is exactly what "get
 * out of the way" should mean: move the minimum distance required.
 *
 * Obstacles marked `strict` (the wordmark) allow no overlap at all; the rest
 * allow up to `MAX_OBSCURED`.
 *
 * A piece with nowhere legal to go is dropped (null) rather than parked
 * somewhere half-buried. On a busy screen the free margin genuinely cannot hold
 * every sprite, and "get out of the way" is better served by leaving than by
 * squatting under a panel.
 */
export const solveScatter = (
  pieces: Piece[],
  obstacles: Box[],
  vw: number,
  vh: number,
): (Placed | null)[] => {
  const pad = (EDGE_KEEPOUT / 100) * vw;
  const placed: (Placed | null)[] = [];
  const taken: Box[] = [];

  const RING_STEP = 14;
  const ANGLES = 24;
  const maxRadius = Math.hypot(vw, vh) / 2;

  for (const piece of pieces) {
    const { w, h } = piece;
    // Overlap is sampled over the padded box but scored against the real
    // sprite area, so the result errs toward moving clear rather than short.
    const area = piece.area ?? w * h;
    // Sprites wider than the free margin can never satisfy the rule; keeping
    // the clamp legal stops it collapsing to NaN on a tiny window.
    const minX = Math.min(pad + w / 2, vw / 2);
    const maxX = Math.max(vw - pad - w / 2, vw / 2);
    const clampX = (x: number) => Math.min(Math.max(x, minX), maxX);
    const clampY = (y: number) =>
      Math.min(Math.max(y, h / 2 + 4), Math.max(vh - h / 2 - 4, h / 2 + 4));

    const wanted = { x: clampX(piece.x * vw), y: clampY(piece.y * vh) };

    let found: Placed | null = null;

    for (let r = 0; r <= maxRadius && !found; r += RING_STEP) {
      const steps = r === 0 ? 1 : ANGLES;
      for (let a = 0; a < steps; a++) {
        // Offset every ring so candidates do not all line up on the same spokes.
        const angle = (a / steps) * Math.PI * 2 + r * 0.11;
        const spot = {
          x: clampX(wanted.x + Math.cos(angle) * r),
          y: clampY(wanted.y + Math.sin(angle) * r),
        };
        const box = boxOf(spot.x, spot.y, w, h);

        // A strict obstacle is treated like a sibling: touch it at all and the
        // candidate is out, however little of the sprite is covered.
        const blocked = obstacles.some((o) => o.strict && overlap(o, box) > 0);
        if (blocked) continue;

        const covered = obstacles.reduce((sum, o) => sum + overlap(o, box), 0) / area;
        const collision = taken.reduce((sum, o) => sum + overlap(o, box), 0) / area;

        if (collision === 0 && covered <= MAX_OBSCURED) {
          found = spot;
          break;
        }
      }
    }

    placed.push(found);
    // Only a placed sprite blocks the ones after it.
    if (found) taken.push(boxOf(found.x, found.y, w, h));
  }

  return placed;
};

const samePlacement = (a: (Placed | null)[] | null, b: (Placed | null)[] | null): boolean =>
  a != null &&
  b != null &&
  a.length === b.length &&
  a.every((p, i) => {
    const q = b[i];
    if (p == null || q == null) return p === q;
    return Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5;
  });

/**
 * Runs {@link solveScatter} against the live layout and re-solves whenever that
 * layout changes — the window resizing, a panel growing, or the whole screen
 * swapping from pre-roll to result to a raid's three setups.
 *
 * Watching the DOM rather than just the window matters: switching screens
 * replaces every obstacle at once without changing the window size at all, and
 * a solve from the previous screen leaves emotes buried under the new panels.
 *
 * `layer` is the scatter's own element. Mutations inside it are ignored, since
 * re-solving is what caused them — that would loop forever.
 *
 * Returns null until the first solve lands, so nothing paints in the wrong
 * place for a frame.
 */
export const useScatterLayout = (
  pieces: Piece[],
  layer: RefObject<HTMLElement | null>,
): (Placed | null)[] | null => {
  const [placed, setPlaced] = useState<(Placed | null)[] | null>(null);
  const last = useRef<(Placed | null)[] | null>(null);

  useLayoutEffect(() => {
    let frame = 0;
    let timer = 0 as unknown as ReturnType<typeof setTimeout>;

    const solve = () => {
      const solids = [...document.querySelectorAll('[data-solid]')];
      const obstacles = solids.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          strict: el.getAttribute('data-solid') === 'strict',
        };
      });
      const next = solveScatter(pieces, obstacles, window.innerWidth, window.innerHeight);
      // Bail before setState when nothing moved, or the mutation observer below
      // would see our own re-render and solve again.
      if (!samePlacement(next, last.current)) {
        last.current = next;
        setPlaced(next);
      }
      ro.disconnect();
      for (const el of solids) ro.observe(el);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      // Coalesce a burst of mutations into one solve after layout settles.
      frame = requestAnimationFrame(solve);
      // rAF is paused in a background tab, and FitScreen applies its scale in
      // its own layout effect — which can land after this one, leaving the
      // first solve measured against an unscaled layout. The timer guarantees
      // a corrective pass either way; a no-op solve costs nothing because the
      // equality check above skips the state write.
      timer = setTimeout(solve, 48);
    };

    const ro = new ResizeObserver(schedule);
    const mo = new MutationObserver((records) => {
      const el = layer.current;
      if (el && records.every((r) => el.contains(r.target))) return;
      schedule();
    });

    solve();
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    window.addEventListener('resize', schedule);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [pieces, layer]);

  return placed;
};
