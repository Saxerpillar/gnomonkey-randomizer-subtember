/** Budget input parser: "10m" -> 10_000_000, "250k", "1.5b", "1,000,000". */

export type BudgetParse =
  | { ok: true; gp: number | null } // null = empty input = no budget
  | { ok: false };

const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

export const parseBudget = (text: string): BudgetParse => {
  const t = text.trim().toLowerCase().replace(/[,_ ]/g, '');
  if (t === '') return { ok: true, gp: null };

  const m = /^(\d+(?:\.\d+)?)([kmb])?$/.exec(t);
  if (!m) return { ok: false };

  const gp = Math.round(parseFloat(m[1]) * (m[2] ? SUFFIX[m[2]] : 1));
  if (!Number.isSafeInteger(gp) || gp < 0) return { ok: false };
  return { ok: true, gp };
};

/**
 * In-game coin display: truncated integer units, 5 characters max.
 * 0-99,999 raw digits · 100k-9999k · 10m-9999m · capped at "10b".
 */
export const formatGp = (gp: number): string => {
  if (gp >= 1e10) return '10b';
  if (gp >= 1e7) return `${Math.floor(gp / 1e6)}m`;
  if (gp >= 1e5) return `${Math.floor(gp / 1e3)}k`;
  return `${gp}`;
};

/**
 * Live input formatting: plain digit runs get "," thousands separators as you
 * type (100000 -> "100,000"). Anything with a suffix/decimal passes through
 * untouched. parseBudget strips commas, so the grouped text stays parseable.
 */
export const groupDigits = (text: string): string => {
  const bare = text.replace(/,/g, '');
  if (!/^\d+$/.test(bare)) return text;
  return bare.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/** In-game coin text colour tier: yellow < 100k, white < 10m, green from 10m. */
export type GpTier = 'yellow' | 'white' | 'green';
export const gpTier = (gp: number): GpTier =>
  gp >= 10_000_000 ? 'green' : gp >= 100_000 ? 'white' : 'yellow';
