/**
 * Vendored 7TV emotes used as page trim. Like every other asset in this app
 * they ship in `public/` and are never fetched at runtime — the future Twitch
 * extension CSP forbids outside origins.
 *
 * `w`/`h` mirror the file actually on disk (see `data/emotes.json`, which the
 * refresh script writes and `emotes.test.ts` cross-checks). They matter because
 * of the sizing rule below.
 */
export interface Emote {
  file: string;
  w: number;
  h: number;
}

export const EMOTES = {
  gigagnome: { file: 'gigagnome.webp', w: 96, h: 96 },
  gnomborger: { file: 'gnomborger.webp', w: 57, h: 32 },
  gnomeWide: { file: 'gnome-wide.webp', w: 116, h: 64 },
  gnomePunch: { file: 'gnome-punch.webp', w: 90, h: 64 },
  vvgnome: { file: 'vvgnome.webp', w: 112, h: 112 },
  campfire: { file: 'gnome-campfire.webp', w: 126, h: 96 },
  peepoSit: { file: 'peepo-sit-business.webp', w: 128, h: 128 },
  batchest: { file: 'ba-batchest.webp', w: 128, h: 128 },
  gmOnly: { file: 'gm-to-gms-only.webp', w: 128, h: 128 },
  billyBob: { file: 'protect-from-billy-bob.webp', w: 128, h: 128 },
  mods: { file: 'mods.webp', w: 128, h: 128 },
  strawberry: { file: 'strawberry.webp', w: 126, h: 96 },
  closeup: { file: 'ahmadmuhsin.webp', w: 96, h: 32 },
  lasers: { file: 'tiltedgnome.webp', w: 232, h: 128 },
  shocked: { file: 'shocked.webp', w: 104, h: 128 },
  gamba: { file: 'gamba.webp', w: 156, h: 128 },
  hardmode: { file: 'hardmode.webp', w: 128, h: 128 },
  roulette: { file: 'roulette.webp', w: 96, h: 96 },
} satisfies Record<string, Emote>;

export type EmoteKey = keyof typeof EMOTES;

/**
 * Emotes only ever scale UP, and never past 250% — past that the CDN source
 * turns to mush. Every placement's `scale` is checked against this, so the
 * rendered width is always `natural * scale` and never a shrink.
 */
export const MIN_SCALE = 1;
export const MAX_SCALE = 2.5;

export interface Placement {
  emote: EmoteKey;
  /** Centre of the emote as a percentage of the viewport. `x` stays inside
   *  [EDGE_KEEPOUT, 100 - EDGE_KEEPOUT] — trim pinned to the window edges reads
   *  as a border, and the brief wants it scattered inward instead. */
  x: number;
  y: number;
  scale: number;
  rot: number;
}

/**
 * How far, in viewport percent, trim must stay clear of the left/right edges.
 * Kept modest: every percent here is margin the scatter cannot use, and on a
 * busy screen that is the difference between a sprite finding a legal spot and
 * dropping out altogether.
 */
export const EDGE_KEEPOUT = 4;

/**
 * Twelve singles strewn across the page. Positions are deliberately irregular —
 * no shared column, no mirrored pairs — so it reads as scatter rather than a
 * border. They sit behind the UI, so the ones that land under a panel simply
 * peek out around its edges.
 *
 * An emote may appear twice, but only well away from its twin (see
 * `emotes.test.ts`) — currently none does.
 */
export const SCATTER: Placement[] = [
  { emote: 'peepoSit', x: 13, y: 9, scale: 1.15, rot: -7 },
  { emote: 'batchest', x: 37, y: 5, scale: 1.1, rot: 9 },
  { emote: 'gnomeWide', x: 84, y: 13, scale: 1.3, rot: -6 },
  { emote: 'gigagnome', x: 11, y: 34, scale: 1.5, rot: 5 },
  { emote: 'gnomborger', x: 88, y: 39, scale: 2.5, rot: -8 },
  { emote: 'billyBob', x: 22, y: 57, scale: 1.05, rot: -4 },
  { emote: 'vvgnome', x: 66, y: 62, scale: 1.25, rot: 11 },
  { emote: 'gnomePunch', x: 15, y: 82, scale: 1.7, rot: 8 },
  { emote: 'campfire', x: 27, y: 91, scale: 1.25, rot: -3 },
  { emote: 'gmOnly', x: 80, y: 86, scale: 1.05, rot: 6 },
  // Filling the two bare patches above and below the wordmark.
  { emote: 'mods', x: 59, y: 15, scale: 1.25, rot: -9 },
  { emote: 'strawberry', x: 54, y: 86, scale: 1.3, rot: 12 },
];

export interface Cluster {
  x: number;
  y: number;
  /** Offsets in px from the cluster's centre, so members huddle and overlap.
   *  Free to go either way now that there is no column to steer around. */
  members: { dx: number; dy: number; scale: number; rot: number }[];
}

/**
 * The close-up gnome, huddled: one trio, one pair, and two loners — the counts
 * the brief asked for.
 */
export const CLUSTERS: Cluster[] = [
  {
    x: 71,
    y: 27,
    members: [
      { dx: 0, dy: 0, scale: 1.35, rot: -12 },
      { dx: 44, dy: 30, scale: 1.1, rot: 9 },
      { dx: -22, dy: 54, scale: 1, rot: 18 },
    ],
  },
  {
    x: 30,
    y: 71,
    members: [
      { dx: 0, dy: 0, scale: 1.3, rot: 10 },
      { dx: -38, dy: 34, scale: 1.05, rot: -14 },
    ],
  },
  { x: 55, y: 44, members: [{ dx: 0, dy: 0, scale: 1.15, rot: -16 }] },
  { x: 91, y: 68, members: [{ dx: 0, dy: 0, scale: 1.2, rot: 13 }] },
];

/** Every scale in play, for the sizing-rule test. */
export const allScales = (): number[] => [
  ...SCATTER.map((p) => p.scale),
  ...CLUSTERS.flatMap((c) => c.members.map((m) => m.scale)),
];
