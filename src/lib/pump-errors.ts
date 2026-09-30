/**
 * Turns raw wallet / RPC errors from a pump transaction into messages a user
 * can act on (rule 3: never show a raw technical error for the rent minimum).
 * Pure function, no imports — unit-tested in tests/pump-rules.test.ts.
 */
export function humanizePumpError(err: unknown): string {
  const raw = err instanceof Error ? `${err.message} ${String((err as { logs?: unknown }).logs ?? "")}` : String(err);
  if (/InsufficientFundsForRent|insufficient funds for rent/i.test(raw)) {
    return (
      "The Solana network refused this zap: one of the receiving wallets is empty, and its share " +
      "is too small to activate it. Try a bigger amount."
    );
  }
  if (/insufficient lamports|no record of a prior credit|insufficient funds|AccountNotFound/i.test(raw)) {
    return "Not enough SOL in your wallet for this zap (amount + network fees).";
  }
  if (/user rejected|rejected the request|declined|cancell?ed/i.test(raw)) {
    return "Transaction canceled in the wallet: nothing was sent.";
  }
  if (/blockhash not found|block height exceeded|expired/i.test(raw)) {
    return "The transaction expired before it was confirmed: nothing was sent. Try again.";
  }
  if (/unexpected error/i.test(raw)) {
    // Wallets (Phantom…) return this bare message when they fail to submit,
    // most often because the wallet is set to another network than devnet.
    return (
      "Your wallet refused the transaction without a reason. Check that it's set to " +
      "Solana Devnet (Phantom: Settings → Developer Settings → Testnet Mode → Solana Devnet), " +
      "then try again."
    );
  }
  return err instanceof Error ? err.message : "The zap failed.";
}
