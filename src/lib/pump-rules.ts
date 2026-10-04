/**
 * Pump (zap) product rules, checked by the API routes and shown in the UI:
 *  - rule 2: an expired post can only be pumped with an amount that saves it
 *    (expiry pushed to ≥ now + PUMP_SAVE_MIN_LIFETIME_SECONDS);
 *  - rule 3: nothing below MIN_PUMP_SOL.
 */
import { LIFESPAN_CONFIG } from "./lifespan-config";
import { HOURS_PER_SOL } from "./lifespan";
import { MIN_PUMP_SOL, PUMP_SAVE_MIN_LIFETIME_SECONDS } from "./pump-config";

const HOUR_MS = 3_600_000;

/**
 * Inverse of lifespanHours(): the smallest cumulative total (a milestone)
 * whose lifespan reaches `targetHours`.
 */
export function pumpedSolForLifespan(targetHours: number): number {
  const needed = targetHours - LIFESPAN_CONFIG.baseHours;
  if (needed <= 1e-9) return 0;
  const fullSol = Math.floor(needed / HOURS_PER_SOL + 1e-9);
  let rest = needed - fullSol * HOURS_PER_SOL;
  if (rest <= 1e-9) return fullSol;
  for (const step of LIFESPAN_CONFIG.stepsPerSol) {
    rest -= step.hours;
    if (rest <= 1e-9) return fullSol + step.at;
  }
  return fullSol + 1;
}

export type PumpPostStatus = "active" | "expired" | "deleted";

export interface PumpRequirements {
  status: PumpPostStatus;
  minPumpSol: number;
  minToSaveSol: number | null;
  requiredMinSol: number;
}

/** Round up to 0.001 SOL so a displayed minimum is never an under-estimate. */
function ceilMilli(sol: number): number {
  return Math.ceil(Math.round(sol * 1e9) / 1e6) / 1000;
}

export function pumpRequirements(
  post: { createdAt: number; pumped: number; expiresAt: number; deleted?: boolean },
  nowMs: number,
  extraMarginSeconds = 0,
): PumpRequirements {
  if (post.deleted) return { status: "deleted", minPumpSol: MIN_PUMP_SOL, minToSaveSol: null, requiredMinSol: MIN_PUMP_SOL };
  if (post.expiresAt > nowMs) {
    return { status: "active", minPumpSol: MIN_PUMP_SOL, minToSaveSol: null, requiredMinSol: MIN_PUMP_SOL };
  }
  const targetMs = nowMs + (PUMP_SAVE_MIN_LIFETIME_SECONDS + extraMarginSeconds) * 1000;
  const needed = pumpedSolForLifespan((targetMs - post.createdAt) / HOUR_MS);
  const minToSave = ceilMilli(Math.max(0, needed - post.pumped));
  return { status: "expired", minPumpSol: MIN_PUMP_SOL, minToSaveSol: minToSave, requiredMinSol: Math.max(MIN_PUMP_SOL, minToSave) };
}

/** 0.292 → "0.292" (US English, no trailing zeros). */
export function formatSol(sol: number): string {
  return (Math.round(sol * 1e9) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 9 });
}
