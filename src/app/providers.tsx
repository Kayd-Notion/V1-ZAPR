"use client";
import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import type { Adapter } from "@solana/wallet-adapter-base";
import { rpcEndpoint } from "@/lib/solana";
import { UIProvider } from "@/context/UIContext";
import { SessionProvider } from "@/context/SessionContext";
import { AppShell } from "@/components/AppShell";

// Only silently reconnect the wallet for people who already have a session;
// first-time visitors are never prompted by their wallet extension.
async function shouldAutoConnect(): Promise<boolean> {
  try {
    return localStorage.getItem("ps_logged_in") === "1";
  } catch {
    return false;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => rpcEndpoint(), []);
  // Empty adapter list: Phantom / Solflare / Backpack (and any others) are
  // auto-detected as Wallet-Standard wallets — no WalletConnect involved.
  const wallets = useMemo<Adapter[]>(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={shouldAutoConnect}>
        <UIProvider>
          <SessionProvider>
            <AppShell>{children}</AppShell>
          </SessionProvider>
        </UIProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
