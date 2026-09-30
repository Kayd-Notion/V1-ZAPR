import "server-only";
import { getConnection } from "./solana";
import { FOUNDER_WALLET, splitLamports } from "./pump-config";
import { solToLamports } from "./format";

/**
 * Server-side integrity check for a client-submitted pump.
 * Confirms the on-chain transaction actually moved the expected split from the
 * pumper to (creator, founder). This defends the off-chain aggregates (post
 * totals, leaderboards) against forged pump records until the audited on-chain
 * program becomes the source of truth.
 */
export interface VerifyPumpArgs {
  signature: string;
  pumperWallet: string;
  creatorWallet: string;
  amountSol: number;
  /** Platform share in bps (defaults to the post-zap split). */
  founderBps?: number;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

// Allow tiny rounding differences (lamports) between client and server split.
const TOLERANCE_LAMPORTS = 10;

export async function verifyPumpTransaction(args: VerifyPumpArgs): Promise<VerifyResult> {
  const { signature, pumperWallet, creatorWallet, amountSol, founderBps } = args;
  if (!FOUNDER_WALLET) return { ok: false, reason: "Founder wallet not configured." };

  const conn = getConnection();
  const tx = await conn.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) return { ok: false, reason: "Transaction not found on-chain." };
  if (tx.meta?.err) return { ok: false, reason: "Transaction failed on-chain." };

  const expected = splitLamports(solToLamports(amountSol), founderBps);
  let toCreator = 0;
  let toFounder = 0;
  let fromPayer = false;

  const instructions = tx.transaction.message.instructions as Array<{
    program?: string;
    parsed?: { type?: string; info?: Record<string, unknown> };
  }>;

  for (const ix of instructions) {
    if (ix.program !== "system" || ix.parsed?.type !== "transfer") continue;
    const info = ix.parsed.info as { source?: string; destination?: string; lamports?: number };
    if (info.source !== pumperWallet) continue;
    fromPayer = true;
    if (info.destination === creatorWallet) toCreator += Number(info.lamports || 0);
    else if (info.destination === FOUNDER_WALLET) toFounder += Number(info.lamports || 0);
  }

  if (!fromPayer) return { ok: false, reason: "The payer doesn't match the connected wallet." };
  if (Math.abs(toCreator - expected.creatorLamports) > TOLERANCE_LAMPORTS) {
    return { ok: false, reason: "Wrong creator share." };
  }
  if (Math.abs(toFounder - expected.founderLamports) > TOLERANCE_LAMPORTS) {
    return { ok: false, reason: "Wrong platform share." };
  }
  return { ok: true };
}
