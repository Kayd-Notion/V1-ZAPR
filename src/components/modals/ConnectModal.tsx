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
              <div className="wallet-list">
                {detected.map((w) => (
                  <button key={w.adapter.name} className="wallet-option" onClick={() => pick(w.adapter.name)}>
                    {w.adapter.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.adapter.icon} alt="" />
                    ) : (
                      <span className="wo-letter">{w.adapter.name[0]}</span>
                    )}
                    <span className="wo-name">{w.adapter.name}</span>
                    <span className="wo-badge">
                      <i /> Detected
                    </span>
                  </button>
                ))}
                {detected.length === 0 && (
                  <p className="cx-none">
                    No wallet found in this browser.{" "}
                    {touch ? "Open ZAPR in your wallet's app below." : "Install one below, then come back."}
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
