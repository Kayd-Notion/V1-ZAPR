"use client";
import { ApiError } from "./api-error";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Records a zap whose SOL has already moved. The server may need a moment to
 * see the transaction on Solana (503 verify_pending) or the network may drop
 * the answer: retry a few times. A zap the server already has (409
 * already_recorded, e.g. the first answer was lost) counts as recorded.
 */
export async function recordWithRetry<T>(
  record: () => Promise<T>,
  alreadyRecorded: () => Promise<T>,
  signature: string,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await record();
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_recorded") return alreadyRecorded();
      const retryable = !(e instanceof ApiError) || e.code === "verify_pending" || e.status >= 500;
      if (!retryable) throw e;
      if (attempt >= 3) {
        throw new Error(
          `Your SOL was sent, but ZAPR couldn't record the zap yet (transaction ${signature.slice(0, 8)}…). ` +
            "It will show up in your Wallet activity once recorded; if not, contact the ZAPR team with this transaction.",
        );
      }
      await sleep(2000 * (attempt + 1));
    }
  }
}
