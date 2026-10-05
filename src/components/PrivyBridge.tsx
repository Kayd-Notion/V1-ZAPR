"use client";
import { useEffect, useRef } from "react";
import { PrivyProvider, useExportWallet, useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { useStandardWallets } from "@privy-io/react-auth/solana";
import { getWallets } from "@wallet-standard/app";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession } from "@/context/SessionContext";
import { BRAND } from "@/lib/brand";
import {
  PRIVY_APP_ID,
  PRIVY_WALLET_NAME,
  SOCIAL_PENDING_KEY,
  setSocialHandlers,
  type SocialProvider,
} from "@/lib/social-login";

/**
 * Google / Apple sign-in through Privy, loaded only when NEXT_PUBLIC_PRIVY_APP_ID
 * is set (AppShell imports it lazily).
 *
 * How it plugs in without changing the rest of ZAPR:
 *  1. "Continue with Google" → Privy's OAuth redirect (our own button, no Privy UI).
 *  2. Back on ZAPR, Privy creates the person's Solana wallet if they have none.
 *  3. That wallet is registered in the Wallet Standard registry, so the wallet
 *     adapter sees it like Phantom ("Privy").
 *  4. We select + connect it and run the usual ZAPR sign-in (a message signed
 *     by the wallet, verified by the server). Zaps, uploads and the on-chain
 *     checks then work unchanged.
 */
export default function PrivyBridge() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "apple"],
        appearance: { theme: "dark", accentColor: BRAND.yellow as `#${string}`, walletChainType: "solana-only" },
        embeddedWallets: {
          solana: { createOnLogin: "all-users" },
          ethereum: { createOnLogin: "off" },
          // ZAPR shows its own zap window (amount, split): no second confirmation popup.
          showWalletUIs: false,
        },
      }}
    >
      <Bridge />
    </PrivyProvider>
  );
}

function Bridge() {
  const { ready, authenticated, logout } = usePrivy();
  const { initOAuth } = useLoginWithOAuth();
  const { exportWallet } = useExportWallet();
  const { wallets: privyWallets } = useStandardWallets();
  const { wallets, wallet, select, connect, connected, connecting } = useWallet();
  const { beginLogin } = useSession();
  const finishing = useRef(false);

  // The Connect window calls these through lib/social-login.
  useEffect(() => {
    setSocialHandlers({
      login: async (provider: SocialProvider) => {
        sessionStorage.setItem(SOCIAL_PENDING_KEY, provider);
        await initOAuth({ provider });
      },
      exportWallet: () => exportWallet(),
      logout: () => logout(),
    });
    return () => setSocialHandlers(null);
  }, [initOAuth, exportWallet, logout]);

  // 3. Make the Privy wallet visible to the wallet adapter.
  const privyWallet = authenticated ? privyWallets.find((w) => w.name === PRIVY_WALLET_NAME) : undefined;
  useEffect(() => {
    if (!privyWallet) return;
    return getWallets().register(privyWallet);
  }, [privyWallet]);

  // 4. Coming back from Google / Apple: select + connect the Privy wallet, then sign in.
  useEffect(() => {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(SOCIAL_PENDING_KEY);
    } catch {
      /* ignore */
    }
    if (!pending || !ready || !authenticated || finishing.current) return;
    const adapter = wallets.find((w) => w.adapter.name === PRIVY_WALLET_NAME);
    if (!adapter) return; // wallet not created / registered yet: this runs again when it is
    finishing.current = true;
    sessionStorage.removeItem(SOCIAL_PENDING_KEY);
    beginLogin();
    select(adapter.adapter.name);
  }, [ready, authenticated, wallets, beginLogin, select]);

  useEffect(() => {
    if (!finishing.current || wallet?.adapter.name !== PRIVY_WALLET_NAME || connected || connecting) return;
    finishing.current = false;
    connect().catch(() => {});
  }, [wallet, connected, connecting, connect]);

  return null;
}
