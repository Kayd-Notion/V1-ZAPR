"use client";
import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { Modal } from "../Modal";
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
      connect().catch((e) => toast(e instanceof Error ? e.message : "Connexion refusée."));
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
    <Modal title="Connexion requise" onClose={closeModal}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🔐</div>
        <p className="muted">{connectMessage}</p>
      </div>

      {connecting && (
        <div className="loading-state">
          <span className="spinner" style={{ color: "var(--accent)" }} /> Connexion…
        </div>
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
                      toast(e instanceof Error ? e.message : "Connexion refusée."),
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
              <span className="wo-tag">détecté</span>
            </button>
          ))}

          {/* Known wallets not detected — install links */}
          {notInstalled.map((k) => (
            <a key={k.name} className="wallet-option" href={k.url} target="_blank" rel="noreferrer">
              {k.name}
              <span className="wo-tag">installer</span>
            </a>
          ))}
        </div>
      )}

      {!connecting && detected.length === 0 && (
        <p className="faint" style={{ fontSize: 12.5, marginTop: 12, textAlign: "center" }}>
          Aucun wallet détecté. Installe l&apos;un des wallets ci-dessus, puis reviens.
        </p>
      )}

      {!connecting && detected.length > 0 && notInstalled.length > 0 && (
        <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>
          💡 Phantom installé mais absent de la liste ? Dans Brave : <b>Paramètres → Web3 →
          Portefeuille par défaut</b> → choisis <b>« Extensions (Phantom) »</b>, puis recharge la
          page.
        </p>
      )}

      <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={closeModal}>
        Plus tard
      </button>
    </Modal>
  );
}
