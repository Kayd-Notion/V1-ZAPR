import "server-only";
import { getConnection } from "./solana";
import { FOUNDER_WALLET } from "./pump-config";
import { checkTransferTx, type ParsedTransferTx } from "./verify-pump-core";

/**
 * Server-side integrity check for a client-submitted pump.
 * Confirms the on-chain transaction actually moved the expected split from the
 * pumper to (creator, founder). This defends the off-chain aggregates (post
 * totals, leaderboards) against forged pump records until the audited on-chain
 * program becomes the source of truth.
 */
export interface VerifyPumpArgs {
  signature: string;
  /** The zapper's wallet, or every wallet of their account (main + linked). */
  pumperWallet: string | string[];
  creatorWallet: string;
  amountSol: number;
  /** Platform share in bps (defaults to the post-zap split). */
  founderBps?: number;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  /** Not a wrong transaction: Solana couldn't be read (yet). Worth retrying. */
  retryable?: boolean;
}

/**
 * Is the on-chain check on? Explicit PUMP_REQUIRE_ONCHAIN_VERIFY wins
 * ("true" / "false"); otherwise it is on in production (Vercel) and off in
 * local development and previews.
 */
export function onchainVerifyRequired(): boolean {
  const v = process.env.PUMP_REQUIRE_ONCHAIN_VERIFY;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.VERCEL_ENV === "production";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function verifyPumpTransaction(args: VerifyPumpArgs): Promise<VerifyResult> {
  const { signature, pumperWallet, creatorWallet, amountSol, founderBps } = args;
  if (!FOUNDER_WALLET) return { ok: false, reason: "Founder wallet not configured." };

  // A transaction the wallet just confirmed can take a moment to be readable
  // from another RPC node, and a public RPC can rate-limit: retry a few times.
  const conn = getConnection();
  let tx: Awaited<ReturnType<typeof conn.getParsedTransaction>> = null;
  for (let attempt = 0; attempt < 5 && !tx; attempt++) {
    if (attempt) await sleep(1200 * attempt);
    try {
      tx = await conn.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    } catch {
      tx = null;
    }
  }
  if (!tx) {
    return { ok: false, retryable: true, reason: "Solana hasn't confirmed this transaction yet. Retrying…" };
  }
  return checkTransferTx(tx as unknown as ParsedTransferTx, {
    pumperWallet,
    creatorWallet,
    founderWallet: FOUNDER_WALLET,
    amountSol,
    founderBps,
  });
}
