"use client";
/**
 * TEST DOUBLE of @privy-io/react-auth (only what ZAPR uses), for the browser
 * test. Swapped in by next.config on the dev server when ZAPR_MOCK_PRIVY=1.
 *
 * initOAuth = "the trip to Google": it signs in (or not, if the test set
 * mockprivy_cancel) and reloads the page, like Google redirecting back.
 * With mockprivy_manual set, it doesn't reload: the test does it.
 */
import { useSyncExternalStore, type ReactNode } from "react";
import { googleWalletAddress, hasWallet, setAuthed, snapshot, subscribe } from "./privy-state";

export function PrivyProvider({ children }: { children?: ReactNode; appId?: string; config?: unknown }) {
  return <>{children}</>;
}

export function usePrivy() {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "00");
  const authenticated = snap[0] === "1";
  const linkedAccounts =
    snap[1] === "1" && hasWallet()
      ? [{ type: "wallet", chainType: "solana", walletClientType: "privy", address: googleWalletAddress() }]
      : [];
  return {
    ready: true,
    authenticated,
    user: authenticated ? { linkedAccounts } : null,
    logout: async () => setAuthed(false),
  };
}

export function useLoginWithOAuth() {
  return {
    initOAuth: async ({ provider }: { provider: string }) => {
      localStorage.setItem("mockprivy_last_oauth", provider);
      if (localStorage.getItem("mockprivy_cancel") !== "1") localStorage.setItem("mockprivy_auth", "1");
      if (localStorage.getItem("mockprivy_manual") !== "1") window.location.reload();
    },
  };
}

export function useExportWallet() {
  return { exportWallet: async () => {} };
}
