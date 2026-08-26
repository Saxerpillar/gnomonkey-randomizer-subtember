import { describe, expect, it } from 'vitest';
import { MAX_OBSCURED, rotatedBox, solveScatter, type Piece } from './useScatterLayout';

const VW = 1920;
const VH = 1080;

const boxAt = (x: number, y: number, w: number, h: number) => ({
  left: x, top: y, right: x + w, bottom: y + h,
});

/** Rects for the pieces that were actually placed; dropped ones are skipped. */
const rects = (pieces: Piece[], placed: ({ x: number; y: number } | null)[]) =>
  placed.flatMap((p, i) =>
    p == null
      ? []
      : [
          {
            left: p.x - pieces[i].w / 2,
            top: p.y - pieces[i].h / 2,
            right: p.x + pieces[i].w / 2,
            bottom: p.y + pieces[i].h / 2,
          },
        ],
  );

const overlapArea = (a: ReturnType<typeof boxAt>, b: ReturnType<typeof boxAt>) => {
  const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return dx > 0 && dy > 0 ? dx * dy : 0;
};

describe('rotatedBox', () => {
  it('is the sprite itself when unrotated', () => {
    expect(rotatedBox(100, 60, 0)).toEqual({ w: 100, h: 60 });
  });

  it('grows with rotation, and the same either way round', () => {
    const cw = rotatedBox(100, 60, 30);
    expect(cw.w).toBeGreaterThan(100);
    expect(cw.h).toBeGreaterThan(60);
    expect(rotatedBox(100, 60, -30)).toEqual(cw);
  });
});

describe('solveScatter', () => {
  const grid: Piece[] = Array.from({ length: 12 }, (_, i) => ({
    w: 120, h: 100, x: 0.2 + (i % 4) * 0.2, y: 0.2 + Math.floor(i / 4) * 0.3,
  }));

  it('separates pieces that start stacked on each other', () => {
    const stacked: Piece[] = Array.from({ length: 6 }, () => ({ w: 120, h: 100, x: 0.5, y: 0.5 }));
    const out = rects(stacked, solveScatter(stacked, [], VW, VH));
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        expect(overlapArea(out[i], out[j])).toBe(0);
      }
    }
  });

  it('moves a piece out from under a panel that would bury it', () => {
    const panel = boxAt(700, 200, 520, 700);
    const buried: Piece[] = [{ w: 120, h: 100, x: 0.5, y: 0.5 }];
    const [placed] = solveScatter(buried, [panel], VW, VH);
    expect(placed).not.toBeNull();
    const [r] = rects(buried, [placed]);
    expect(overlapArea(r, panel) / (120 * 100)).toBeLessThanOrEqual(MAX_OBSCURED);
  });

  it('keeps every piece inside the window and off the side edges', () => {
    const panel = boxAt(410, 60, 1100, 900);
    const out = rects(grid, solveScatter(grid, [panel], VW, VH));
    for (const r of out) {
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(VW);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.bottom).toBeLessThanOrEqual(VH);
    }
  });

  it('drops a piece rather than burying it when nothing legal is left', () => {
    // A panel across the whole window leaves nowhere to go at all.
    const wall = boxAt(0, 0, VW, VH);
    const out = solveScatter([{ w: 120, h: 100, x: 0.5, y: 0.5 }], [wall], VW, VH);
    expect(out).toEqual([null]);
  });

  it('satisfies both rules at once on a realistic layout', () => {
    const obstacles = [boxAt(410, 40, 500, 620), boxAt(960, 40, 550, 620), boxAt(830, 700, 260, 70)];
    const out = rects(grid, solveScatter(grid, obstacles, VW, VH));
    for (let i = 0; i < out.length; i++) {
      const covered = obstacles.reduce((s, o) => s + overlapArea(out[i], o), 0);
      expect(covered / (grid[i].w * grid[i].h)).toBeLessThanOrEqual(MAX_OBSCURED);
      for (let j = i + 1; j < out.length; j++) expect(overlapArea(out[i], out[j])).toBe(0);
    }
  });
});

