"use client";
import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Droplet, ExternalLink } from "lucide-react";
import { ZapIcon, ZaprEmpty } from "@/components/ZaprMark";
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
        <ZaprEmpty title="Pas de wallet, pas de zaps.">
          <button
            className="btn btn-primary"
            onClick={() => openConnect("Connecte ton wallet pour voir ton solde.")}
          >
            Connecter
          </button>
        </ZaprEmpty>
      </section>
    );
  }

  return (
    <section>
      <div className="subbar">
        <div className="page-title">Wallet</div>
      </div>
      <div className="balance-card">
        <ZapIcon className="bc-mark" />
        <div className="bc-label">Ton solde ({CLUSTER})</div>
        <div className="bc-value">
          {loading || balance === null ? "…" : `${fmtSol(balance)} SOL`}
        </div>
        <div className="bc-actions">
          <button
            className="btn"
            onClick={() =>
              publicKey &&
              connection
                .requestAirdrop(publicKey, 1_000_000_000)
                .then(() => toast("1 SOL devnet en route."))
                .catch(() => toast("Faucet à sec (limite RPC). Réessaie plus tard ou passe par faucet.solana.com."))
            }
          >
            <Droplet /> Faucet devnet +1 SOL
          </button>
        </div>
      </div>

      <div className="section-title">Tes stats</div>
      <div className="stats-grid">
        <div className="stat-box">
          <div className="sb-val accent">
            <ZapIcon />
            {fmtSol(user.received)}
          </div>
          <div className="sb-label">SOL reçus</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">
            <ZapIcon />
            {fmtSol(user.given)}
          </div>
          <div className="sb-label">SOL envoyés</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">{publicKey ? "Oui" : "Non"}</div>
          <div className="sb-label">Wallet lié</div>
        </div>
      </div>

      <p className="faint hint-line">
        Solde lu en direct sur la blockchain ({CLUSTER}).
        {publicKey && (
          <>
            {" "}
            <a href={explorerAddressUrl(publicKey.toBase58())} target="_blank" rel="noreferrer">
              Voir sur l&apos;explorer <ExternalLink />
            </a>
          </>
        )}
      </p>
    </section>
  );
}
