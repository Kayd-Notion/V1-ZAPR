"use client";
/** TEST DOUBLE of @privy-io/react-auth/solana (see privy-react-auth.tsx). */
import { useSyncExternalStore } from "react";
import { createWallet, googleWallet, snapshot, subscribe } from "./privy-state";

/** Like Privy: the "Privy" standard wallet object exists, with no account until created. */
export function useStandardWallets() {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "00");
  return { ready: true, wallets: snap[0] === "1" ? [googleWallet() as { name: string }] : [] };
}

export function useCreateWallet() {
  return {
    createWallet: async () => {
      if (localStorage.getItem("mockprivy_create_fails") === "1") throw new Error("Wallet creation failed (test).");
      createWallet();
      return { wallet: {} };
    },
  };
}
