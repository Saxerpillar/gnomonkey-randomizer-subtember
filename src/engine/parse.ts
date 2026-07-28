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

/** Compact gp formatter for readouts: 12_345_678 -> "12.3m". */
export const formatGp = (gp: number): string => {
  if (gp >= 1e9) return `${(gp / 1e9).toFixed(gp % 1e9 === 0 ? 0 : 1)}b`;
  if (gp >= 1e6) return `${(gp / 1e6).toFixed(gp % 1e6 === 0 ? 0 : 1)}m`;
  if (gp >= 1e3) return `${(gp / 1e3).toFixed(gp % 1e3 === 0 ? 0 : 1)}k`;
  return `${gp}`;
};
