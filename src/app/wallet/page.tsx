"use client";
import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { fmtSol, lamportsToSol } from "@/lib/format";
import { CLUSTER, explorerAddressUrl } from "@/lib/solana";

export default function WalletPage() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { user } = useSession();
  const { openConnect, toast, dataVersion } = useUI();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    connection
      .getBalance(publicKey)
      .then((lamports) => !cancelled && setBalance(lamportsToSol(lamports)))
      .catch(() => !cancelled && setBalance(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection, dataVersion]);

  if (!user) {
    return (
      <section>
        <div className="empty-state">
          <div className="ico">💳</div>
          <p>Connecte ton wallet pour voir ton solde et ton activité.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            onClick={() => openConnect("Connecte ton wallet pour accéder à ton wallet.")}
          >
            Connecter
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="balance-card">
        <div className="bc-label">Solde disponible ({CLUSTER})</div>
        <div className="bc-value">
          {loading || balance === null ? "…" : `${fmtSol(balance)} SOL`}
        </div>
        <div className="bc-fiat">
          {balance !== null ? `≈ ${(balance * 145).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € (estimation)` : ""}
        </div>
        <div className="bc-actions">
          <button
            className="btn"
            onClick={() =>
              publicKey &&
              connection
                .requestAirdrop(publicKey, 1_000_000_000)
                .then(() => toast("💧 Airdrop devnet demandé (1 SOL)"))
                .catch(() => toast("Airdrop indisponible (limite RPC)."))
            }
          >
            💧 Airdrop devnet
          </button>
          <button className="btn" onClick={() => toast("⬆️ Retrait — hors scope MVP")}>
            Retirer
          </button>
        </div>
      </div>

      <div className="section-title">Statistiques pump</div>
      <div className="stats-grid">
        <div className="stat-box">
          <div className="sb-val accent">⚡ {fmtSol(user.received)}</div>
          <div className="sb-label">Pumps reçus</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">⚡ {fmtSol(user.given)}</div>
          <div className="sb-label">Pumps donnés</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">{publicKey ? "✓" : "—"}</div>
          <div className="sb-label">Wallet lié</div>
        </div>
      </div>

      <p className="faint" style={{ padding: "0 16px 20px", fontSize: 12.5 }}>
        Le solde est lu en direct sur la blockchain ({CLUSTER}).{" "}
        {publicKey && (
          <a href={explorerAddressUrl(publicKey.toBase58())} target="_blank" rel="noreferrer">
            Voir sur l&apos;explorer
          </a>
        )}
        . L&apos;historique détaillé des transactions arrivera dans une phase ultérieure.
      </p>
    </section>
  );
}
