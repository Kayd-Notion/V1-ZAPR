/**
 * Dynamic post lifespan configuration.
 *
 * A post lives at least 24h. Each cumulative SOL pumped extends its life by
 * tiers, with NO cap (guide §Phase 1: "24h + paliers à chaque pump").
 *
 * The exact tier thresholds are NOT finalized yet, so they live here in an
 * isolated config with reasonable defaults, rather than being baked into the
 * business logic. Tune these once real usage data exists.
 *
 * Model: base 24h, then for the total SOL pumped on a post we add extra hours
 * according to a piecewise/linear tier schedule. `tiers` is a list of segments
 * evaluated in order: within each segment, every SOL above `fromSol` grants
 * `hoursPerSol` additional hours, until the next segment takes over. This gives
 * generous early boosts with diminishing (but never zero) returns — while
 * remaining trivially adjustable.
 */

export interface LifespanTier {
  /** Lower bound of cumulative pumped SOL for this segment (inclusive). */
  fromSol: number;
  /** Extra hours granted per SOL pumped while within this segment. */
  hoursPerSol: number;
}

export const LIFESPAN_CONFIG = {
  /** Minimum lifespan of every post, in hours. */
  baseHours: 24,
  /**
   * Tier schedule (must be sorted by `fromSol` ascending, first entry = 0).
   * Defaults: the first SOL is worth a lot of life, later SOL less, unbounded.
   */
  tiers: [
    { fromSol: 0, hoursPerSol: 24 }, // 0–1 SOL   : +24h / SOL
    { fromSol: 1, hoursPerSol: 12 }, // 1–5 SOL   : +12h / SOL
    { fromSol: 5, hoursPerSol: 6 }, //  5–20 SOL  : +6h / SOL
    { fromSol: 20, hoursPerSol: 3 }, // 20–100 SOL : +3h / SOL
    { fromSol: 100, hoursPerSol: 1.5 }, // 100+ SOL : +1.5h / SOL (no cap)
  ] as LifespanTier[],
} as const;
