/**
 * Leaderboard rules (decided by the founder, October 2026):
 *  1. A zap counts for its FULL amount (100 %), not only the creator's share.
 *  2. Zapping yourself is allowed (it still extends your post's life) but it
 *     never counts in the leaderboards. "Yourself" is the account, so it
 *     covers every wallet linked to it: zaps are recorded per account.
 * Both stores (demo and Postgres) apply these; tests/ranking.test.ts checks them.
 */

/** A zap from an account to itself (same user id, whichever of its wallets paid). */
export function isSelfZap(zapperUserId: string, creatorUserId: string | null | undefined): boolean {
  return Boolean(creatorUserId) && zapperUserId === creatorUserId;
}
