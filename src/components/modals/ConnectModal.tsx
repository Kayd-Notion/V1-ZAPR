"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import type { WalletName } from "@solana/wallet-adapter-base";
import { IconBack, IconChevronRight, IconExternal, IconInfo, IconWallet } from "@/components/icons";
import { Modal } from "../Modal";
import { ZaprLoader, ZaprMark } from "../ZaprMark";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { PRIVY_WALLET_NAME, SOCIAL_PROVIDERS, startSocialLogin, type SocialProvider } from "@/lib/social-login";

/** Google's "G" (official colors), for the sign-in button. */
export function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function AppleLogo() {
  return (
    <svg viewBox="0 0 384 512" width="16" height="18" aria-hidden="true" fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

/**
 * Solana wallets we suggest when they are not installed. `browse` opens ZAPR
 * inside the wallet's own app (phones have no browser extensions).
 */
const KNOWN: { name: string; color: string; url: string; browse?: (site: string) => string }[] = [
  {
    name: "Phantom",
    color: "#ab9ff2",
    url: "https://phantom.app/download",
    browse: (s) => `https://phantom.app/ul/browse/${encodeURIComponent(s)}?ref=${encodeURIComponent(s)}`,
  },
  {
    name: "Solflare",
    color: "#fc7227",
    url: "https://solflare.com/download",
    browse: (s) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(s)}?ref=${encodeURIComponent(s)}`,
  },
  { name: "Backpack", color: "#e33e3f", url: "https://backpack.app/download" },
  { name: "Coinbase Wallet", color: "#0052ff", url: "https://www.coinbase.com/wallet/downloads" },
  { name: "Trust Wallet", color: "#3375bb", url: "https://trustwallet.com/download" },
];

const RETURNING_KEY = "zapr_returning";

/**
 * Wallet sign-in, laid out like pump.fun: the wallets found in this browser
 * first ("Detected"), then "More wallets" with the others (install links, or
 * "open in the app" on a phone).
 */
export function ConnectModal() {
  const { wallets, select, connect, connecting, connected, wallet } = useWallet();
  const { connectMessage, closeModal, toast } = useUI();
  const { beginLogin } = useSession();
  const [view, setView] = useState<"main" | "more">("main");
  const [returning, setReturning] = useState(false);
  const [touch, setTouch] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);

  // Google / Apple: Privy takes over (redirect), then ZAPR finishes the sign-in on return.
  const social = async (provider: SocialProvider) => {
    setSocialBusy(provider);
    // Normally the page leaves for Google / Apple; if nothing happens, don't stay stuck.
    const stuck = setTimeout(() => {
      setSocialBusy(null);
      toast("Couldn't reach the sign-in. Check your connection and try again.");
    }, 15_000);
    try {
      await startSocialLogin(provider);
    } catch (e) {
      clearTimeout(stuck);
      toast(e instanceof Error ? e.message : "Couldn't open the sign-in.");
      setSocialBusy(null);
    }
  };

  useEffect(() => {
    try {
      setReturning(localStorage.getItem(RETURNING_KEY) === "1");
    } catch {
      /* ignore */
    }
    setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  // Auto-connect once a wallet is selected (we drive our own UI).
  useEffect(() => {
    if (wallet && !connected && !connecting) {
      connect().catch((e) => toast(e instanceof Error ? e.message : "Connection refused."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  // Wallets actually available in this browser (Wallet Standard / injected).
  const detected = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  );
  const detectedNames = new Set(detected.map((w) => w.adapter.name.toLowerCase()));
  const others = KNOWN.filter((k) => !detectedNames.has(k.name.toLowerCase()));

  const pick = (name: WalletName) => {
    beginLogin();
    if (wallet?.adapter.name === name) {
      // Already selected: select() is a no-op, so connect directly.
      if (!connected) connect().catch((e) => toast(e instanceof Error ? e.message : "Connection refused."));
    } else {
      select(name);
    }
  };

  const site = typeof window === "undefined" ? "" : window.location.href;

  return (
    <Modal title="Connect your wallet" onClose={closeModal} bare>
      {view === "main" ? (
        <div className="cx">
          <div className="cx-head">
            <span className="cx-logo">
              <ZaprMark className="cx-mark" />
            </span>
            <h2>{returning ? "Welcome back" : "Welcome to ZAPR"}</h2>
            <p>{connectMessage}</p>
          </div>

          {connecting ? (
            <ZaprLoader label="Connecting… check your wallet." />
          ) : (
            <>
              {SOCIAL_PROVIDERS.length > 0 && (
                <>
                  <div className="cx-social">
                    {SOCIAL_PROVIDERS.includes("google") && (
                      <button className="cx-google" onClick={() => social("google")} disabled={socialBusy !== null}>
                        <GoogleLogo />
                        {socialBusy === "google" ? "Opening Google…" : "Continue with Google"}
                      </button>
                    )}
                    {SOCIAL_PROVIDERS.includes("apple") && (
                      <button className="cx-apple" onClick={() => social("apple")} disabled={socialBusy !== null}>
                        <AppleLogo />
                        {socialBusy === "apple" ? "Opening Apple…" : "Continue with Apple"}
                      </button>
                    )}
                  </div>
                  <p className="cx-social-note">No wallet needed: we create a Solana wallet for you.</p>
                  <div className="cx-or">
                    <span>or connect a wallet</span>
                  </div>
                </>
              )}
              <div className="wallet-list">
                {detected.map((w) => (
                  <button key={w.adapter.name} className="wallet-option" onClick={() => pick(w.adapter.name)}>
                    {w.adapter.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.adapter.icon} alt="" />
                    ) : (
                      <span className="wo-letter">{w.adapter.name[0]}</span>
                    )}
                    <span className="wo-name">
                      {w.adapter.name === PRIVY_WALLET_NAME ? "Your Google / Apple wallet" : w.adapter.name}
                    </span>
                    <span className="wo-badge">
                      <i /> Detected
                    </span>
                  </button>
                ))}
                {detected.length === 0 && (
                  <p className="cx-none">
                    No wallet found in this browser.{" "}
                    {SOCIAL_PROVIDERS.length > 0
                      ? "Use the button above, or see more wallets."
                      : touch
                        ? "Open ZAPR in your wallet's app below."
                        : "Install one below, then come back."}
                  </p>
                )}
                <button className="wallet-option wo-more" onClick={() => setView("more")}>
                  <span className="wo-letter wo-generic">
                    <IconWallet />
                  </span>
                  <span className="wo-name">More wallets</span>
                  <IconChevronRight className="wo-chevron" />
                </button>
              </div>

              <p className="cx-legal">
                Signing in is free: you only sign a message, nothing is sent. By connecting, you agree to the{" "}
                <Link href="/terms" onClick={closeModal}>
                  Terms
                </Link>
                .
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="cx">
          <div className="cx-subhead">
            <button className="icon-btn" onClick={() => setView("main")} aria-label="Back">
              <IconBack />
            </button>
            <h3>More wallets</h3>
          </div>
          <div className="wallet-list">
            {others.map((k) => {
              const href = touch && k.browse ? k.browse(site) : k.url;
              return (
                <a key={k.name} className="wallet-option" href={href} target="_blank" rel="noreferrer">
                  <span className="wo-letter" style={{ background: k.color }}>
                    {k.name[0]}
                  </span>
                  <span className="wo-name">{k.name}</span>
                  <span className="wo-tag">
                    {touch && k.browse ? "Open in app" : "Install"} <IconExternal />
                  </span>
                </a>
              );
            })}
            {others.length === 0 && <p className="cx-none">Every wallet we know is already detected.</p>}
          </div>
          {!touch && (
            <p className="faint tip-line">
              <IconInfo />
              <span>
                Phantom installed but not listed? In Brave: <b>Settings → Web3 → Default wallet</b> → pick{" "}
                <b>&ldquo;Extensions (Phantom)&rdquo;</b>, then reload the page.
              </span>
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
