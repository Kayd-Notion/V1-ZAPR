import "server-only";
import { getServerConnection, serverRpcOnRightNetwork } from "./solana-server";
import { FOUNDER_WALLET } from "./pump-config";
import { checkTransferTx, onchainVerifyDefault, type ParsedTransferTx } from "./verify-pump-core";

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
 * ("true" / "false"); otherwise it is on for every Vercel deployment
 * (production AND previews: a preview may share the production database, and
 * an unchecked zap there would put fake totals in it) and off in local
 * development.
 */
export function onchainVerifyRequired(): boolean {
  return onchainVerifyDefault(process.env);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function verifyPumpTransaction(args: VerifyPumpArgs): Promise<VerifyResult> {
  const { signature, pumperWallet, creatorWallet, amountSol, founderBps } = args;
  if (!FOUNDER_WALLET) return { ok: false, reason: "Founder wallet not configured." };

  // A transaction the wallet just confirmed can take a moment to be readable
  // from another RPC node, and a public RPC can rate-limit: retry a few times.
  // Never trust a transaction read from another network (e.g. a mainnet RPC
  // pasted while the site is on devnet).
  if ((await serverRpcOnRightNetwork()) === false) {
    return { ok: false, reason: "ZAPR's server is connected to the wrong Solana network. Zaps are paused." };
  }
  const conn = getServerConnection();
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
