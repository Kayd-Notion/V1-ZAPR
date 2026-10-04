/**
 * Post lifespan rules ("the power of a zap").
 *
 * A post is born with `baseHours` of life. Every zap adds to the post's total;
 * each time that total crosses a milestone, the post gains time, added to the
 * time it has left. There is no cap: a post that keeps being zapped lives
 * forever.
 *
 * Milestones repeat inside every SOL (0→1, 1→2, 2→3…): reaching x.10, x.25,
 * x.50 and the next whole SOL each unlock a step. With the defaults below a
 * full SOL is always worth +24 h, earned in four steps (3 h, 3 h, 6 h, 12 h),
 * so small zaps count too. Zaps below a milestone fill the gauge without
 * adding time until the milestone is reached.
 *
 * All the numbers live here; the logic in lifespan.ts reads them.
 */

export interface BoostStep {
  /** Position inside the current SOL (0 < at ≤ 1; 1 = the next whole SOL). */
  at: number;
  /** Hours added when the post's total reaches this position. */
  hours: number;
}

export const LIFESPAN_CONFIG = {
  /** Life every post starts with, in hours. */
  baseHours: 24,
  /** Milestones inside each SOL, sorted by `at`, the last one at 1. */
  stepsPerSol: [
    { at: 0.1, hours: 3 },
    { at: 0.25, hours: 3 },
    { at: 0.5, hours: 6 },
    { at: 1, hours: 12 },
  ] as BoostStep[],
} as const;
