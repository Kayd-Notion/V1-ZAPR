"use client";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import type { WalletName } from "@solana/wallet-adapter-base";
import { IconInfo, IconLink } from "@/components/icons";
import { Modal } from "../Modal";
import { ZaprLoader } from "../ZaprMark";
import { AppleLogo, GoogleLogo } from "./ConnectModal";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { shortWallet } from "@/lib/format";
import { PRIVY_WALLET_NAME, SOCIAL_PROVIDERS, startSocialLink, type SocialProvider } from "@/lib/social-login";

/**
 * Settings → Link a wallet. The picked wallet (or the Google / Apple one)
 * signs a message, then it signs in to this same account. The actual linking
 * runs in SessionContext (it also has to finish after the trip to Google).
 */
export function LinkWalletModal() {
  const { wallets, wallet, select, connect, connected, connecting } = useWallet();
  const { closeModal, toast } = useUI();
  const { user, userWallets, walletAddress, startLinking, stopLinking, retryLink, linkSigning } = useSession();
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [hint, setHint] = useState("");

  // Linking mode while this window is open.
  useEffect(() => {
    startLinking();
    return () => {
      void stopLinking();
    };
  }, [startLinking, stopLinking]);

  // A wallet was picked: connect it (it then gets the link message to sign).
  const [picked, setPicked] = useState<WalletName | null>(null);
  useEffect(() => {
    if (!picked || wallet?.adapter.name !== picked || connected || connecting) return;
    connect().catch((e) => toast(e instanceof Error ? e.message : "Connection refused."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, wallet]);

  if (!user) return null;

  const hasSocial = (user.linkedWallets ?? []).some((w) => w.label === PRIVY_WALLET_NAME);
  const usingSocial = wallet?.adapter.name === PRIVY_WALLET_NAME;
  const detected = wallets.filter(
    (w) =>
      w.adapter.name !== PRIVY_WALLET_NAME &&
      (w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable),
  );

  const pick = (name: WalletName) => {
    setHint("");
    retryLink();
    if (wallet?.adapter.name === name && connected && walletAddress && userWallets.includes(walletAddress)) {
      // Same app, same account: it is already on ZAPR.
      setHint(
        `${name} is connected with ${shortWallet(walletAddress)}, already on your account. ` +
          `To link another ${name} account, switch account in ${name}: ZAPR asks it to sign right away.`,
      );
      return;
    }
    setPicked(name);
    if (wallet?.adapter.name === name) {
      if (!connected) connect().catch((e) => toast(e instanceof Error ? e.message : "Connection refused."));
    } else {
      select(name);
    }
  };

  const social = async (provider: SocialProvider) => {
    setSocialBusy(provider);
    const stuck = setTimeout(() => setSocialBusy(null), 15_000);
    try {
      await startSocialLink(provider);
    } catch (e) {
      clearTimeout(stuck);
      setSocialBusy(null);
      toast(e instanceof Error ? e.message : "Couldn't open the sign-in.");
    }
  };

  const busy = connecting || linkSigning;

  return (
    <Modal title="Link a wallet" icon={<IconLink />} onClose={closeModal}>
      <div className="lw">
        <p className="lw-intro">
          Sign in to <b>@{user.handle}</b> with Google or any of your wallets: same profile, same posts. Zaps you
          receive still go to your main wallet <b>{shortWallet(user.wallet)}</b>.
        </p>

        {busy ? (
          <ZaprLoader label={linkSigning ? "Check your wallet: sign the message to link it (free)." : "Connecting… check your wallet."} />
        ) : (
          <>
            {SOCIAL_PROVIDERS.length > 0 && !hasSocial && !usingSocial && (
              <>
                <div className="cx-social">
                  {SOCIAL_PROVIDERS.includes("google") && (
                    <button className="cx-google" onClick={() => social("google")} disabled={socialBusy !== null}>
                      <GoogleLogo />
                      {socialBusy === "google" ? "Opening Google…" : "Link Google"}
                    </button>
                  )}
                  {SOCIAL_PROVIDERS.includes("apple") && (
                    <button className="cx-apple" onClick={() => social("apple")} disabled={socialBusy !== null}>
                      <AppleLogo />
                      {socialBusy === "apple" ? "Opening Apple…" : "Link Apple"}
                    </button>
                  )}
                </div>
                <div className="cx-or">
                  <span>or a wallet</span>
                </div>
              </>
            )}

            <div className="wallet-list">
              {detected.map((w) => {
                const current = wallet?.adapter.name === w.adapter.name && connected;
                return (
                  <button key={w.adapter.name} className="wallet-option" onClick={() => pick(w.adapter.name)}>
                    {w.adapter.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.adapter.icon} alt="" />
                    ) : (
                      <span className="wo-letter">{w.adapter.name[0]}</span>
                    )}
                    <span className="wo-name">{w.adapter.name}</span>
                    {current && <span className="wo-tag">Connected</span>}
                  </button>
                );
              })}
              {detected.length === 0 && <p className="cx-none">No wallet found in this browser.</p>}
            </div>

            {hint && <p className="lw-hint">{hint}</p>}

            <p className="faint tip-line">
              <IconInfo />
              <span>
                A wallet that already has its own ZAPR account can&apos;t be linked: two accounts can&apos;t be merged.
                On your phone, open ZAPR in the wallet&apos;s app to link it.
              </span>
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