// The real result screen: a centred 1100px column holding the wordmark, two
// gear/boss panels and the NEW CHALLENGE button. This is the tightest layout
// the scatter has to cope with, so it is worth pinning across window sizes.
const resultScreen = (vw: number, vh: number) => {
  const col = Math.min(1100, vw - 32);
  const left = (vw - col) / 2;
  const gear = col * 0.55;
  return [
    boxAt(left, 24, col, 146), // wordmark
    boxAt(left, 190, gear - 10, vh - 280), // your gear
    boxAt(left + gear, 190, col - gear, vh - 280), // your challenger
    boxAt(left + col / 2 - 130, vh - 84, 260, 68), // actions
  ];
};

describe('the real result screen', () => {
  // Mirrors EmoteScatter: 17 sprites, padded footprints, spread over the page.
  const sprites: Piece[] = Array.from({ length: 17 }, (_, i) => {
    const w = 100 + (i % 4) * 22;
    const h = 90 + (i % 3) * 20;
    return { w: w + 6, h: h + 24, x: 0.1 + ((i * 0.17) % 0.8), y: 0.06 + ((i * 0.23) % 0.85), area: w * h };
  });

  for (const [vw, vh] of [
    [1920, 1080],
    [1600, 900],
    [1366, 768],
  ]) {
    it(`holds both rules for every sprite it places at ${vw}x${vh}`, () => {
      const obstacles = resultScreen(vw, vh);
      const solved = solveScatter(sprites, obstacles, vw, vh);
      const boxes = rects(sprites, solved);

      for (let i = 0; i < boxes.length; i++) {
        const covered = obstacles.reduce((s, o) => s + overlapArea(boxes[i], o), 0);
        const area =
          (boxes[i].right - boxes[i].left) * (boxes[i].bottom - boxes[i].top);
        expect(covered / area).toBeLessThanOrEqual(MAX_OBSCURED);
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlapArea(boxes[i], boxes[j])).toBe(0);
        }
      }
    });
  }

  it('places every sprite when the window is roomy', () => {
    const solved = solveScatter(sprites, resultScreen(1920, 1080), 1920, 1080);
    expect(solved.filter(Boolean)).toHaveLength(sprites.length);
  });

  it('drops sprites rather than burying them when the window is cramped', () => {
    // A 1200px window is almost entirely content column: there is no honest
    // room for trim, and the correct answer is to show less of it (here, none)
    // rather than paint gnomes over the gear.
    const vw = 1200;
    const vh = 700;
    const obstacles = resultScreen(vw, vh);
    const solved = solveScatter(sprites, obstacles, vw, vh);
    expect(solved.filter(Boolean).length).toBeLessThan(sprites.length);
    for (const box of rects(sprites, solved)) {
      const covered = obstacles.reduce((s, o) => s + overlapArea(box, o), 0);
      const area = (box.right - box.left) * (box.bottom - box.top);
      expect(covered / area).toBeLessThanOrEqual(MAX_OBSCURED);
    }
  });
});

describe('strict obstacles', () => {
  const wordmark = { ...boxAt(600, 40, 700, 150), strict: true };

  it('leaves no overlap at all with a strict obstacle', () => {
    // Seeded right on top of the wordmark, so it has to move off it entirely.
    const pieces: Piece[] = Array.from({ length: 6 }, (_, i) => ({
      w: 130, h: 110, x: 0.4 + i * 0.04, y: 0.1,
    }));
    const boxes = rects(pieces, solveScatter(pieces, [wordmark], VW, VH));
    expect(boxes.length).toBeGreaterThan(0);
    for (const b of boxes) expect(overlapArea(b, wordmark)).toBe(0);
  });

  it('still allows partial overlap of an ordinary obstacle', () => {
    // A lone panel with the piece seeded on it: sliding partly off is enough,
    // which is what separates ordinary obstacles from strict ones.
    const panel = boxAt(400, 300, 900, 400);
    const pieces: Piece[] = [{ w: 130, h: 110, x: 0.45, y: 0.46 }];
    const [box] = rects(pieces, solveScatter(pieces, [panel], VW, VH));
    expect(box).toBeDefined();
    expect(overlapArea(box, panel) / (130 * 110)).toBeLessThanOrEqual(MAX_OBSCURED);
  });
});
