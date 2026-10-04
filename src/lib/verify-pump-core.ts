/**
 * The pure part of the on-chain zap check (no network, no server-only import,
 * so it is unit-tested): does this parsed Solana transaction move exactly the
 * expected split from the zapper to the creator and the platform?
 */
import { splitLamports } from "./pump-config";
import { solToLamports } from "./format";

// Allow tiny rounding differences (lamports) between client and server split.
const TOLERANCE_LAMPORTS = 10;

export interface ParsedTransferTx {
  meta?: { err?: unknown } | null;
  transaction: {
    message: {
      instructions: Array<{ program?: string; parsed?: { type?: string; info?: Record<string, unknown> } } | object>;
    };
  };
}

export interface ExpectedTransfer {
  pumperWallet: string;
  creatorWallet: string;
  founderWallet: string;
  amountSol: number;
  /** Platform share in bps (defaults to the post-zap split). */
  founderBps?: number;
}

export function checkTransferTx(tx: ParsedTransferTx, e: ExpectedTransfer): { ok: boolean; reason?: string } {
  if (tx.meta?.err) return { ok: false, reason: "Transaction failed on-chain." };

  const expected = splitLamports(solToLamports(e.amountSol), e.founderBps);
  let toCreator = 0;
  let toFounder = 0;
  let fromPayer = false;

  for (const raw of tx.transaction.message.instructions) {
    const ix = raw as { program?: string; parsed?: { type?: string; info?: Record<string, unknown> } };
    if (ix.program !== "system" || ix.parsed?.type !== "transfer") continue;
    const info = ix.parsed.info as { source?: string; destination?: string; lamports?: number };
    if (info.source !== e.pumperWallet) continue;
    fromPayer = true;
    if (info.destination === e.creatorWallet) toCreator += Number(info.lamports || 0);
    else if (info.destination === e.founderWallet) toFounder += Number(info.lamports || 0);
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
