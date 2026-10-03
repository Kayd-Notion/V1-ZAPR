/**
 * Pump split configuration.
 *
 * The 70/30 creator/founder split is intentionally NOT hard-coded at each call
 * site. It lives here as a single source of truth, driven by env vars, so it can
 * be adjusted later (and eventually mirror the on-chain config account described
 * in the launch guide, §Phase 0: `creator_bps=7000 / founder_bps=3000`).
 */

const DEFAULT_CREATOR_BPS = 7000; // 70.00%
const DEFAULT_FOUNDER_BPS = 3000; // 30.00%

function readBps(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 10000 ? Math.round(n) : fallback;
}

export const PUMP_SPLIT = {
  creatorBps: readBps(process.env.NEXT_PUBLIC_PUMP_CREATOR_BPS, DEFAULT_CREATOR_BPS),
  founderBps: readBps(process.env.NEXT_PUBLIC_PUMP_FOUNDER_BPS, DEFAULT_FOUNDER_BPS),
} as const;

// Guard: if a misconfiguration makes the two shares not sum to 100%, fall back
// to the safe defaults rather than silently sending the wrong amounts.
const splitSum = PUMP_SPLIT.creatorBps + PUMP_SPLIT.founderBps;
export const SPLIT_IS_VALID = splitSum === 10000;

export function resolvedSplitBps(): { creatorBps: number; founderBps: number } {
  if (SPLIT_IS_VALID) return PUMP_SPLIT;
  return { creatorBps: DEFAULT_CREATOR_BPS, founderBps: DEFAULT_FOUNDER_BPS };
}

/**
 * Creator zaps (SOL sent straight to a creator, not to a post): their own
 * split, 90/10 by default, set by NEXT_PUBLIC_CREATOR_ZAP_CREATOR_BPS. The
 * platform share is always the remainder, so the two always sum to 100%.
 */
const DEFAULT_CREATOR_ZAP_CREATOR_BPS = 9000; // 90.00%
const creatorZapCreatorBps = readBps(process.env.NEXT_PUBLIC_CREATOR_ZAP_CREATOR_BPS, DEFAULT_CREATOR_ZAP_CREATOR_BPS);
export const CREATOR_ZAP_SPLIT = {
  creatorBps: creatorZapCreatorBps,
  founderBps: 10000 - creatorZapCreatorBps,
} as const;

/**
 * Split a lamports amount into the creator and founder shares.
 * Uses integer lamports arithmetic; the creator absorbs any rounding remainder
 * so the two parts always sum exactly to the input (no lamports created/lost).
 */
export function splitLamports(
  totalLamports: number,
  founderBps: number = resolvedSplitBps().founderBps,
): {
  creatorLamports: number;
  founderLamports: number;
} {
  const founderLamports = Math.floor((totalLamports * founderBps) / 10000);
  const creatorLamports = totalLamports - founderLamports;
  return { creatorLamports, founderLamports };
}

// A throwaway devnet address so zero-config previews (e.g. Vercel) can send the
// platform share without any env setup. Only used off-mainnet; on mainnet the
// founder wallet MUST be configured explicitly or pumps refuse to build.
const DEVNET_DEMO_FOUNDER = "4QmGx5cAVfuSdEpZgwmwv6J5SJbWYguphDAv8a6Jn22r";
const isMainnet = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet").trim() === "mainnet-beta";

export const FOUNDER_WALLET =
  process.env.NEXT_PUBLIC_FOUNDER_WALLET || (isMainnet ? "" : DEVNET_DEMO_FOUNDER);

/** Pump product rules — the single place for these values (UI and API routes). */
// Rule 3: minimum pump. 0.005 SOL keeps both shares (70/30) above Solana's
// rent-exempt minimum for an empty recipient wallet. Do not hard-code the rent
// value elsewhere: adjust this constant instead.
export const MIN_PUMP_SOL = 0.005;
// Creator zaps: with a 10% platform share, 0.01 SOL keeps both shares above
// the rent-exempt minimum of an empty recipient wallet.
export const MIN_CREATOR_ZAP_SOL = 0.01;
// Quick amounts offered in both zap windows (post zap and creator zap). All
// are at or above both minimums above.
export const QUICK_ZAP_AMOUNTS = [0.01, 0.05, 0.1, 0.5, 1] as const;
// Rule 2: saving an expired post must give it at least this much life.
export const PUMP_SAVE_MIN_LIFETIME_SECONDS = 3600;
// Rule 2: extra margin on the amount shown in the modal, so it is still
// enough when the user confirms a few minutes later.
export const PUMP_QUOTE_SLACK_SECONDS = 300;
