/**
 * Wilson score: lower bound of the 95% confidence interval for a Bernoulli parameter.
 * Reference: Evan Miller — "How Not To Sort By Average Rating" (2009)
 * https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
 */
export function wilsonScore(pos: number, n: number): number {
  if (n === 0) return 0;
  const z = 1.96; // 95% confidence quantile
  const p = pos / n;
  return (
    (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) /
    (1 + (z * z) / n)
  );
}

/**
 * SteamDB rating: intuitive formula where uncertainty decreases logarithmically
 * with review count. Produces scores comparable to Steam's native percentage.
 * Reference: SteamDB blog — "Introducing SteamDB's new rating algorithm" (2017)
 * https://steamdb.info/blog/steamdb-rating/
 *
 * Behaviour:
 *   0 reviews  → 0.5 (neutral)
 *   10 reviews → 50% uncertainty
 *   100 reviews → 25% uncertainty
 *   1000 reviews → 12.5% uncertainty
 */
export function steamdbRating(pos: number, total: number): number {
  if (total === 0) return 0;
  const score = pos / total;
  return score - (score - 0.5) * Math.pow(2, -Math.log10(total + 1));
}

export type ScoreFormula = 'wilson' | 'steamdb';

export function computeScore(
  pos: number,
  total: number,
  formula: ScoreFormula = 'steamdb'
): number {
  return formula === 'wilson' ? wilsonScore(pos, total) : steamdbRating(pos, total);
}

/** Format a 0–1 score as a percentage string, e.g. "87%" */
export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}
