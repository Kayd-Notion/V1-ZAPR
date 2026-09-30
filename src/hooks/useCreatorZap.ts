"use client";
import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { sendPump } from "@/lib/pump";
import { api } from "@/lib/api";
import { CREATOR_ZAP_SPLIT, FOUNDER_WALLET } from "@/lib/pump-config";
import { humanizePumpError } from "@/lib/pump-errors";
import type { ClientUser } from "@/lib/client-types";

/**
 * Creator zap end to end: server re-check → the same atomic two-transfer
 * transaction as a post zap, with the creator-zap split (90/10 by default) →
 * record it server-side (verified on-chain when enabled).
 */
export function useCreatorZap() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction } = useWallet();

  const runCreatorZap = useCallback(
    async (creator: ClientUser, amountSol: number, anonymous: boolean): Promise<ClientUser | null> => {
      if (!publicKey || !sendTransaction) throw new Error("Wallet not connected.");
      // 1. Server re-check (auth, not yourself, minimum). Refused → nothing is signed.
      await api.prepareCreatorZap(creator.handle, amountSol);

      // 2. Sign + send.
      let signature: string;
      try {
        const result = await sendPump({
          connection,
          payer: publicKey,
          creatorWallet: creator.wallet,
          amountSol,
          sendTransaction,
          signTransaction,
          target: { platformWallet: FOUNDER_WALLET, platformBps: CREATOR_ZAP_SPLIT.founderBps },
        });
        signature = result.signature;
      } catch (e) {
        console.error("creator zap failed", e);
        throw new Error(humanizePumpError(e));
      }

      // 3. Record it.
      const { user } = await api.recordCreatorZap(creator.handle, { amount: amountSol, signature, anonymous });
      return user;
    },
    [connection, publicKey, sendTransaction, signTransaction],
  );

  return { runCreatorZap, canSign: Boolean(publicKey && sendTransaction) };
}
