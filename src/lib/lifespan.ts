/**
 * Lifespan computation — pure functions built on top of `lifespan-config.ts`.
 * Kept separate from the config so thresholds can change without touching logic.
 */
import { LIFESPAN_CONFIG } from "./lifespan-config";

const HOUR_MS = 3600_000;
const LAMPORTS = 1_000_000_000;
const STEPS = LIFESPAN_CONFIG.stepsPerSol;
/** Hours earned by one full SOL (sum of the milestones inside a SOL). */
export const HOURS_PER_SOL = STEPS.reduce((h, s) => h + s.hours, 0);

/** Integer lamports, so milestones like 0.1 compare exactly (no float noise). */
function toLamports(sol: number): number {
  return Math.max(0, Math.round(sol * LAMPORTS));
}

/** Hours earned by milestones for a post that received `totalPumpedSol`. */
export function boostHours(totalPumpedSol: number): number {
  const lamports = toLamports(totalPumpedSol);
  const fullSol = Math.floor(lamports / LAMPORTS);
  const inSol = lamports - fullSol * LAMPORTS;
  let hours = fullSol * HOURS_PER_SOL;
  for (const step of STEPS) {
    if (step.at < 1 && inSol >= Math.round(step.at * LAMPORTS)) hours += step.hours;
  }
  return hours;
}

/** Total lifespan (in hours) of a post: base life + milestones reached. No cap. */
export function lifespanHours(totalPumpedSol: number): number {
  return LIFESPAN_CONFIG.baseHours + boostHours(totalPumpedSol);
}

/** The next milestone above `totalPumpedSol`: the total to reach and the hours it adds. */
export function nextBoost(totalPumpedSol: number): { atSol: number; hours: number } {
  const lamports = toLamports(totalPumpedSol);
  const fullSol = Math.floor(lamports / LAMPORTS);
  const inSol = lamports - fullSol * LAMPORTS;
  for (const step of STEPS) {
    const at = Math.round(step.at * LAMPORTS);
    if (inSol < at) return { atSol: (fullSol * LAMPORTS + at) / LAMPORTS, hours: step.hours };
  }
  // Exactly on a whole SOL: the first milestone of the next SOL.
  return { atSol: (lamports + Math.round(STEPS[0].at * LAMPORTS)) / LAMPORTS, hours: STEPS[0].hours };
}

/** Exact SOL still missing to reach the next milestone (and the hours it adds). */
export function solToNextBoost(totalPumpedSol: number): { amount: number; hours: number } {
  const next = nextBoost(totalPumpedSol);
  return { amount: (toLamports(next.atSol) - toLamports(totalPumpedSol)) / LAMPORTS, hours: next.hours };
}

/** Hours a zap of `amountSol` adds to a post that already received `totalPumpedSol`. */
export function zapBoostHours(totalPumpedSol: number, amountSol: number): number {
  return boostHours(totalPumpedSol + amountSol) - boostHours(totalPumpedSol);
}

/**
 * Expired posts disappear from every read at once, but are only deleted from
 * storage this long after expiry, so a zap already being signed when the post
 * dies can still be recorded (money has moved on-chain by then).
 */
export const PURGE_GRACE_MS = 10 * 60_000;

/** Absolute expiry timestamp (ms epoch) for a post. */
export function expiresAt(createdAtMs: number, totalPumpedSol: number): number {
  return createdAtMs + lifespanHours(totalPumpedSol) * HOUR_MS;
}

export interface LifespanInfo {
  totalHours: number;
  remainingMs: number;
  remainingHours: number;
  /** 0..100 — fraction of lifespan remaining, for the gauge. */
  pct: number;
  expired: boolean;
  /** "critical" | "low" | "" — gauge color class, matching the MVP. */
  cls: "critical" | "low" | "";
}

/** Everything the UI needs to render the time gauge. */
export function lifespanInfo(
  createdAtMs: number,
  totalPumpedSol: number,
  nowMs: number = Date.now(),
): LifespanInfo {
  const totalHours = lifespanHours(totalPumpedSol);
  const elapsedMs = nowMs - createdAtMs;
  const totalMs = totalHours * HOUR_MS;
  const remainingMs = totalMs - elapsedMs;
  const remainingHours = remainingMs / HOUR_MS;
  const pct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
  const expired = remainingMs <= 0;
  let cls: LifespanInfo["cls"] = "";
  if (!expired) {
    if (pct < 15) cls = "critical";
    else if (pct < 35) cls = "low";
  }
  return { totalHours, remainingMs, remainingHours, pct, expired, cls };
}
