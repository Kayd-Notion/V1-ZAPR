"use client";
import { useEffect, useRef, useState } from "react";
import { PrivyProvider, useExportWallet, useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { useCreateWallet, useStandardWallets } from "@privy-io/react-auth/solana";
import { getWallets } from "@wallet-standard/app";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
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
 *  2. Back on ZAPR, ZAPR asks Privy to create the person's Solana wallet if
 *     they have none (Privy's automatic creation only follows its own login window).
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
          // Created by ZAPR right after the Google sign-in (see step 2 below).
          solana: { createOnLogin: "off" },
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
  const { ready, authenticated, logout, user: privyUser } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { initOAuth } = useLoginWithOAuth();
  const { exportWallet } = useExportWallet();
  const { wallets: privyWallets } = useStandardWallets();
  const { wallets, connecting } = useWallet();
  const { beginLogin, status, switchWallet } = useSession();
  const { toast } = useUI();
  const finishing = useRef(false); // the coming-back step ran (once per trip)
  // Re-runs the "coming back" step when no trip to Google was needed.
  const [kick, setKick] = useState(0);

  // The Connect window (and Settings → Link a wallet) call these through lib/social-login.
  useEffect(() => {
    setSocialHandlers({
      login: async (provider: SocialProvider) => {
        sessionStorage.setItem(SOCIAL_PENDING_KEY, provider);
        await initOAuth({ provider });
      },
      link: async (provider: SocialProvider) => {
        sessionStorage.setItem(SOCIAL_PENDING_KEY, `link:${provider}`);
        // Still signed in to Google from an earlier visit: no need to go there again.
        if (authenticated) {
          finishing.current = false;
          setKick((n) => n + 1);
        }
        else await initOAuth({ provider });
      },
      exportWallet: () => exportWallet(),
      logout: () => logout(),
    });
    return () => setSocialHandlers(null);
  }, [initOAuth, exportWallet, logout, authenticated]);

  // 2. Privy only creates the Solana wallet by itself after a login through its
  //    own window; with our own Google button, ZAPR asks for it (once).
  const hasSolanaWallet = Boolean(
    privyUser?.linkedAccounts?.some(
      (a) =>
        a.type === "wallet" &&
        a.chainType === "solana" &&
        (a.walletClientType === "privy" || a.walletClientType === "privy-v2"),
    ),
  );
  const creating = useRef(false);
  const createFailed = useRef(false);
  useEffect(() => {
    if (!ready || !authenticated || !privyUser || hasSolanaWallet || creating.current || createFailed.current) return;
    creating.current = true;
    createWallet()
      .catch((e) => {
        createFailed.current = true;
        console.error("[ZAPR] Couldn't create the Google wallet:", e);
        toast("Couldn't create your wallet. Reload the page and try again.");
      })
      .finally(() => {
        creating.current = false;
      });
  }, [ready, authenticated, privyUser, hasSolanaWallet, createWallet, toast]);

  // 3. Make the Privy wallet visible to the wallet adapter.
  const privyWallet =
    authenticated && hasSolanaWallet ? privyWallets.find((w) => w.name === PRIVY_WALLET_NAME) : undefined;
  useEffect(() => {
    if (!privyWallet) return;
    return getWallets().register(privyWallet);
  }, [privyWallet]);

  // 4. Coming back from Google / Apple: switch to the Privy wallet, then sign
  //    in (or, when linking, SessionContext links it to the signed-in account).
  useEffect(() => {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(SOCIAL_PENDING_KEY);
    } catch {
      /* ignore */
    }
    if (!pending || !ready || !authenticated || finishing.current) return;
    const linkingGoogle = pending.startsWith("link:");
    if (linkingGoogle) {
      if (status === "loading") return; // ZAPR session not restored yet
      if (status !== "authed") {
        // The ZAPR session ended meanwhile: nothing to link to.
        sessionStorage.removeItem(SOCIAL_PENDING_KEY);
        void logout();
        toast("Sign in to ZAPR first, then link Google from Settings.");
        return;
      }
    }
    const adapter = wallets.find((w) => w.adapter.name === PRIVY_WALLET_NAME);
    if (!adapter) return; // wallet not created / registered yet: this runs again when it is
    // Another wallet (Phantom) is still reconnecting after the page load: wait.
    if (connecting) return;
    finishing.current = true;
    sessionStorage.removeItem(SOCIAL_PENDING_KEY);
    if (!linkingGoogle) beginLogin();
    switchWallet(adapter.adapter.name);
  }, [ready, authenticated, wallets, beginLogin, switchWallet, kick, status, connecting, logout, toast]);

  return null;
}
