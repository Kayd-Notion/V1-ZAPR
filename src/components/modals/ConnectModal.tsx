"use client";
import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { Info } from "lucide-react";
import { Modal } from "../Modal";
import { ZaprLoader, ZaprMark } from "../ZaprMark";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";

// Wallets we always surface so users can pick one even if Brave's built-in
// wallet is the only auto-detected provider.
const KNOWN = [
  { name: "Phantom", url: "https://phantom.app/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/download" },
];

export function ConnectModal() {
  const { wallets, select, connect, connecting, connected, wallet } = useWallet();
  const { connectMessage, closeModal, toast } = useUI();
  const { beginLogin } = useSession();

  // Auto-connect once a wallet is selected (we drive our own UI).
  useEffect(() => {
    if (wallet && !connected && !connecting) {
      connect().catch((e) => toast(e instanceof Error ? e.message : "Connection refused."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  // Wallets actually available in this browser (Standard/injected).
  const detected = wallets.filter(
    (w) =>
      w.readyState === WalletReadyState.Installed ||
      w.readyState === WalletReadyState.Loadable,
  );
  const detectedNames = new Set(detected.map((w) => w.adapter.name.toLowerCase()));

  // Known wallets not detected → offer an install link so the option is always shown.
  const notInstalled = KNOWN.filter((k) => !detectedNames.has(k.name.toLowerCase()));

  return (
    <Modal title="Connect your wallet" onClose={closeModal}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <ZaprMark className="connect-mark" />
        <p className="muted">{connectMessage}</p>
      </div>

      {connecting && (
        <ZaprLoader label="Connecting…" />
      )}

      {!connecting && (
        <div className="wallet-list">
          {/* Detected wallets — clickable to connect */}
          {detected.map((w) => (
            <button
              key={w.adapter.name}
              className="wallet-option"
              onClick={() => {
                beginLogin();
                if (wallet?.adapter.name === w.adapter.name) {
                  // Already selected: select() is a no-op, so connect directly.
                  if (!connected) {
                    connect().catch((e) =>
                      toast(e instanceof Error ? e.message : "Connection refused."),
                    );
                  }
                } else {
                  select(w.adapter.name);
                }
              }}
            >
              {w.adapter.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.adapter.icon} alt="" />
              )}
              {w.adapter.name}
              <span className="wo-tag">detected</span>
            </button>
          ))}

          {/* Known wallets not detected — install links */}
          {notInstalled.map((k) => (
            <a key={k.name} className="wallet-option" href={k.url} target="_blank" rel="noreferrer">
              {k.name}
              <span className="wo-tag">install</span>
            </a>
          ))}
        </div>
      )}

      {!connecting && detected.length === 0 && (
        <p className="faint" style={{ fontSize: 12.5, marginTop: 12, textAlign: "center" }}>
          No wallet detected. Install one above, then come back.
        </p>
      )}

      {!connecting && detected.length > 0 && notInstalled.length > 0 && (
        <p className="faint tip-line">
          <Info /> Phantom installed but not in the list? In Brave: <b>Settings → Web3 →
          Default wallet</b> → pick <b>&ldquo;Extensions (Phantom)&rdquo;</b>, then reload the page.
        </p>
      )}

      <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={closeModal}>
        Later
      </button>
    </Modal>
  );
}
